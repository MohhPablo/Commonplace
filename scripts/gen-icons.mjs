// Generates the PWA icon PNGs (192, 512, 512-maskable, 180 apple-touch).
// Run once: `node scripts/gen-icons.mjs`. Avoids binary assets in the repo.
import { PNG } from "pngjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

const PAPER = [0xfa, 0xf6, 0xef];
const INK = [0x2b, 0x24, 0x20];
const TERRA = [0xc1, 0x50, 0x2d];

function makeIcon(size, maskable) {
  const png = new PNG({ width: size, height: size });
  const bg = maskable ? INK : PAPER;
  const inset = maskable ? Math.round(size * 0.1) : 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      const inSafe =
        x >= inset && x < size - inset && y >= inset && y < size - inset;
      if (maskable && !inSafe) {
        png.data[idx + 3] = 0;
        continue;
      }
      png.data[idx] = bg[0];
      png.data[idx + 1] = bg[1];
      png.data[idx + 2] = bg[2];
      png.data[idx + 3] = 255;
    }
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.12;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - (cy - size * 0.04);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r) {
        const idx = (size * y + x) << 2;
        png.data[idx] = TERRA[0];
        png.data[idx + 1] = TERRA[1];
        png.data[idx + 2] = TERRA[2];
        png.data[idx + 3] = 255;
      }
    }
  }
  const ruleW = size * 0.34;
  const ruleY = Math.round(cy + size * 0.22);
  const rx0 = Math.round(cx - ruleW / 2);
  const rx1 = Math.round(cx + ruleW / 2);
  for (let x = rx0; x < rx1; x++) {
    const idx = (size * ruleY + x) << 2;
    png.data[idx] = INK[0];
    png.data[idx + 1] = INK[1];
    png.data[idx + 2] = INK[2];
    png.data[idx + 3] = 255;
  }

  return PNG.sync.write(png);
}

writeFileSync(join(OUT, "icon-192.png"), makeIcon(192, false));
writeFileSync(join(OUT, "icon-512.png"), makeIcon(512, false));
writeFileSync(join(OUT, "icon-512-maskable.png"), makeIcon(512, true));
writeFileSync(join(OUT, "apple-touch-icon-180.png"), makeIcon(180, false));
console.log("Icons written to", OUT);
