import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateIcons() {
  const svgPath = path.resolve('public', 'favicon.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  console.log('Generating icon-192.png...');
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.resolve('public', 'icon-192.png'));

  console.log('Generating icon-512.png...');
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.resolve('public', 'icon-512.png'));

  console.log('Done!');
}

generateIcons().catch(console.error);
