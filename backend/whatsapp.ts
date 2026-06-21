import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { prisma } from './prismaClient';

// Singleton lazy do OpenAI — instanciado uma única vez sob demanda
let _openaiInstance: any = null;
function getOpenAI() {
  if (!_openaiInstance && process.env.OPENAI_API_KEY) {
    const { OpenAI } = require('openai');
    _openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openaiInstance;
}

interface WsInstance {
  sock: any;
  currentQr: string | null;
}

const instances = new Map<string, WsInstance>();
let ioInstance: Server | null = null;

export async function initWhatsApp(io: Server, campanhaId: string) {
  ioInstance = io;
  
  const baseAuthFolder = process.env.WHATSAPP_AUTH_DIR || path.join(__dirname, 'baileys_auth_info');
  const authFolder = path.join(baseAuthFolder, campanhaId);
  
  if (!fs.existsSync(authFolder)) {
    fs.mkdirSync(authFolder, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }) as any,
  });

  const instance: WsInstance = { sock, currentQr: null };
  instances.set(campanhaId, instance);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update: any) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      instance.currentQr = await QRCode.toDataURL(qr);
      io.to(campanhaId).emit('whatsapp:qr', instance.currentQr);
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      instance.currentQr = null;
      io.to(campanhaId).emit('whatsapp:status', 'desconectado');
      
      if (!shouldReconnect) {
         // Se fez logout de verdade, apagar a pasta
         fs.rmSync(authFolder, { recursive: true, force: true });
         instances.delete(campanhaId);
      } else {
         initWhatsApp(io, campanhaId);
      }
    } else if (connection === 'open') {
      instance.currentQr = null;
      io.to(campanhaId).emit('whatsapp:status', 'conectado');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.remoteJid === 'status@broadcast') continue;
      
      const isFromMe = msg.key.fromMe || false;
      // Mensagens enviadas pelo sistema já são gravadas em sendWhatsAppMessage /
      // sendWhatsAppMediaFile. Ignoramos aqui para não duplicar no histórico.
      if (isFromMe) continue;
      const jid = msg.key.remoteJid as string;
      const numero = jid.split('@')[0];
      
      // Extrai o texto da mensagem
      const texto = msg.message.conversation || 
                    msg.message.extendedTextMessage?.text || 
                    msg.message.imageMessage?.caption || 
                    msg.message.videoMessage?.caption || 
                    '[Mídia/Áudio/Arquivo]';

      if (!texto) continue;

      try {
        // 1. Salvar no Banco (CRM Caixa de Entrada)
        const msgDb = await prisma.mensagemWhatsApp.create({
          data: {
            campanha_id: campanhaId,
            numero,
            texto,
            is_from_me: isFromMe,
            lida: isFromMe // se fui eu que mandei, já tá lida
          }
        });

        // 2. Emitir via Socket para a UI atualizar em tempo real
        io.to(campanhaId).emit('whatsapp:mensagem', msgDb);

        // 3. Lógica do Chatbot (Apenas se a msg for do Eleitor)
        if (!isFromMe) {
          const config = await prisma.configuracaoWhatsApp.findFirst({
            where: { campanha_id: campanhaId }
          });

          if (config?.ativar_chatbot) {
            if (config.usar_ia && process.env.OPENAI_API_KEY) {
              try {
                const openai = getOpenAI();
                if (!openai) throw new Error('OpenAI não disponível');
                
                // Busca últimas 5 mensagens para contexto
                const historico = await prisma.mensagemWhatsApp.findMany({
                  where: { campanha_id: campanhaId, numero },
                  orderBy: { created_at: 'asc' },
                  take: 6 // 5 antigas + 1 atual
                });
                
                const messagesContext = historico.slice(0, -1).map(m => ({
                  role: m.is_from_me ? 'assistant' : 'user',
                  content: m.texto
                }));
                
                messagesContext.unshift({
                  role: 'system',
                  content: config.ia_prompt || 'Você é um assistente de campanha política prestativo e educado.'
                });
                messagesContext.push({ role: 'user', content: texto });

                const completion = await openai.chat.completions.create({
                  messages: messagesContext,
                  model: 'gpt-3.5-turbo'
                });
                
                const resposta = completion.choices[0].message.content || '...';
                await sendWhatsAppMessage(campanhaId, numero, resposta);
              } catch (e) {
                console.error('Erro na IA:', e);
              }
            } else {
              // Checa mensagens recentes enviadas pelo bot para não flodar
              const mensagensRecentes = await prisma.mensagemWhatsApp.findFirst({
                where: {
                  campanha_id: campanhaId,
                  numero,
                  is_from_me: true,
                  created_at: { gte: new Date(Date.now() - 30 * 60 * 1000) } // últimos 30 min
                }
              });

              if (!mensagensRecentes) {
                const resposta = config.msg_boas_vindas || 'Olá! Como podemos ajudar sua comunidade hoje?';
                await sendWhatsAppMessage(campanhaId, numero, resposta);
              }
            }
          }
        }
      } catch (err) {
        console.error('Erro ao processar mensagem recebida:', err);
      }
    }
  });
}

export function getWhatsAppStatus(campanhaId: string) {
  const instance = instances.get(campanhaId);
  if (!instance) return { status: 'desconectado' };
  
  if (instance.sock?.user) return { status: 'conectado' };
  if (instance.currentQr) return { status: 'aguardando_qr', qr: instance.currentQr };
  return { status: 'desconectado' };
}

export async function sendWhatsAppMessage(campanhaId: string, number: string, text: string, tipo: string = 'text', url_midia?: string) {
  const instance = instances.get(campanhaId);
  if (!instance || !instance.sock?.user) throw new Error("WhatsApp não está conectado para esta campanha.");
  
  const jid = `${number}@s.whatsapp.net`;
  
  if (tipo === 'image' && url_midia) {
    await instance.sock.sendMessage(jid, { image: { url: url_midia }, caption: text });
  } else if (tipo === 'video' && url_midia) {
    await instance.sock.sendMessage(jid, { video: { url: url_midia }, caption: text });
  } else if (tipo === 'audio' && url_midia) {
    await instance.sock.sendMessage(jid, { audio: { url: url_midia }, mimetype: 'audio/mp4', ptt: true });
  } else {
    await instance.sock.sendMessage(jid, { text });
  }

  // Salvar no Histórico do CRM
  try {
    const msgDb = await prisma.mensagemWhatsApp.create({
      data: {
        campanha_id: campanhaId,
        numero: number,
        texto: tipo === 'text' ? text : `[Mídia: ${tipo}] ${text || ''}`,
        is_from_me: true,
        lida: true
      }
    });
    // Avisar o frontend caso a caixa de entrada esteja aberta
    if (ioInstance) {
      ioInstance.to(campanhaId).emit('whatsapp:mensagem', msgDb);
    }
  } catch (err) {
    console.error('Erro ao salvar mensagem no histórico:', err);
  }
}

/** Envia mídia a partir de um arquivo local (buffer) */
export async function sendWhatsAppMediaFile(
  campanhaId: string,
  number: string,
  filePath: string,
  mimetype: string,
  caption: string,
  tipo: string
) {
  const instance = instances.get(campanhaId);
  if (!instance || !instance.sock?.user) throw new Error("WhatsApp não está conectado para esta campanha.");
  
  const buffer = fs.readFileSync(filePath);
  const jid = `${number}@s.whatsapp.net`;
  
  if (tipo === 'image') {
    await instance.sock.sendMessage(jid, { image: buffer, mimetype, caption: caption || undefined });
  } else if (tipo === 'video') {
    await instance.sock.sendMessage(jid, { video: buffer, mimetype, caption: caption || undefined });
  } else if (tipo === 'audio') {
    await instance.sock.sendMessage(jid, { audio: buffer, mimetype: mimetype || 'audio/mp4', ptt: true });
  } else {
    await instance.sock.sendMessage(jid, { document: buffer, mimetype, fileName: `arquivo.${mimetype.split('/')[1] || 'bin'}` });
  }

  try {
    const msgDb = await prisma.mensagemWhatsApp.create({
      data: {
        campanha_id: campanhaId,
        numero: number,
        texto: `[Mídia: ${tipo}] ${caption || ''}`,
        is_from_me: true,
        lida: true
      }
    });
    if (ioInstance) ioInstance.to(campanhaId).emit('whatsapp:mensagem', msgDb);
  } catch (err) {
    console.error('Erro ao salvar mídia enviada no histórico', err);
  }
}
