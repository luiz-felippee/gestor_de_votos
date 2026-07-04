/**
 * Rota de Upload genérico (autenticado + validação de tipo).
 * 
 * As imagens são comprimidas com Sharp e retornadas como Data URLs (Base64)
 * para serem salvas diretamente no banco de dados. Isso evita o problema de
 * perda de arquivos em plataformas com filesystem efêmero (Render, Railway, etc.).
 */
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';

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

    // Converter para Data URL Base64 — armazenável diretamente no banco
    const base64 = compressedBuffer.toString('base64');
    const dataUrl = `data:image/webp;base64,${base64}`;

    res.json({ url: dataUrl });
  } catch (error) {
    console.error('Erro ao processar imagem:', error);
    res.status(500).json({ error: 'Erro ao processar e salvar a imagem.' });
  }
});

export default router;
