// Draws illustrative previews of the Apsis face from the shared geometry and
// rasterizes them with headless Microsoft Edge or Chrome:
//   node scripts/New-Preview.mjs
// Outputs the watch-face picker image and docs/previews/*.png. These are
// drawings with sample data, not device screenshots.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as G from './lib/apsis-geometry.mjs';

const { C, RF, RM, D, pt } = G;
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE = {
  temp: 64, hi: 68, lo: 51, hours: [63, 65, 66, 64, 61, 58, 56, 55], cond: [14, 14, 2, 12, 6, 6, 2, 1],
  rim: { 45: ['SUNSET', '4:52', null], 135: ['KCAL', '312', 0.69], 225: ['STEPS', '6,412', 0.8], 315: ['MIN', '38', 0.63] },
  battery: 0.84, date: 'FRI 13',
};
const f = n => n.toFixed(2);
const arcPath = (r, a0, a1, cx = C, cy = C) => {
  const p = pt(r, a0, cx, cy), q = pt(r, a1, cx, cy);
  return `M${f(p[0])} ${f(p[1])}A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${f(q[0])} ${f(q[1])}`;
};
const hex = c => '#' + c.slice(-6);
const alpha = c => parseInt(c.slice(1, 3), 16) / 255;

export function svg({ hour = 10, minute = 8, second = 32, theme = 0, ambient = false, lowBattery = false } = {}) {
  const t = G.THEMES[theme].colors, sat = hex(t[3]);
  const ha = (hour % 12) * 30 + minute * 0.5, ma = minute * 6;
  const rc = pt(D, ha), FONT = 'font-family="Oxanium, sans-serif"';
  const o = [];
  o.push(`<defs><linearGradient id="lune" gradientUnits="userSpaceOnUse" x1="${C}" y1="${C - RF}" x2="${C}" y2="${C + RF + 36}">` +
    [0, 0.5, 0.9].map((p, i) => `<stop offset="${p}" stop-color="${hex(t[i])}" stop-opacity="${f(alpha(t[i]))}"/>`).join('') +
    `</linearGradient><clipPath id="dial"><circle cx="${C}" cy="${C}" r="${C}"/></clipPath></defs>`);
  o.push(`<rect width="450" height="450" fill="#000"/><g clip-path="url(#dial)">`);
  if (!ambient) {
    for (let h = 0; h < 12; h++) { const a = pt(G.TICK_R0, h * 30), b = pt(G.TICK_R1, h * 30); o.push(`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="#7B8099" stroke-width="1.5"/>`); }
    SAMPLE.hours.forEach((temp, i) => {
      const k = Math.max(0, Math.min(1, (temp - SAMPLE.lo) / (SAMPLE.hi - SAMPLE.lo))), ang = (hour % 12 + i + 1) * 30;
      const len = G.BAR_MIN + G.BAR_SPAN * k, a = pt(G.BAR_R0, ang), b = pt(G.BAR_R0 + len, ang);
      const col = G.barColor(k).map(Math.round).join(',');
      o.push(`<g opacity="${f(1 - i * 0.085)}"><line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="rgb(${col})" stroke-width="5" stroke-linecap="round"/>`);
      if (G.WET.includes(SAMPLE.cond[i])) { const d = pt(G.BAR_R0 + len + G.DOT_GAP, ang); o.push(`<circle cx="${f(d[0])}" cy="${f(d[1])}" r="2" fill="#4FD8FF"/>`); }
      o.push('</g>');
    });
    for (const [n, a] of [['12', 0], ['3', 90], ['6', 180], ['9', 270]]) { const p = pt(G.NUMERAL_R, a); o.push(`<text x="${f(p[0])}" y="${f(p[1] + 5.5)}" text-anchor="middle" ${FONT} font-size="16" font-weight="500" fill="#7B8099">${n}</text>`); }
    G.RIM_SLOTS.forEach((s, i) => {
      const a = s.angle, top = G.isTop(a), [title, value, p] = SAMPLE.rim[a];
      const d = top ? arcPath(G.RIM_TEXT_TOP, a - 30, a + 30) : arcPath(G.RIM_TEXT_BOTTOM, a + 30, a - 30);
      o.push(`<path id="rim${i}" d="${d}" fill="none"/><text ${FONT} font-size="14.5" letter-spacing="1" fill="#E8EBF7"><textPath href="#rim${i}" startOffset="50%" text-anchor="middle"><tspan fill="#8187A3" font-weight="500">${title}  </tspan><tspan font-weight="700">${value}</tspan></textPath></text>`);
      if (p !== null) {
        const h = G.RIM_PROGRESS_HALF, s0 = top ? a - h : a + h, e = top ? a + h : a - h, pe = top ? s0 + 2 * h * p : s0 - 2 * h * p;
        o.push(`<path d="${arcPath(G.RIM_PROGRESS_R, s0, e)}" fill="none" stroke="#2A2E40" stroke-width="2.2" stroke-linecap="round"/><path d="${arcPath(G.RIM_PROGRESS_R, s0, pe)}" fill="none" stroke="#E8EBF7" stroke-width="2.2" stroke-linecap="round"/>`);
      }
    });
  }
  o.push(`<g transform="rotate(${ha} ${C} ${C})">`);
  if (!ambient) o.push(`<path fill-rule="evenodd" fill="url(#lune)" d="M${C} ${C - RF}a${RF} ${RF} 0 1 0 .01 0zM${C} ${C - RF}a${RM} ${RM} 0 1 0 .01 0z"/>`);
  o.push(`<path d="${arcPath(RF, -4.5, 4.5)}" fill="none" stroke="#FFF" stroke-width="6" stroke-linecap="round"/></g>`);
  o.push(`<circle cx="${C}" cy="${C}" r="${RF}" fill="none" stroke="#8E93AD" stroke-width="1" opacity="${ambient ? 0.43 : 0.9}"/>`);
  o.push(`<g transform="translate(${f(rc[0])} ${f(rc[1])})"><circle r="${RM}" fill="none" stroke="#CFD3E6" stroke-width="1.2" opacity="${ambient ? 0.6 : 1}"/>`);
  for (let m = 0; m < 60; m++) {
    const five = m % 5 === 0, quarter = m % 15 === 0;
    if (ambient && !five) continue;
    const a = pt(RM - (quarter ? 15 : five ? 11 : 6), m * 6, 0, 0), b = pt(RM - 1, m * 6, 0, 0);
    o.push(`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${five ? '#CFD3E6' : '#5D6279'}" stroke-width="${quarter ? 2.2 : 1.1}"/>`);
  }
  o.push(`<g transform="rotate(${ma})">`);
  if (!ambient) {
    for (let i = 0; i < 8; i++) o.push(`<path d="${arcPath(RM, -70 + i * 8.75, -70 + (i + 1) * 8.75 + 0.6, 0, 0)}" fill="none" stroke="${sat}" stroke-width="4" opacity="${f((i + 1) / 8 * 0.9)}"/>`);
    o.push(`<circle cy="${-RM}" r="14" fill="${sat}" opacity="0.16"/><circle cy="${-RM}" r="10" fill="${sat}" opacity="0.27"/>`);
  }
  o.push(`<circle cy="${-RM}" r="6.5" fill="${sat}"/></g>`);
  const tp = pt(G.TAG_R, ma, 0, 0), sp = pt(RM, ma, 0, 0), mp = pt(G.MOON_R, second * 6 + ma, sp[0], sp[1]);
  o.push(`<text x="${f(tp[0])}" y="${f(tp[1] + 6)}" text-anchor="middle" ${FONT} font-size="17" font-weight="700" fill="${sat}">${String(minute).padStart(2, '0')}</text>`);
  if (!ambient && !lowBattery) o.push(`<circle cx="${f(mp[0])}" cy="${f(mp[1])}" r="2.3" fill="#FFF"/>`);
  o.push('</g>');
  const level = lowBattery ? 0.09 : SAMPLE.battery;
  if (!ambient) {
    o.push(`<circle cx="${C}" cy="${C}" r="${G.BATTERY_R}" fill="none" stroke="#23273A" stroke-width="2.4"/><path d="${arcPath(G.BATTERY_R, 0, 360 * level)}" fill="none" stroke="${lowBattery ? '#FF453A' : '#E8EBF7'}" stroke-width="2.4" stroke-linecap="round"/>`);
    o.push(`<g fill="#C9CEE6"><circle cx="195.2" cy="194.2" r="3.2"/><circle cx="199" cy="191.5" r="4"/><circle cx="203" cy="193.8" r="3.2"/><rect x="193.4" y="193.8" width="11.4" height="3.6" rx="1.8"/></g>`);
    o.push(`<text x="211" y="196" ${FONT} font-size="13" font-weight="500" letter-spacing="0.6" fill="#9AA0BB">${SAMPLE.date}</text>`);
    o.push(`<text x="${C}" y="239" text-anchor="middle" ${FONT} font-size="44" font-weight="700" fill="#F3F5FF">${SAMPLE.temp}°</text>`);
    o.push(`<text x="${C}" y="261.5" text-anchor="middle" ${FONT} font-size="12" font-weight="500" fill="#9AA0BB">H ${SAMPLE.hi} · L ${SAMPLE.lo}</text>`);
  } else {
    o.push(`<text x="${C}" y="196" text-anchor="middle" ${FONT} font-size="13" font-weight="500" fill="#9AA0BB">${SAMPLE.date}</text>`);
  }
  o.push('</g>');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 450" width="450" height="450">${o.join('')}</svg>`;
}

function browser() {
  const candidates = [
    process.env.APSIS_BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ].filter(Boolean);
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) throw new Error('No Edge or Chrome found. Set APSIS_BROWSER to a Chromium executable.');
  return found;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const font = name => fs.readFileSync(path.join(root, 'watchface/src/main/res/font', name)).toString('base64');
  const css = `@font-face{font-family:Oxanium;font-weight:500;src:url(data:font/ttf;base64,${font('oxanium_medium.ttf')})}` +
    `@font-face{font-family:Oxanium;font-weight:700;src:url(data:font/ttf;base64,${font('oxanium_bold.ttf')})}html,body{margin:0;background:#000;overflow:hidden}svg{display:block}`;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'apsis-preview-'));
  const outputs = [
    ['watchface/src/main/res/drawable-nodpi/preview.png', {}],
    ['docs/previews/normal.png', {}],
    ['docs/previews/afternoon-solar.png', { hour: 16, minute: 40, second: 10, theme: 1 }],
    ['docs/previews/evening-glacier.png', { hour: 7, minute: 52, second: 47, theme: 2 }],
    ['docs/previews/ambient.png', { ambient: true }],
    ['docs/previews/low-battery.png', { lowBattery: true }],
  ];
  for (const [file, options] of outputs) {
    const html = path.join(work, 'page.html'), png = path.join(root, file);
    fs.mkdirSync(path.dirname(png), { recursive: true });
    fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>${css}</style>${svg(options)}`);
    execFileSync(browser(), ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=450,450',
      '--virtual-time-budget=2000', `--screenshot=${png}`, 'file:///' + html.replace(/\\/g, '/')], { stdio: 'ignore' });
    console.log(`Wrote ${file}`);
  }
  fs.rmSync(work, { recursive: true, force: true });
}
