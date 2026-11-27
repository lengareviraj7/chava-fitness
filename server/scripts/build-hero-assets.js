import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const srcDir = path.join(rootDir, 'client/public/assets/hero/src');
const outDir = path.join(rootDir, 'client/public/assets/hero');
const originalFile = path.join(srcDir, 'dashboard-bg-original.png');
const fallbackSource = path.join(rootDir, 'docs/design/dashboard-reference-v2.png');

const out2000 = path.join(outDir, 'dashboard-bg-2000.webp');
const out800 = path.join(outDir, 'dashboard-bg-800.webp');

const BUDGET_2000_BYTES = 220 * 1024; // 225,280 bytes
const BUDGET_800_BYTES = 90 * 1024;   // 92,160 bytes

async function compressToBudget(imagePipeline, targetWidth, maxBytes, initialQuality = 85) {
  let quality = initialQuality;
  let buffer;

  while (quality >= 30) {
    buffer = await imagePipeline
      .clone()
      .resize({ width: targetWidth, withoutEnlargement: false })
      .webp({ quality, effort: 6 })
      .toBuffer();

    if (buffer.length <= maxBytes) {
      return { buffer, quality, size: buffer.length };
    }
    quality -= 5;
  }

  // Final fallback to lowest quality if tight
  return { buffer, quality, size: buffer.length };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(srcDir, { recursive: true });

  let inputFile = originalFile;
  if (!fs.existsSync(originalFile)) {
    if (fs.existsSync(fallbackSource)) {
      console.log(`Original not found at ${originalFile}. Using fallback reference design ${fallbackSource}`);
      inputFile = fallbackSource;
    } else {
      console.warn(`No input artwork found at ${originalFile}. Please add original image to ${originalFile}`);
      return;
    }
  }

  console.log(`Reading source image: ${inputFile}`);
  const baseSharp = sharp(inputFile);
  const metadata = await baseSharp.metadata();
  console.log(`Source image dimensions: ${metadata.width}x${metadata.height}`);

  // Build 2000px WebP (<220 KB)
  console.log('Generating dashboard-bg-2000.webp (budget: 220 KB)...');
  const res2000 = await compressToBudget(baseSharp, 2000, BUDGET_2000_BYTES, 82);
  fs.writeFileSync(out2000, res2000.buffer);
  console.log(`✅ Saved ${out2000} (${(res2000.size / 1024).toFixed(1)} KB, quality=${res2000.quality})`);

  // Build 800px WebP (<90 KB)
  console.log('Generating dashboard-bg-800.webp (budget: 90 KB)...');
  const res800 = await compressToBudget(baseSharp, 800, BUDGET_800_BYTES, 80);
  fs.writeFileSync(out800, res800.buffer);
  console.log(`✅ Saved ${out800} (${(res800.size / 1024).toFixed(1)} KB, quality=${res800.quality})`);

  // Validate budgets
  if (res2000.size > BUDGET_2000_BYTES) {
    throw new Error(`dashboard-bg-2000.webp exceeds 220 KB limit: ${res2000.size} bytes`);
  }
  if (res800.size > BUDGET_800_BYTES) {
    throw new Error(`dashboard-bg-800.webp exceeds 90 KB limit: ${res800.size} bytes`);
  }

  console.log('🎉 Hero assets successfully generated within size budgets!');
}

main().catch((err) => {
  console.error('Error generating hero assets:', err);
  process.exit(1);
});
