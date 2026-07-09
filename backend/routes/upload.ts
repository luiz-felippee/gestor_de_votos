/**
 * Rota de Upload genérico (autenticado + validação de tipo).
 *
 * As imagens são comprimidas com Sharp (WebP, máx. 800px) e então persistidas.
 * Ordem de destino (o primeiro configurado vence):
 *   1) Vercel Blob   — se BLOB_READ_WRITE_TOKEN estiver definido (recomendado)
 *   2) ImgBB         — se IMGBB_API_KEY estiver definido
 *   3) Base64 no banco — fallback; funciona sem config, mas pesa no Postgres.
 * Assim a imagem nunca depende do filesystem efêmero do Render.
 */
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';
import { getImgbbKey } from './config';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024 } // 64 MB max
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// POST /api/upload (Tornamos público para permitir upload durante o cadastro)
router.post('/upload', upload.single('foto'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }
  if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Tipo de arquivo não permitido. Envie apenas imagens (JPG, PNG, WebP, GIF).' });
  }

  try {
    // Comprimir a imagem usando Sharp:
    // 1. Redimensiona para no máximo 800px de largura/altura mantendo a proporção
    // 2. Converte sempre para WebP com qualidade 80 para drástica redução de peso
    const compressedBuffer = await sharp(req.file.buffer)
      .resize(800, 800, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toBuffer();

    // 1) Vercel Blob (prioridade): guarda o arquivo e retorna um link permanente.
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { url } = await put(`fotos/${randomUUID()}.webp`, compressedBuffer, {
          access: 'public',
          contentType: 'image/webp',
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        return res.json({ url });
      } catch (blobError) {
        console.error('Falha ao enviar para o Vercel Blob, tentando próximo destino:', blobError);
      }
    }

    const base64 = compressedBuffer.toString('base64');

    // 2) ImgBB, se a chave estiver presente (env IMGBB_API_KEY ou config do app)
    const imgbbKey = await getImgbbKey();
    if (imgbbKey) {
      try {
        const params = new URLSearchParams();
        params.append('key', imgbbKey);
        params.append('image', base64);
        
        const response = await fetch('https://api.imgbb.com/1/upload', {
          method: 'POST',
          body: params
        });
        
        const imgbbData = await response.json();
        if (response.ok && imgbbData.data && imgbbData.data.url) {
          // Sucesso: retorna o link do ImgBB
          return res.json({ url: imgbbData.data.url });
        } else {
          console.error('Erro retornado pela API do ImgBB:', imgbbData);
        }
      } catch (uploadError) {
        console.error('Falha ao comunicar com ImgBB, fazendo fallback para Base64:', uploadError);
      }
    } else {
      console.warn('Atenção: nenhum storage de imagem configurado (Vercel Blob ou ImgBB). Fotos salvas em Base64 no banco (baixa performance).');
    }

    // Fallback: Data URL Base64 armazenável diretamente no banco
    const dataUrl = `data:image/webp;base64,${base64}`;

    res.json({ url: dataUrl });
  } catch (error) {
    console.error('Erro ao processar imagem:', error);
    res.status(500).json({ error: 'Erro ao processar e salvar a imagem.' });
  }
});

export default router;
