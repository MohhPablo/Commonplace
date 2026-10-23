// Generates the app icon (SVG master + PNG sizes) and the iOS launch images.
// Run after changing the artwork:
//   npm i --no-save playwright && node scripts/gen-icons.mjs
// It rasterises with Chromium, so the PNGs match the SVG exactly. The output is
// committed; the build never runs this script.
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ICONS = join(ROOT, "public", "icons");
const SPLASH = join(ROOT, "public", "splash");
mkdirSync(ICONS, { recursive: true });
mkdirSync(SPLASH, { recursive: true });

// A warm, lit page with a ribbon bookmark: a commonplace book at a glance.
// `scale` shrinks the artwork into the maskable safe zone.
function iconSvg(scale = 1) {
  const glyph = `translate(512 512) scale(${scale}) translate(-512 -512)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="cp-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FF9A62"/>
      <stop offset="0.48" stop-color="#E5582F"/>
      <stop offset="1" stop-color="#A9321A"/>
    </linearGradient>
    <radialGradient id="cp-glow" cx="0.28" cy="0.06" r="0.85">
      <stop offset="0" stop-color="#FFF4E8" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#FFF4E8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cp-page" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#F7EDE6"/>
    </linearGradient>
    <linearGradient id="cp-ribbon" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#D9482A"/>
      <stop offset="1" stop-color="#9C2B14"/>
    </linearGradient>
    <filter id="cp-shadow" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="28" stdDeviation="30" flood-color="#5C1A08" flood-opacity="0.38"/>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#cp-bg)"/>
  <rect width="1024" height="1024" fill="url(#cp-glow)"/>
  <g transform="${glyph}">
    <rect x="300" y="236" width="424" height="566" rx="58" fill="#FFFFFF" fill-opacity="0.32" transform="rotate(-11 512 520)"/>
    <g filter="url(#cp-shadow)" transform="rotate(4 512 512)">
      <rect x="292" y="214" width="440" height="596" rx="60" fill="url(#cp-page)"/>
      <circle cx="378" cy="338" r="30" fill="#E5582F"/>
      <rect x="358" y="440" width="292" height="28" rx="14" fill="#EBDDD3"/>
      <rect x="358" y="512" width="244" height="28" rx="14" fill="#EBDDD3"/>
      <rect x="358" y="584" width="276" height="28" rx="14" fill="#EBDDD3"/>
      <rect x="358" y="656" width="160" height="28" rx="14" fill="#EBDDD3"/>
      <path d="M586 196 H664 V436 L625 404 L586 436 Z" fill="url(#cp-ribbon)"/>
    </g>
  </g>
</svg>
`;
}

// Launch images must match each device's portrait resolution exactly.
const DEVICES = [
  [440, 956, 3],
  [430, 932, 3],
  [428, 926, 3],
  [420, 912, 3],
  [414, 896, 3],
  [414, 896, 2],
  [402, 874, 3],
  [393, 852, 3],
  [390, 844, 3],
  [375, 812, 3],
  [375, 667, 2],
];
const THEMES = {
  light: { bg: "#F3F1EE", ink: "#1D1D1F" },
  dark: { bg: "#000000", ink: "#F5F5F7" },
};

const svg = iconSvg();
writeFileSync(join(ICONS, "icon.svg"), svg);
const dataUrl = (markup) =>
  `data:image/svg+xml;base64,${Buffer.from(markup).toString("base64")}`;
const inter = readFileSync(
  join(
    ROOT,
    "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  ),
).toString("base64");

const browser = await chromium.launch();
async function render(html, width, height, scale, file) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: scale,
  });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file });
  await page.close();
}
const iconPage = (markup, size) =>
  `<style>*{margin:0}img{display:block;width:${size}px;height:${size}px}</style><img src="${dataUrl(markup)}">`;

for (const [name, size, markup] of [
  ["icon-192.png", 192, svg],
  ["icon-512.png", 512, svg],
  ["apple-touch-icon-180.png", 180, svg],
  ["icon-512-maskable.png", 512, iconSvg(0.8)],
])
  await render(iconPage(markup, size), size, size, 1, join(ICONS, name));

// Mirrors #boot-splash in index.html so launch, boot and the animated splash line up.
const links = [];
for (const [width, height, ratio] of DEVICES)
  for (const [theme, colors] of Object.entries(THEMES)) {
    const file = `launch-${width * ratio}x${height * ratio}-${theme}.png`;
    await render(
      `<style>
        @font-face{font-family:Inter;src:url(data:font/woff2;base64,${inter}) format("woff2");font-weight:100 900}
        *{margin:0}
        body{width:100vw;height:100vh;background:${colors.bg};font-family:Inter,sans-serif}
        img{position:absolute;left:50%;top:50%;width:104px;height:104px;margin:-76px 0 0 -52px;border-radius:23.5px}
        p{position:absolute;left:0;right:0;top:50%;margin-top:48px;text-align:center;font-size:22px;font-weight:650;letter-spacing:-0.02em;color:${colors.ink}}
        span{color:#E5582F}
      </style><img src="${dataUrl(svg)}"><p>Commonplace<span>.</span></p>`,
      width,
      height,
      ratio,
      join(SPLASH, file),
    );
    links.push(
      `    <link rel="apple-touch-startup-image" media="(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait) and (prefers-color-scheme: ${theme})" href="/splash/${file}" />`,
    );
  }
await browser.close();

const indexPath = join(ROOT, "index.html");
const index = readFileSync(indexPath, "utf8");
const start = "<!-- startup-images:start -->";
const end = "<!-- startup-images:end -->";
if (!index.includes(start) || !index.includes(end))
  throw new Error("index.html is missing the startup-images markers.");
writeFileSync(
  indexPath,
  index.replace(
    new RegExp(`${start}[\\s\\S]*${end}`),
    `${start}\n${links.join("\n")}\n    ${end}`,
  ),
);
console.log("Icons and launch images written.");
