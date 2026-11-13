// Writes an SVG atlas page plus a JSON manifest of crop rectangles.
// New-MeniscusAssets.ps1 rasterizes the page with headless Edge and cuts it
// into the PNG resources. Usage: node build-assets.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';
import * as G from './geometry.mjs';

const outDir = process.argv[2];
if (!outDir) throw new Error('Usage: node build-assets.mjs <outDir>');
fs.mkdirSync(outDir, { recursive: true });

const S = G.RASTER_SCALE;
const cellW = Math.round(G.GLYPH_CELL.w * S), cellH = Math.round(G.GLYPH_CELL.h * S);
const iconPx = G.ICON_SIZE * G.ICON_SCALE;
const pitchX = cellW + 8, pitchY = cellH + 8;
const crops = [];
let body = '';

function glyph(ch, x, y, outline) {
  const t = `translate(${x},${y}) scale(${S}) translate(${G.GLYPH_CELL.ox},${G.GLYPH_CELL.oy})`;
  const common = `d="${G.GLYPH[ch]}" fill="none" stroke-linecap="square" stroke-linejoin="round"`;
  if (!outline) return `<path transform="${t}" ${common} stroke="#fff" stroke-width="${G.GLYPH_STROKE}"/>`;
  const id = `m${ch}`;
  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${cellW}" height="${cellH}">` +
    `<path transform="${t}" ${common} stroke="#fff" stroke-width="${G.GLYPH_STROKE}"/>` +
    `<path transform="${t}" ${common} stroke="#000" stroke-width="${G.GLYPH_OUTLINE_INNER}"/></mask>` +
    `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="#fff" mask="url(#${id})"/>`;
}

const digits = Object.keys(G.GLYPH);
digits.forEach((ch, i) => {
  const x = 4 + i * pitchX;
  body += glyph(ch, x, 4, false);
  crops.push({ name: `num_${ch}`, x, y: 4, w: cellW, h: cellH });
  body += glyph(ch, x, 4 + pitchY, true);
  crops.push({ name: `num_outline_${ch}`, x, y: 4 + pitchY, w: cellW, h: cellH });
});
Object.entries(G.WEATHER_ICONS).forEach(([name, markup], i) => {
  const x = 4 + i * (iconPx + 8), y = 4 + 2 * pitchY;
  body += `<g transform="translate(${x},${y}) scale(${G.ICON_SCALE})" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${markup}</g>`;
  crops.push({ name, x, y, w: iconPx, h: iconPx });
});

// App icon: a small fluid core, transparent outside the circle.
const appIcon = 96, iconY = 4 + 2 * pitchY + iconPx + 8, [hi, mid, lo] = G.THEMES[0].colors;
body += `<defs><linearGradient id="appFluid" x1="0" y1="52" x2="0" y2="92" gradientUnits="userSpaceOnUse">` +
  `<stop offset="0" stop-color="${hi}"/><stop offset="0.35" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>` +
  `<clipPath id="appClip"><circle cx="48" cy="48" r="40"/></clipPath></defs>` +
  `<g transform="translate(4,${iconY})"><circle cx="48" cy="48" r="46" fill="#05080B"/>` +
  `<g clip-path="url(#appClip)"><circle cx="48" cy="48" r="40" fill="#0C1820"/>` +
  `<rect x="-20" y="50" width="136" height="80" fill="url(#appFluid)" transform="rotate(-12 48 48)"/></g>` +
  `<circle cx="48" cy="48" r="42.5" fill="none" stroke="#8E9BA6" stroke-width="4"/></g>`;
crops.push({ name: 'ic_meniscus', x: 4, y: iconY, w: appIcon, h: appIcon });

const width = Math.max(4 + digits.length * pitchX, 4 + Object.keys(G.WEATHER_ICONS).length * (iconPx + 8));
const height = iconY + appIcon + 4;
fs.writeFileSync(path.join(outDir, 'atlas.html'),
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style></head>` +
  `<body><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg></body></html>`);
fs.writeFileSync(path.join(outDir, 'atlas.json'), JSON.stringify({ width, height, crops }, null, 1));
console.log(`atlas ${width}x${height}, ${crops.length} crops`);
