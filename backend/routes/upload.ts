/**
 * Rota de Upload genérico (autenticado + validação de tipo).
 * Extraída do server.ts para melhor organização.
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';


const router = Router();

// --- Configuração do Multer ---
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Usar memory storage em vez de disk storage para podermos comprimir a imagem antes de salvar
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
    // Gerar um nome único com extensão webp
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
    const outputPath = path.join(uploadsDir, filename);

    // Comprimir a imagem usando Sharp:
    // 1. Redimensiona para no máximo 800px de largura/altura mantendo a proporção (sem esticar)
    // 2. Converte sempre para WebP com qualidade 80 para drástica redução de peso
    await sharp(req.file.buffer)
      .resize(800, 800, {
        fit: 'inside', // Garante que a imagem caiba numa caixa 800x800, sem cortar e sem distorcer
        withoutEnlargement: true // Não aumenta imagens que já são menores que 800px
      })
      .webp({ quality: 80 })
      .toFile(outputPath);

    res.json({ url: `/uploads/${filename}` });
  } catch (error) {
    console.error('Erro ao processar imagem:', error);
    res.status(500).json({ error: 'Erro ao processar e salvar a imagem.' });
  }
});

export default router;
