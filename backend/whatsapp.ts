import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { Server } from 'socket.io';
import path from 'path';

let sock: any = null;
let ioInstance: Server | null = null;
let currentQr: string | null = null;

export async function initWhatsApp(io: Server) {
  ioInstance = io;
  
  const authFolder = path.join(__dirname, 'baileys_auth_info');
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }) as any,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update: any) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      currentQr = await QRCode.toDataURL(qr);
      io.emit('whatsapp:qr', currentQr);
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      currentQr = null;
      io.emit('whatsapp:status', 'desconectado');
      if (shouldReconnect) {
        initWhatsApp(io);
      }
    } else if (connection === 'open') {
      currentQr = null;
      io.emit('whatsapp:status', 'conectado');
    }
  });
}

export function getWhatsAppStatus() {
  if (sock?.user) return { status: 'conectado' };
  if (currentQr) return { status: 'aguardando_qr', qr: currentQr };
  return { status: 'desconectado' };
}

export async function sendWhatsAppMessage(number: string, text: string, tipo: string = 'text', url_midia?: string) {
  if (!sock?.user) throw new Error("WhatsApp não está conectado.");
  
  const jid = `${number}@s.whatsapp.net`;
  
  if (tipo === 'image' && url_midia) {
    await sock.sendMessage(jid, { image: { url: url_midia }, caption: text });
  } else if (tipo === 'video' && url_midia) {
    await sock.sendMessage(jid, { video: { url: url_midia }, caption: text });
  } else if (tipo === 'audio' && url_midia) {
    await sock.sendMessage(jid, { audio: { url: url_midia }, mimetype: 'audio/mp4', ptt: true });
  } else {
    await sock.sendMessage(jid, { text });
  }
}

/** Envia mídia a partir de um arquivo local (buffer) */
export async function sendWhatsAppMediaFile(
  number: string,
  filePath: string,
  mimetype: string,
  caption: string,
  tipo: string
) {
  if (!sock?.user) throw new Error("WhatsApp não está conectado.");
  
  const fs = await import('fs');
  const buffer = fs.readFileSync(filePath);
  const jid = `${number}@s.whatsapp.net`;
  
  if (tipo === 'image') {
    await sock.sendMessage(jid, { image: buffer, mimetype, caption: caption || undefined });
  } else if (tipo === 'video') {
    await sock.sendMessage(jid, { video: buffer, mimetype, caption: caption || undefined });
  } else if (tipo === 'audio') {
    await sock.sendMessage(jid, { audio: buffer, mimetype: mimetype || 'audio/mp4', ptt: true });
  } else {
    await sock.sendMessage(jid, { document: buffer, mimetype, fileName: `arquivo.${mimetype.split('/')[1] || 'bin'}` });
  }
}
