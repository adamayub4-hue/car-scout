// Regenerate checked-in browser/app icons from the existing Mekivo SVG mark.
// Run from any directory: node scripts/generate-brand-icons.mjs
// Uses Sharp already installed with Next.js; no external assets or font lookup.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('app/icon.svg', root));
const faviconSizes = [16, 32, 48, 64, 128, 256];

async function raster(size, opaque = false) {
  let image = sharp(source, { density: 576 }).resize(size, size).ensureAlpha();
  if (opaque) image = image.flatten({ background: '#06101f' });
  return image.png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();
}

// ICO directories may contain PNG-encoded frames. Every frame retains the same
// mark and has an explicit size, including a 48px option for search favicons.
const frames = await Promise.all(faviconSizes.map((size) => raster(size)));
const directory = Buffer.alloc(6 + frames.length * 16);
directory.writeUInt16LE(1, 2); // resource type: icon
directory.writeUInt16LE(frames.length, 4);
let offset = directory.length;
frames.forEach((frame, index) => {
  const entry = 6 + index * 16;
  const size = faviconSizes[index];
  directory[entry] = size === 256 ? 0 : size;
  directory[entry + 1] = size === 256 ? 0 : size;
  directory.writeUInt16LE(1, entry + 4); // colour planes
  directory.writeUInt16LE(32, entry + 6); // RGBA bits per pixel
  directory.writeUInt32LE(frame.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
await writeFile(new URL('app/favicon.ico', root), Buffer.concat([directory, ...frames]));

await mkdir(new URL('public/icons/', root), { recursive: true });
for (const [path, size, opaque] of [
  ['app/apple-icon.png', 180, true],
  ['public/icons/mekivo-192.png', 192, false],
  ['public/icons/mekivo-512.png', 512, false],
]) {
  await writeFile(new URL(path, root), await raster(size, opaque));
}

console.log('Generated Mekivo favicon (16–256px), Apple icon (180px), and app icons (192px/512px).');
