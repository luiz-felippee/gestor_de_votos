import { Router } from 'express';
import { prisma } from '../prismaClient';
import { wrap, requireAuth } from '../middlewares';
import axios from 'axios';

const whatsappRouter = Router();
whatsappRouter.use(requireAuth);

// Fallbacks globais caso a campanha ainda não tenha configurado o servidor Evolution.
const EVOLUTION_API_URL_FALLBACK = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_GLOBAL_KEY_FALLBACK = process.env.EVOLUTION_API_KEY || '';

type CampanhaEvo = {
  id: string;
  evo_api_url: string | null;
  evo_global_key: string | null;
  evo_instance_name: string | null;
  evo_api_token: string | null;
};

// Resolve a configuração da Evolution: usa o que a campanha salvou; se vazio, cai no .env.
function resolverConfig(campanha: CampanhaEvo | null) {
  const url = (campanha?.evo_api_url || EVOLUTION_API_URL_FALLBACK).replace(/\/+$/, '');
  const key = campanha?.evo_global_key || EVOLUTION_GLOBAL_KEY_FALLBACK;
  return { url, key };
}

async function getCampanha(campanha_id: string): Promise<CampanhaEvo | null> {
  return prisma.campanha.findUnique({
    where: { id: campanha_id },
    select: {
      id: true,
      evo_api_url: true,
      evo_global_key: true,
      evo_instance_name: true,
      evo_api_token: true,
    },
  });
}

/**
 * 0. GET /whatsapp/config
 * Retorna a configuração atual da Evolution (sem expor a chave inteira).
 */
whatsappRouter.get(
  '/config',
  wrap(async (req, res) => {
    const campanha_id = req.user?.campanha_id;
    if (!campanha_id) return res.status(403).json({ error: 'Campanha não encontrada.' });

    const campanha = await getCampanha(campanha_id);
    return res.json({
      evo_api_url: campanha?.evo_api_url || '',
      // Nunca devolvemos a chave em texto; só sinalizamos se já existe alguma configurada.
      evo_global_key_set: !!campanha?.evo_global_key,
      instance_name: campanha?.evo_instance_name || null,
    });
  })
);

/**
 * 0b. POST /whatsapp/config
 * Salva a URL do servidor Evolution e a API Key global da campanha.
 */
whatsappRouter.post(
  '/config',
  wrap(async (req, res) => {
    const campanha_id = req.user?.campanha_id;
    if (!campanha_id) return res.status(403).json({ error: 'Campanha não encontrada.' });

    const { evo_api_url, evo_global_key } = req.body as {
      evo_api_url?: string;
      evo_global_key?: string;
    };

    if (!evo_api_url || typeof evo_api_url !== 'string') {
      return res.status(400).json({ error: 'A URL do servidor Evolution é obrigatória.' });
    }

    const data: Record<string, string> = {
      evo_api_url: evo_api_url.trim().replace(/\/+$/, ''),
    };
    // Só sobrescreve a chave se o usuário digitou uma nova (campo vazio = mantém a atual).
    if (evo_global_key && evo_global_key.trim()) {
      data.evo_global_key = evo_global_key.trim();
    }

    await prisma.campanha.update({ where: { id: campanha_id }, data });
    return res.json({ success: true });
  })
);

/**
 * 1. GET /whatsapp/status
 * Verifica o status da conexão da instância da campanha atual.
 */
whatsappRouter.get(
  '/status',
  wrap(async (req, res) => {
    const campanha_id = req.user?.campanha_id;
    if (!campanha_id) return res.status(403).json({ error: 'Campanha não encontrada.' });

    const campanha = await getCampanha(campanha_id);
    if (!campanha || !campanha.evo_instance_name) {
      return res.json({ status: 'unpaired' });
    }

    const { url, key } = resolverConfig(campanha);

    try {
      const response = await axios.get(`${url}/instance/connectionState/${campanha.evo_instance_name}`, {
        headers: { apikey: key },
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

    let campanha = await getCampanha(campanha_id);
    const { url, key } = resolverConfig(campanha);

    if (!key) {
      return res.status(400).json({
        error: 'Configure a URL e a API Key do servidor Evolution antes de conectar.',
      });
    }

    let instanceName = campanha?.evo_instance_name;

    // Se ainda não tem instância, gera um nome único e salva no banco.
    if (!instanceName) {
      instanceName = `campanha_${campanha_id.split('-')[0]}_${Date.now()}`;
      campanha = await prisma.campanha.update({
        where: { id: campanha_id },
        data: { evo_instance_name: instanceName },
        select: {
          id: true,
          evo_api_url: true,
          evo_global_key: true,
          evo_instance_name: true,
          evo_api_token: true,
        },
      });
    }

    // Helper: pede o QR Code de uma instância já existente.
    const conectarInstancia = async () => {
      const connectResponse = await axios.get(`${url}/instance/connect/${instanceName}`, {
        headers: { apikey: key },
      });
      const qr =
        connectResponse.data?.qrcode?.base64 ||
        connectResponse.data?.base64 ||
        connectResponse.data?.code;
      return qr;
    };

    try {
      // Tenta criar a instância. O 'qrcode: true' já devolve a imagem na criação.
      const createResponse = await axios.post(
        `${url}/instance/create`,
        {
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        },
        { headers: { apikey: key } }
      );

      const token = createResponse.data?.hash?.apikey || createResponse.data?.hash || createResponse.data?.Auth?.apikey;
      let qrcode = createResponse.data?.qrcode?.base64 || createResponse.data?.base64;

      // Salva o token de segurança da instância no banco.
      if (token && typeof token === 'string') {
        await prisma.campanha.update({
          where: { id: campanha_id },
          data: { evo_api_token: token },
        });
      }

      // Se por algum motivo não veio o QR na criação, pede via connect.
      if (!qrcode) {
        qrcode = await conectarInstancia();
      }

      return res.json({ qrcode, message: 'Leia o QR Code para conectar' });
    } catch (error: any) {
      // Instância já existe: apenas pedimos o QR de conexão.
      const msg = String(error?.response?.data?.message || error?.response?.data?.error || '');
      const jaExiste = error?.response?.status === 403 || /already|exists|in use|já existe/i.test(msg);

      if (jaExiste) {
        try {
          const qrcode = await conectarInstancia();
          return res.json({ qrcode, message: 'Leia o QR Code para conectar' });
        } catch (innerError) {
          return res.status(500).json({ error: 'Erro ao gerar QR Code de conexão.' });
        }
      }
      return res.status(500).json({
        error: msg || 'Falha ao criar instância no Evolution. Verifique a URL e a API Key.',
      });
    }
  })
);

/**
 * 2b. POST /whatsapp/disconnect
 * Desconecta (logout) a instância da campanha, permitindo parear outro número.
 */
whatsappRouter.post(
  '/disconnect',
  wrap(async (req, res) => {
    const campanha_id = req.user?.campanha_id;
    if (!campanha_id) return res.status(403).json({ error: 'Campanha não encontrada.' });

    const campanha = await getCampanha(campanha_id);
    if (!campanha?.evo_instance_name) return res.json({ success: true });

    const { url, key } = resolverConfig(campanha);
    try {
      await axios.delete(`${url}/instance/logout/${campanha.evo_instance_name}`, {
        headers: { apikey: key },
      });
    } catch {
      // Ignora — pode já estar desconectada.
    }
    return res.json({ success: true });
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

    const campanha = await getCampanha(campanha_id);
    if (!campanha || !campanha.evo_instance_name) {
      return res.status(400).json({ error: 'WhatsApp não está conectado.' });
    }

    const { url, key } = resolverConfig(campanha);

    try {
      await axios.post(
        `${url}/message/sendText/${campanha.evo_instance_name}`,
        {
          number: numero,
          text: texto,
          delay: 1200, // simula digitação
        },
        {
          headers: { apikey: campanha.evo_api_token || key },
        }
      );

      return res.json({ success: true });
    } catch (error: any) {
      return res
        .status(500)
        .json({ error: error.response?.data?.message || 'Falha ao enviar mensagem.' });
    }
  })
);

export default whatsappRouter;
