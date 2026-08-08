// Generates site/icons/icon-192.png and icon-512.png. Run once: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) raw.set(pixel(x, y), row + 1 + x * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [41, 37, 36, 255];       // warm charcoal
const PLATE = [245, 240, 234, 255]; // cream
const SOUP = [194, 65, 12, 255];    // burnt orange
const BASIL = [101, 163, 13, 255];  // green

function draw(size) {
  const c = size / 2;
  const inside = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2;
  return png(size, (x, y) => {
    if (inside(x, y, c, c, size * 0.31)) {
      if (inside(x, y, size * 0.60, size * 0.42, size * 0.055)) return BASIL;
      if (inside(x, y, size * 0.52, size * 0.52, size * 0.035)) return BASIL;
      return SOUP;
    }
    if (inside(x, y, c, c, size * 0.40)) return PLATE;
    return BG;
  });
}

mkdirSync('site/icons', { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`site/icons/icon-${size}.png`, draw(size));
  console.log(`site/icons/icon-${size}.png`);
}
