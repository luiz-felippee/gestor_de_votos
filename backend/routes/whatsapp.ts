import { Router } from 'express';
import { prisma } from '../prismaClient';
import { wrap, requireAuth, escopoCampanha } from '../middlewares';
import axios from 'axios';

const whatsappRouter = Router();
whatsappRouter.use(requireAuth);

// Evolution API Global Settings (Configurado no .env do backend)
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_GLOBAL_API_KEY = process.env.EVOLUTION_API_KEY || 'SUA_CHAVE_GLOBAL_AQUI';

/**
 * 1. GET /whatsapp/status
 * Verifica o status da conexão da instância da campanha atual.
 */
whatsappRouter.get(
  '/status',
  wrap(async (req, res) => {
    const campanha_id = req.user?.campanha_id;
    if (!campanha_id) return res.status(403).json({ error: 'Campanha não encontrada.' });

    const campanha = await prisma.campanha.findUnique({ where: { id: campanha_id } });
    if (!campanha || !campanha.evo_instance_name) {
      return res.json({ status: 'unpaired' });
    }

    try {
      const response = await axios.get(`${EVOLUTION_API_URL}/instance/connectionState/${campanha.evo_instance_name}`, {
        headers: { apikey: EVOLUTION_GLOBAL_API_KEY }
      });
      
      const status = response.data?.instance?.state || response.data?.state || 'unpaired';
      return res.json({ status });
    } catch (error) {
      // Se a instância não existe na API, assumimos como desconectado
      return res.json({ status: 'unpaired' });
    }
  })
);

/**
 * 2. POST /whatsapp/connect
 * Cria a instância (se não existir) e retorna o QR Code em base64.
 */
whatsappRouter.post(
  '/connect',
  wrap(async (req, res) => {
    const campanha_id = req.user?.campanha_id;
    if (!campanha_id) return res.status(403).json({ error: 'Campanha não encontrada.' });

    let campanha = await prisma.campanha.findUnique({ where: { id: campanha_id } });
    let instanceName = campanha?.evo_instance_name;

    // Se ainda não tem instância, vamos gerar um nome único
    if (!instanceName) {
      instanceName = `campanha_${campanha_id.split('-')[0]}_${Date.now()}`;
      
      // Salva no banco primeiro
      campanha = await prisma.campanha.update({
        where: { id: campanha_id },
        data: { evo_instance_name: instanceName }
      });
    }

    try {
      // Tenta criar a instância na Evolution API. 
      // O 'qrcode: true' instrui a API a já devolver a imagem.
      const createResponse = await axios.post(`${EVOLUTION_API_URL}/instance/create`, {
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      }, {
        headers: { apikey: EVOLUTION_GLOBAL_API_KEY }
      });

      // Pega o token gerado para essa instância e o QR Code
      const token = createResponse.data?.hash?.apikey || createResponse.data?.Auth?.apikey;
      const qrcode = createResponse.data?.qrcode?.base64 || createResponse.data?.base64;

      // Salva o token de segurança no banco
      if (token) {
        await prisma.campanha.update({
          where: { id: campanha_id },
          data: { evo_api_token: token }
        });
      }

      return res.json({ qrcode, message: 'Leia o QR Code para conectar' });

    } catch (error: any) {
      // Se a instância já existe, nós pedimos apenas a conexão/QR code
      if (error.response?.data?.message?.includes('already exists')) {
        try {
          const connectResponse = await axios.get(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
            headers: { apikey: EVOLUTION_GLOBAL_API_KEY }
          });
          return res.json({ qrcode: connectResponse.data?.base64 });
        } catch (innerError) {
          return res.status(500).json({ error: 'Erro ao gerar QR Code de conexão.' });
        }
      }
      return res.status(500).json({ error: 'Falha ao criar instância no Evolution.' });
    }
  })
);

/**
 * 3. POST /whatsapp/send
 * Dispara uma mensagem de texto imediatamente.
 */
whatsappRouter.post(
  '/send',
  wrap(async (req, res) => {
    const campanha_id = req.user?.campanha_id;
    if (!campanha_id) return res.status(403).json({ error: 'Campanha não encontrada.' });

    const { numero, texto } = req.body;
    if (!numero || !texto) return res.status(400).json({ error: 'Número e texto são obrigatórios.' });

    const campanha = await prisma.campanha.findUnique({ where: { id: campanha_id } });
    if (!campanha || !campanha.evo_instance_name) {
      return res.status(400).json({ error: 'WhatsApp não está conectado.' });
    }

    try {
      // Tenta enviar
      await axios.post(`${EVOLUTION_API_URL}/message/sendText/${campanha.evo_instance_name}`, {
        number: numero,
        text: texto,
        delay: 1200 // Espera 1.2 segundos para simular digitação
      }, {
        headers: { 
          apikey: campanha.evo_api_token || EVOLUTION_GLOBAL_API_KEY 
        }
      });

      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.response?.data?.message || 'Falha ao enviar mensagem.' });
    }
  })
);

export default whatsappRouter;
