#!/usr/bin/env node
/**
 * Generate favicon assets from favicon.svg.
 *
 * Outputs (written to repo root alongside favicon.svg):
 *   - favicon.ico               48x48 PNG bytes written with .ico extension
 *                               (sharp 0.34.x does not support native ICO output;
 *                               browsers accept PNG data under .ico)
 *   - apple-touch-icon.png       180x180
 *   - apple-touch-icon-precomposed.png  180x180 (iOS Safari fallback, duplicate)
 *   - favicon-32x32.png          32x32
 *   - favicon-16x16.png          16x16
 *
 * Backgrounds: solid dark chocolate (#110D08) so the logo reads crisp on
 * both light and dark browser chrome.
 */

import sharp from 'sharp';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'favicon.svg');
const BG = { r: 0x11, g: 0x0d, b: 0x08, alpha: 1 }; // #110D08 dark chocolate

async function renderPng(size) {
  const svg = await readFile(SRC);
  // Render the SVG at the target size and flatten onto solid dark-chocolate bg.
  return sharp(svg, { density: 384 }) // high density so small sizes stay crisp
    .resize(size, size, { fit: 'contain', background: BG })
    .flatten({ background: BG })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function writeOut(filename, buf) {
  const outPath = join(ROOT, filename);
  await writeFile(outPath, buf);
  const { size } = await stat(outPath);
  console.log(`  ${outPath}  (${size} bytes)`);
  return { path: outPath, size };
}

async function main() {
  console.log(`source: ${SRC}`);
  console.log('outputs:');

  const [p16, p32, p48, p180] = await Promise.all([
    renderPng(16),
    renderPng(32),
    renderPng(48),
    renderPng(180),
  ]);

  // favicon.ico — PNG bytes under .ico extension (sharp has no native ICO encoder).
  await writeOut('favicon.ico', p48);
  await writeOut('favicon-16x16.png', p16);
  await writeOut('favicon-32x32.png', p32);
  await writeOut('apple-touch-icon.png', p180);
  await writeOut('apple-touch-icon-precomposed.png', p180);

  console.log('\nNote: favicon.ico is a 48x48 PNG with .ico extension');
  console.log('(sharp 0.34.x does not support native .ico output).');
  console.log('Modern browsers accept PNG data under the .ico filename.');
}

main().catch((err) => {
  console.error('favicon generation failed:', err);
  process.exit(1);
});
