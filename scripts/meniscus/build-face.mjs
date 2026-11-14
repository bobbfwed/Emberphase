// Generates watchface/src/main/res/raw/watchface.xml for Meniscus (WFF 4).
// Usage: node build-face.mjs [--check]   (--check fails if the file is stale)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from './geometry.mjs';
import * as X from './expressions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const target = path.join(root, 'watchface', 'src', 'main', 'res', 'raw', 'watchface.xml');

// ---------------------------------------------------------------- XML helpers
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f = (v) => (typeof v === 'number' ? Number(v.toFixed(3)).toString() : v);
function el(tag, attrs = {}, ...children) {
  const a = Object.entries(attrs).filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => ` ${k}="${esc(f(v))}"`).join('');
  const kids = children.flat(Infinity).filter((c) => c !== undefined && c !== null && c !== false && c !== '');
  return kids.length ? `<${tag}${a}>${kids.join('')}</${tag}>` : `<${tag}${a}/>`;
}
const T = (target, value, anim) => el('Transform', { target, value }, anim ? el('Animation', anim) : null);
const full = (name, attrs = {}) => ({ name, x: 0, y: 0, width: G.CANVAS, height: G.CANVAS, ...attrs });
const group = (name, attrs, ...children) => el('Group', full(name, attrs), ...children);
const draw = (name, attrs, ...shapes) => el('PartDraw', full(name, attrs), ...shapes);
const stroke = (color, thickness, extra = {}, ...kids) => el('Stroke', { color, thickness, ...extra }, ...kids);
const fill = (color, ...kids) => el('Fill', { color }, ...kids);
const ring = (r, a0, a1, strk, ...kids) =>
  el('Arc', { centerX: G.C, centerY: G.C, width: 2 * r, height: 2 * r, startAngle: a0, endAngle: a1 }, strk, ...kids);
const circle = (cx, cy, r, ...kids) => el('Ellipse', { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }, ...kids);
let carrierCount = 0;
// Empty group whose angle carries a number to the rest of the scene.
const carrier = (name, value, anim) =>
  el('Group', { name: `carrier_${name}_${carrierCount++}`, x: 0, y: 0, width: 1, height: 1 },
    T('angle', value, anim), el('Reference', { name, source: 'angle', defaultValue: 0 }));
function condition(expr, then, otherwise) {
  return el('Condition', {},
    el('Expressions', {}, `<Expression name="c"><![CDATA[${expr}]]></Expression>`),
    el('Compare', { expression: 'c' }, then),
    otherwise ? el('Default', {}, otherwise) : null);
}
// Configuration options hold exactly one child; wrap several in a group.
let wrapCount = 0;
const one = (children) => (children.flat().length === 1 ? children.flat()[0]
  : el('Group', { name: `option_${wrapCount++}`, x: 0, y: 0, width: 450, height: 450 }, ...children));
const boolOption = (id, ...children) => el('BooleanConfiguration', { id }, el('BooleanOption', { id: 'TRUE' }, one(children)));
const MEDIUM = 'plex_mono_medium', SEMIBOLD = 'plex_mono_semibold';
function text(name, box, { family = MEDIUM, size, color = '#FFFFFFFF', align = 'CENTER', spacing, template, params = [], upper = false, transforms = [], alpha, ellipsis = true }) {
  const tpl = params.length ? el('Template', {}, esc(template), ...params.map((p) => el('Parameter', { expression: p }))) : esc(template);
  return el('PartText', { name, x: box[0], y: box[1], width: box[2], height: box[3], alpha }, ...transforms,
    el('Text', { align, ellipsis: ellipsis ? 'TRUE' : 'FALSE' },
      el('Font', { family, size, color, letterSpacing: spacing }, upper ? el('Upper', {}, tpl) : tpl)));
}
// duration 0: the default 1 s always-on transition animates every Variant at
// each screen-state change, the moment Samsung's runtime is least stable.
const ambientHide = el('Variant', { mode: 'AMBIENT', target: 'alpha', value: 0, duration: 0 });

// ------------------------------------------------------------------ Carriers
function carriers() {
  const feedOptions = [
    [X.LEVEL_BATTERY, 1], [X.LEVEL_DAY, 2], [X.levelPod(0), 3], [X.levelPod(1), 3], [X.levelPod(2), 3], [X.levelPod(3), 3]
  ].map(([level, kind], i) => el('ListOption', { id: String(i) }, one([carrier(`lv${i}`, level), carrier(`kd${i}`, kind)])));
  return [
    el('ListConfiguration', { id: 'feed' }, ...feedOptions),
    carrier('lvl', X.LEVEL, { interpolation: 'EASE_OUT', duration: 0.6 }),
    carrier('kind', X.KIND),
    boolOption('tilt', condition(X.MOTION_OK,
      carrier('tilt', X.TILT, { interpolation: 'EASE_OUT', duration: 0.25, fps: 30 }))),
    condition(X.SLOSH_ACTIVE, [carrier('sloshA', X.SLOSH_ANGLE), carrier('sloshB', X.SLOSH_BOB)]),
    carrier('ang', X.ANGLE),
    carrier('sy', X.SURFACE_Y)
  ];
}

// ---------------------------------------------------------- Chronocast ring
function chronocast() {
  const R = G.RING, parts = [];
  parts.push(draw('ring_bed', {}, circle(G.C, G.C, (R.inner + R.outer) / 2,
    stroke('#FF0A0F14', R.outer - R.inner))));
  for (let k = 0; k < 12; k++) {
    const s = X.hourSource(k), a0 = X.sectorStart(k), a1 = X.sectorEnd(k);
    const angles = [T('startAngle', a0), T('endAngle', a1)];
    const depth = X.terrainDepth(s);
    parts.push(draw(`ring_hour_${k}`, {},
      ring(R.terrainBase + 3, 0.6, 29.4, stroke('#00000000', 6, {}, T('color', X.placeholderColor(s))), ...angles),
      ring(R.bandRadius, 0.6, 29.4, stroke('#00000000', R.bandThickness, {}, T('color', X.bandColor(s))), ...angles),
      el('Arc', { centerX: G.C, centerY: G.C, width: 2 * R.terrainBase + 8, height: 2 * R.terrainBase + 8, startAngle: 0.6, endAngle: 29.4 },
        stroke('#00000000', 8, {}, T('color', X.familyColor(s, 66)), T('thickness', depth)),
        ...angles, T('width', `${2 * R.terrainBase} + ${depth}`), T('height', `${2 * R.terrainBase} + ${depth}`)),
      el('Arc', { centerX: G.C, centerY: G.C, width: 2 * R.terrainBase + 16, height: 2 * R.terrainBase + 16, startAngle: 0.6, endAngle: 29.4 },
        stroke('#00000000', 1.8, {}, T('color', X.familyColor(s, 242))),
        ...angles, T('width', `${2 * R.terrainBase} + 2 * ${depth}`), T('height', `${2 * R.terrainBase} + 2 * ${depth}`)),
      ring(R.textureRadius, 0.6, 29.4, stroke('#00000000', 7, { dashIntervals: '1.2 4.6' }, T('color', X.rainColor(s))), ...angles),
      ring(R.textureRadius + 1, 0.6, 29.4, stroke('#00000000', 2.4, { dashIntervals: '0.1 5', cap: 'ROUND' }, T('color', X.snowColor(s))), ...angles)));
    if (R.labelHours.includes(k)) {
      const w = 40, h = 18;
      const pos = [T('x', X.labelX(k, w)), T('y', X.labelY(k, h)), T('alpha', `${s.avail} ? 255 : 0`)];
      parts.push(el('PartDraw', { name: `ring_label_bg_${k}`, x: 0, y: 0, width: w, height: h }, ...pos,
        el('RoundRectangle', { x: 0, y: 0, width: w, height: h, cornerRadiusX: 9, cornerRadiusY: 9 }, fill('#C8000000'))));
      parts.push(text(`ring_label_${k}`, [0, 0, w, h], { family: SEMIBOLD, size: 13, template: '%s°', params: [s.temp], transforms: pos }));
    }
  }
  // Dim the elapsed part of the current hour.
  parts.push(draw('ring_elapsed', {}, ring((R.inner + R.outer) / 2, 0, 1,
    stroke('#B8000000', R.outer - R.inner), T('startAngle', X.sectorStart(0)), T('endAngle', `${X.CURSOR} > ${X.sectorStart(0)} ? ${X.CURSOR} : ${X.sectorStart(0)}`))));
  // Cardinal ticks.
  parts.push(draw('ring_cardinals', {}, ...[0, 90, 180, 270].map((a) => {
    const [x1, y1] = G.polar(R.inner - 7, a), [x2, y2] = G.polar(R.inner - 3, a);
    return el('Line', { startX: x1, startY: y1, endX: x2, endY: y2 }, stroke('#FF46525E', 1.6));
  })));
  // Hour cursor: drawn at 12 o'clock and rotated.
  const top = G.C - R.cursorOuter, bottom = G.C - R.cursorInner;
  parts.push(draw('ring_cursor', { pivotX: 0.5, pivotY: 0.5 }, T('angle', X.CURSOR),
    el('Line', { startX: G.C, startY: top, endX: G.C, endY: bottom }, stroke('#40FFFFFF', 8, { cap: 'ROUND' })),
    el('Line', { startX: G.C, startY: top, endX: G.C, endY: bottom }, stroke('#FFFFFFFF', 2.6, { cap: 'ROUND' })),
    circle(G.C, bottom + 3, 3.2, fill('#FFFFFFFF'))));
  return parts;
}

// ------------------------------------------------------------- Pod housings
function podHousings() {
  const out = [];
  G.POD.angles.forEach((a, i) => {
    const [px, py] = G.podCenter(i);
    const [c1x, c1y] = G.polar(G.RIM, a), [c2x, c2y] = G.polar(G.POD.r - G.POD.radius + 1, a);
    const gap = (a + 180) % 360, start = gap + 30;
    out.push(draw(`pod_${i}_housing`, {},
      el('Line', { startX: c1x, startY: c1y, endX: c2x, endY: c2y }, stroke('#FF151D25', 7)),
      el('Line', { startX: c1x, startY: c1y, endX: c2x, endY: c2y }, stroke('#FF2A3540', 1.8)),
      circle(px, py, G.POD.radius, fill('#FF05080B'), stroke('#FF1A232C', 1)),
      el('Arc', { centerX: px, centerY: py, width: 2 * G.POD.arcRadius, height: 2 * G.POD.arcRadius, startAngle: start, endAngle: start + G.POD.arcSweep },
        stroke('#FF18212A', 3))));
    // Conduit lights when the pod reaches a real goal.
    out.push(draw(`pod_${i}_conduit_lit`, { alpha: 0 }, T('alpha', X.podDone(i)),
      el('Line', { startX: c1x, startY: c1y, endX: c2x, endY: c2y }, stroke('[CONFIGURATION.fluid.0]', 5, {}, )),
      el('Line', { startX: c1x, startY: c1y, endX: c2x, endY: c2y }, stroke('#FFFFFFFF', 1.4))));
  });
  return out;
}

// ------------------------------------------------------ Date, weather, event
function dateLines() {
  const D = G.DATE;
  return [
    text('date_weekday', [75, D.weekdayY, 300, 18], { size: D.weekdaySize, color: '#FF8A96A2', spacing: 0.25, template: '%s', params: ['[DAY_OF_WEEK_F]'], upper: true }),
    text('date_day', [75, D.dateY, 300, 34], { family: SEMIBOLD, size: D.dateSize, color: '#FFEEF3F7', spacing: 0.05, template: '%s %s', params: ['[DAY]', '[MONTH_S]'], upper: true })
  ];
}

const ICONS_BY_FAMILY = [
  [X.isRain('[WEATHER.CONDITION]'), 'wx_rain', G.FAMILY_RGB.rain],
  [X.isSnow('[WEATHER.CONDITION]'), 'wx_snow', G.FAMILY_RGB.snow],
  ['[WEATHER.CONDITION] == 9', 'wx_storm', G.FAMILY_RGB.storm],
  ['([WEATHER.CONDITION] == 1 || [WEATHER.CONDITION] == 8) && [WEATHER.IS_DAY]', 'wx_sun', G.FAMILY_RGB.clearDay],
  ['[WEATHER.CONDITION] == 1 || [WEATHER.CONDITION] == 8', 'wx_moon', G.FAMILY_RGB.clearNight],
  ['[WEATHER.CONDITION] == 14 && [WEATHER.IS_DAY]', 'wx_partly_day', G.FAMILY_RGB.partly],
  ['[WEATHER.CONDITION] == 14', 'wx_partly_night', G.FAMILY_RGB.partly],
  ['[WEATHER.CONDITION] == 2', 'wx_cloud', G.FAMILY_RGB.cloud],
  ['[WEATHER.CONDITION] == 3 || [WEATHER.CONDITION] == 13', 'wx_fog', G.FAMILY_RGB.fog],
  ['[WEATHER.CONDITION] == 15', 'wx_wind', G.FAMILY_RGB.wind]
];
const hex = ([r, g, b], a = 255) => '#' + [a, r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

function weatherLine() {
  const y = G.WEATHER_LINE.y, cx = G.C;
  const icon = (res, color) => el('PartImage', { name: `wx_icon_${res}`, x: cx - 74, y, width: G.ICON_SIZE, height: G.ICON_SIZE, tintColor: color },
    el('Image', { resource: res }));
  // Nested conditions: first match wins.
  let iconTree = icon('wx_unknown', hex(G.FAMILY_RGB.unknown, 255).replace('#FF', '#FF'));
  for (let i = ICONS_BY_FAMILY.length - 1; i >= 0; i--) {
    const [expr, res, rgbv] = ICONS_BY_FAMILY[i];
    iconTree = condition(expr, icon(res, hex(rgbv)), iconTree);
  }
  const available = [
    iconTree,
    text('wx_now', [cx - 46, y - 3, 62, 28], { family: SEMIBOLD, size: 21, color: '#FFEEF3F7', align: 'START', template: '%s°', params: ['[WEATHER.TEMPERATURE]'] }),
    text('wx_range', [cx + 14, y + 3, 92, 18], { size: 12, color: '#FF8A96A2', align: 'START', template: 'H%s° L%s°', params: ['[WEATHER.DAY_TEMPERATURE_HIGH]', '[WEATHER.DAY_TEMPERATURE_LOW]'] }),
    text('wx_error', [cx + 6, y - 2, 10, 16], { family: SEMIBOLD, size: 12, color: '#FFFFB08A', template: '!', params: [],
      transforms: [T('alpha', '[WEATHER.IS_ERROR] ? 255 : 0')], ellipsis: false })
  ];
  const missing = text('wx_missing', [cx - 80, y, 160, 20], { size: 13, color: '#FF5E6A76', spacing: 0.15, template: 'WEATHER --°', params: [] });
  return [condition('[WEATHER.IS_AVAILABLE]', available, missing)];
}

function eventBacking() {
  const E = G.EVENT_BAR;
  return draw('event_backing', {}, el('RoundRectangle', { x: E.x, y: E.y, width: E.w, height: E.h, cornerRadiusX: E.h / 2, cornerRadiusY: E.h / 2 },
    fill('#FF070B0F'), stroke('#FF1E2832', 1)));
}

// --------------------------------------------------------------------- Core
const CELL = G.GLYPH_CELL;
function digits(name, font, tint, dx = 0, dy = 0, extra = {}) {
  const rows = [['h', G.HOURS_TOP], ['mm', G.MINUTES_TOP]];
  return rows.map(([format, top]) => el('DigitalClock', {
    x: G.C - 120 + dx, y: top - CELL.oy + dy, width: 240, height: CELL.h, pivotX: 0.5, pivotY: 0.5, tintColor: tint, ...extra
  }, el('TimeText', { format, hourFormat: 'SYNC_TO_DEVICE', align: 'CENTER', x: 0, y: 0, width: 240, height: CELL.h },
    el('BitmapFont', { family: font, size: CELL.h }))));
}
const coreMask = () => draw('core_mask', { renderMode: 'MASK' }, circle(G.C, G.C, G.CORE, fill('#FFFFFFFF')));
const rotated = [T('angle', X.ref('ang'))];

// The fluid is three stacked layers: a deep base, then the mid and bright
// tones fading out with depth. Each layer is white, tinted by one colour of
// the selected theme ([CONFIGURATION.fluid.n]); a gradient cannot take its
// colours from a colour setting on the runtime.
const FLUID_LAYERS = [
  { tone: 2, fade: null },
  { tone: 1, fade: G.FLUID_GRADIENT_DEPTH },
  { tone: 0, fade: G.FLUID_GRADIENT_DEPTH * G.FLUID_STOPS[1] * 2 }
];
function fluidRect(sy, fade) {
  const paint = fade === null ? fill('#FFFFFFFF')
    : el('Fill', { color: '#FFFFFFFF' }, el('LinearGradient', {
      startX: 0, startY: G.C, endX: 0, endY: G.C + fade, colors: '#FFFFFFFF #00FFFFFF', positions: '0 1'
    }, T('startY', sy), T('endY', `${sy} + ${fade}`)));
  return el('Rectangle', { x: 0, y: G.C, width: G.CANVAS, height: G.CANVAS }, T('y', sy), paint);
}
function fluidDraw(name, tints) {
  const sy = X.ref('sy');
  return group(name, {},
    ...FLUID_LAYERS.map((l, i) => draw(`${name}_${i}`, { pivotX: 0.5, pivotY: 0.5, tintColor: tints[l.tone] }, ...rotated, fluidRect(sy, l.fade))),
    draw(`${name}_waves`, { pivotX: 0.5, pivotY: 0.5 }, ...rotated,
      ...[16, 34].map((d) => el('Line', { startX: 0, startY: G.C, endX: G.CANVAS, endY: G.C },
        stroke('#14FFFFFF', 1.2), T('startY', `${sy} + ${d}`), T('endY', `${sy} + ${d}`)))));
}

function surface() {
  const sy = X.ref('sy'), half = X.HALF, curl = 7;
  const lineX0 = `${G.C} - ${half} + ${curl}`, lineX1 = `${G.C} + ${half} - ${curl}`;
  const lineT = [T('startX', lineX0), T('endX', lineX1), T('startY', sy), T('endY', sy)];
  const curlArc = (side) => el('Arc', { centerX: G.C, centerY: G.C, width: 2 * curl, height: 2 * curl, startAngle: side < 0 ? 180 : 90, endAngle: side < 0 ? 270 : 180 },
    stroke('#F2FFFFFF', 1.6, { cap: 'ROUND' }),
    T('centerX', side < 0 ? lineX0 : lineX1), T('centerY', `${sy} - ${curl}`));
  return group('surface', { pivotX: 0.5, pivotY: 0.5 }, ...rotated, T('alpha', `${X.SURFACE_VISIBLE} ? 255 : 0`),
    draw('meniscus', {},
      el('Line', { startX: 0, startY: 0, endX: 1, endY: 0 }, stroke('#40FFFFFF', 5, { cap: 'ROUND' }), ...lineT),
      el('Line', { startX: 0, startY: 0, endX: 1, endY: 0 }, stroke('#F2FFFFFF', 1.6, { cap: 'ROUND' }), ...lineT),
      curlArc(-1), curlArc(1)),
    // A light chip keeps the tag readable where it crosses a submerged digit.
    draw('level_chip', { x: 0, y: 0, width: 104, height: 16 },
      T('x', `${G.C} + ${half} - 124`), T('y', `${sy} + 4`), T('alpha', `${G.CORE_BOTTOM} - ${sy} > 20 ? 255 : 0`),
      el('RoundRectangle', { x: 0, y: 0, width: 40, height: 16, cornerRadiusX: 8, cornerRadiusY: 8 },
        fill(G.LIT.replace('#', '#D9')), T('x', `100 - (${X.LEVEL_CHIP_W})`), T('width', X.LEVEL_CHIP_W))),
    text('level_tag', [0, 0, 96, 16], {
      family: SEMIBOLD, size: 11, color: G.INK.replace('#', '#FF'), align: 'END', spacing: 0.05, template: '%s %s%s',
      params: [X.KIND_LABEL, `round(${X.ref('lvl')} * 100)`, '"%"'],
      transforms: [T('x', `${G.C} + ${half} - 124`), T('y', `${sy} + 4`), T('alpha', `${G.CORE_BOTTOM} - ${sy} > 20 ? 255 : 0`)]
    }));
}

function bubbles() {
  const ellipses = [];
  for (let i = 0; i < X.BUBBLES; i++) {
    const r = X.bubbleRadius(i), x = X.bubbleX(i);
    ellipses.push(el('Ellipse', { x: x - r, y: X.BUBBLE_BOTTOM + 40, width: 2 * r, height: 2 * r },
      fill('#46FFFFFF'), stroke('#E6FFFFFF', 0.9),
      T('y', X.bubbleY(i), { interpolation: 'EASE_OUT', duration: 0.9, fps: 30 })));
  }
  return group('bubbles', { pivotX: 0.5, pivotY: 0.5 }, ...rotated, T('alpha', X.BUBBLES_VISIBLE),
    draw('bubble_set', {}, ...ellipses),
    text('bubble_count', [X.BUBBLE_LABEL_BOX.x, 0, X.BUBBLE_LABEL_BOX.w, X.BUBBLE_LABEL_BOX.h], {
      family: SEMIBOLD, size: 11, color: G.INK.replace('#', '#FF'), align: 'END', template: '%s', params: [X.BUBBLE_LABEL],
      transforms: [T('y', X.BUBBLE_LABEL_Y), T('alpha', `${X.NOTIFICATIONS} > 0 ? 255 : 0`)]
    }));
}

function core() {
  const sy = X.ref('sy');
  const submergedMask = draw('fluid_mask', { renderMode: 'MASK', pivotX: 0.5, pivotY: 0.5 }, ...rotated,
    el('Rectangle', { x: 0, y: G.C, width: G.CANVAS, height: G.CANVAS }, T('y', sy), fill('#FFFFFFFF')));
  return group('core', {},
    coreMask(),
    draw('glass', {}, circle(G.C, G.C, G.CORE, el('Fill', { color: '#FF03070A' },
      el('RadialGradient', { centerX: 200, centerY: 188, radius: 165, colors: '#FF0C1820 #FF03070A', positions: '0 1' })))),
    ...digits('digits_lit', 'numerals', G.LIT.replace('#', '#FF')),
    condition(X.WARN_FLUID, fluidDraw('fluid_warn', G.WARN.map((c) => c.replace('#', '#FF'))),
      fluidDraw('fluid', [0, 1, 2].map((n) => `[CONFIGURATION.fluid.${n}]`))),
    group('submerged', {}, submergedMask,
      ...digits('digits_ink', 'numerals', G.INK.replace('#', '#FF'), G.REFRACTION.dx, G.REFRACTION.dy,
        { scaleX: G.REFRACTION.scale, scaleY: G.REFRACTION.scale }),
      bubbles()),
    surface());
}

function glassRim() {
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const [x1, y1] = G.polar(G.CORE - 2.5, i * 6), [x2, y2] = G.polar(G.CORE, i * 6);
    ticks.push(el('Line', { startX: x1, startY: y1, endX: x2, endY: y2 }, stroke(i % 5 ? '#1AFFFFFF' : '#38FFFFFF', 0.8)));
  }
  const rimR = G.RIM - 1.5;
  // Static: a Gyro transform here was animating at every Samsung runtime crash.
  const highlight = draw('glass_highlight', {}, ring(101, 292, 334, stroke('#24FFFFFF', 4, { cap: 'ROUND' })));
  const spark = [];
  // Fading tail behind the spark, 3 degrees per segment.
  for (let i = 1; i <= 8; i++) {
    const alpha = Math.round(255 * 0.6 * (1 - i / 9)).toString(16).padStart(2, '0').toUpperCase();
    spark.push(ring(G.RIM, -i * 3, -(i - 1) * 3, stroke(`#${alpha}FFFFFF`, 2)));
  }
  return [
    draw('glass_ticks', {}, ...ticks),
    draw('glass_rim', {}, circle(G.C, G.C, rimR, stroke('#FF8E9BA6', 3.4, {},
      el('LinearGradient', { startX: G.C - rimR, startY: G.C - rimR, endX: G.C + rimR, endY: G.C + rimR, colors: '#FF8E9BA6 #FF1A2027 #FF3B4752 #FF9FB0BC', positions: '0 0.45 0.7 1' })))),
    highlight,
    boolOption('secs', condition(X.SECONDS_OK,
      draw('seconds_spark', { pivotX: 0.5, pivotY: 0.5 },
        T('angle', '[SECOND] * 6', { interpolation: 'EASE_OUT', duration: 0.15, fps: 30, angleDirection: 'CLOCKWISE' }),
        ...spark,
        circle(G.C, G.C - G.RIM, 5, fill('#40FFFFFF')),
        circle(G.C, G.C - G.RIM, 2.6, fill('#FFFFFFFF')))))
  ];
}

// ------------------------------------------------------------------ Ambient
function ambient() {
  const dots = [];
  for (let i = 0; i < 12; i++) { const [x, y] = G.polar(214, i * 30); dots.push(circle(x, y, i % 3 ? 1.4 : 2.2, fill('#FF56616C'))); }
  const sy = `${G.CORE_BOTTOM} - ${2 * G.CORE} * ${X.ref('lvl')}`;
  const half = `sqrt(clamp(${G.CORE * G.CORE} - pow(${sy} - ${G.C}, 2), 0, ${G.CORE * G.CORE}))`;
  const outline = (name, alpha) => digits(name, 'numerals_outline', G.LIT.replace('#', '#FF'), 0, 0, { alpha });
  return group('ambient', { alpha: 0 }, el('Variant', { mode: 'AMBIENT', target: 'alpha', value: 255, duration: 0 }),
    draw('amb_dots', {}, ...dots),
    draw('amb_cursor', { pivotX: 0.5, pivotY: 0.5, alpha: 220 }, T('angle', X.CURSOR),
      el('Line', { startX: G.C, startY: 2, endX: G.C, endY: 28 }, stroke('[CONFIGURATION.fluid.0]', 2.2, { cap: 'ROUND' }))),
    text('amb_date', [75, 78, 300, 22], { size: 16, color: '#FF7A8692', spacing: 0.15, template: '%s %s', params: ['[DAY_OF_WEEK_S]', '[DAY]'], upper: true }),
    draw('amb_core', {}, circle(G.C, G.C, G.RIM, stroke('#FF2E3944', 1.2))),
    group('amb_above', {},
      draw('amb_above_mask', { renderMode: 'MASK' }, el('Rectangle', { x: 0, y: 0, width: G.CANVAS, height: G.C }, T('height', `${sy} > 1 ? ${sy} : 1`), fill('#FFFFFFFF'))),
      ...outline('amb_digits_above', 230)),
    group('amb_below', {},
      draw('amb_below_mask', { renderMode: 'MASK' }, el('Rectangle', { x: 0, y: G.C, width: G.CANVAS, height: G.CANVAS }, T('y', sy), fill('#FFFFFFFF'))),
      ...outline('amb_digits_below', 107)),
    draw('amb_waterline', { alpha: 180 }, T('alpha', `${X.ref('lvl')} > 0.005 && ${X.ref('lvl')} < 0.995 ? 180 : 0`),
      el('Line', { startX: 0, startY: 0, endX: 1, endY: 0 }, stroke('[CONFIGURATION.fluid.0]', 1),
        T('startX', `${G.C} - ${half}`), T('endX', `${G.C} + ${half}`), T('startY', sy), T('endY', sy))));
}

// ------------------------------------------------------- Complication slots
const ICON_TINT = '#FF8A96A2';
function podContent(i) {
  const box = 2 * G.POD.radius, mid = box / 2;
  const a = G.POD.angles[i], start = (a + 180) % 360 + 30;
  const arc = (fraction) => el('PartDraw', { name: `pod_${i}_arc`, x: 0, y: 0, width: box, height: box },
    el('Arc', { centerX: mid, centerY: mid, width: 2 * G.POD.arcRadius, height: 2 * G.POD.arcRadius, startAngle: start, endAngle: start },
      stroke('[CONFIGURATION.fluid.0]', 3), T('endAngle', `${start} + ${G.POD.arcSweep} * (${fraction})`)));
  const icon = (size = 16, y = 9) => el('PartImage', { name: `pod_${i}_icon`, x: mid - size / 2, y, width: size, height: size, tintColor: ICON_TINT },
    el('Image', { resource: '[COMPLICATION.MONOCHROMATIC_IMAGE]' }));
  const value = (expr) => text(`pod_${i}_value`, [5, 24, box - 10, 20], { family: SEMIBOLD, size: 15, color: '#FFEEF3F7', template: '%s', params: [expr] });
  const sub = (template, params, transforms) => text(`pod_${i}_sub`, [8, 43, box - 16, 13], { size: 9, color: '#FF7F8B97', template, params, transforms });

  const goal = el('Complication', { type: 'GOAL_PROGRESS' },
    carrier(`p${i}g`, X.goalFraction), carrier(`d${i}g`, X.goalDone),
    arc(X.ref(`p${i}g`)), icon(),
    value(X.textOr('[COMPLICATION.GOAL_PROGRESS_VALUE]')),
    sub('/%s', ['numberFormat("#,##0", [COMPLICATION.GOAL_PROGRESS_TARGET_VALUE])'],
      [T('alpha', '[COMPLICATION.GOAL_PROGRESS_TARGET_VALUE] > 0 ? 255 : 0')]));

  const samsungGoal = i === 0
    ? el('Group', { name: 'pod_0_samsung', x: 0, y: 0, width: box, height: box },
      boolOption('samsungSteps',
        carrier('g0r', X.rangeIsGoal), carrier('d0r', X.rangeDone),
        text('pod_0_range_goal', [8, 43, box - 16, 13], { size: 9, color: '#FF7F8B97', template: '/%s',
          params: ['numberFormat("#,##0", [COMPLICATION.RANGED_VALUE_MAX])'], transforms: [T('alpha', `${X.ref('g0r')} > 0 ? 255 : 0`)] })))
    : null;
  const titleAlpha = i === 0 ? [T('alpha', `${X.ref('g0r')} > 0 ? 0 : 255`)] : [];
  const ranged = el('Complication', { type: 'RANGED_VALUE' },
    carrier(`p${i}r`, X.rangeFraction),
    arc(X.ref(`p${i}r`)), icon(),
    value(X.textOr('[COMPLICATION.RANGED_VALUE_VALUE]')),
    sub('%s', ['[COMPLICATION.TITLE]'], titleAlpha),
    samsungGoal);

  const short = el('Complication', { type: 'SHORT_TEXT' },
    icon(), value('[COMPLICATION.TEXT]'), sub('%s', ['[COMPLICATION.TITLE]']));
  const mono = el('Complication', { type: 'MONOCHROMATIC_IMAGE' }, icon(28, mid - 14));
  const small = el('Complication', { type: 'SMALL_IMAGE' },
    el('PartImage', { name: `pod_${i}_image`, x: mid - 18, y: mid - 18, width: 36, height: 36 }, el('Image', { resource: '[COMPLICATION.SMALL_IMAGE]' })));
  const empty = el('Complication', { type: 'EMPTY' });
  return [goal, ranged, short, mono, small, empty];
}

const POD_DEFAULTS = [
  { defaultSystemProvider: 'STEP_COUNT', defaultSystemProviderType: 'RANGED_VALUE', primaryProvider: G.PROVIDERS.samsungSteps, primaryProviderType: 'GOAL_PROGRESS' },
  { defaultSystemProvider: 'EMPTY', defaultSystemProviderType: 'EMPTY', primaryProvider: G.PROVIDERS.minutes, primaryProviderType: 'GOAL_PROGRESS' },
  { defaultSystemProvider: 'EMPTY', defaultSystemProviderType: 'EMPTY', primaryProvider: G.PROVIDERS.calories, primaryProviderType: 'GOAL_PROGRESS' },
  { defaultSystemProvider: 'HEART_RATE', defaultSystemProviderType: 'SHORT_TEXT' }
];
const POD_NAMES = ['pod_10', 'pod_2', 'pod_4', 'pod_8'];

export const SLOT_BOUNDS = [];
function slots() {
  const out = [];
  G.POD.angles.forEach((a, i) => {
    const [px, py] = G.podCenter(i), r = G.POD.radius, box = 2 * r;
    const x = Math.round(px - r), y = Math.round(py - r);
    SLOT_BOUNDS.push({ slotId: i, x, y, w: box, h: box, shape: 'oval' });
    out.push(el('ComplicationSlot', {
      slotId: i, name: POD_NAMES[i], displayName: POD_NAMES[i], x, y, width: box, height: box, isCustomizable: 'TRUE',
      supportedTypes: 'GOAL_PROGRESS RANGED_VALUE SHORT_TEXT MONOCHROMATIC_IMAGE SMALL_IMAGE EMPTY'
    }, el('DefaultProviderPolicy', POD_DEFAULTS[i]), el('BoundingOval', { x: 0, y: 0, width: box, height: box }),
    ...podContent(i), ambientHide));
  });
  const E = G.EVENT_BAR;
  SLOT_BOUNDS.push({ slotId: 4, x: E.x, y: E.y, w: E.w, h: E.h, shape: 'box' });
  out.push(el('ComplicationSlot', {
    slotId: 4, name: 'event_bar', displayName: 'event_bar', x: E.x, y: E.y, width: E.w, height: E.h, isCustomizable: 'TRUE',
    supportedTypes: 'LONG_TEXT SHORT_TEXT EMPTY'
  }, el('DefaultProviderPolicy', { defaultSystemProvider: 'NEXT_EVENT', defaultSystemProviderType: 'LONG_TEXT' }),
  el('BoundingRoundBox', { x: 0, y: 0, width: E.w, height: E.h, cornerRadius: E.h / 2 }),
  ...['LONG_TEXT', 'SHORT_TEXT'].map((type) => el('Complication', { type },
    text(`event_text_${type}`, [10, 3, E.w - 20, E.h - 6], { size: 13, color: '#FFC9D2DA', template: '%s %s', params: ['[COMPLICATION.TITLE]', '[COMPLICATION.TEXT]'] }))),
  el('Complication', { type: 'EMPTY' }), ambientHide));

  const fixed = (slotId, name, provider, bounds, refName, flagName) => {
    SLOT_BOUNDS.push({ slotId, x: bounds[0], y: bounds[1], w: bounds[2], h: bounds[3], shape: 'fixed' });
    return el('ComplicationSlot', {
      slotId, name, x: bounds[0], y: bounds[1], width: bounds[2], height: bounds[3], isCustomizable: 'FALSE',
      supportedTypes: 'RANGED_VALUE EMPTY'
    }, el('DefaultProviderPolicy', { defaultSystemProvider: 'EMPTY', defaultSystemProviderType: 'EMPTY', primaryProvider: provider, primaryProviderType: 'RANGED_VALUE' }),
    el('BoundingOval', { x: 0, y: 0, width: bounds[2], height: bounds[3] }),
    el('Complication', { type: 'RANGED_VALUE' }, one([carrier(refName, '[COMPLICATION.RANGED_VALUE_VALUE]'), flagName ? carrier(flagName, 1) : []])),
    el('Complication', { type: 'EMPTY' }));
  };
  out.push(fixed(5, 'core_tap', G.PROVIDERS.coreTap, [G.C - G.RIM, G.C - G.RIM, 2 * G.RIM, 2 * G.RIM], 'tap'));
  out.push(fixed(6, 'power_saving', G.PROVIDERS.powerSave, [205, 24, 40, 10], 'psave'));
  // Appended last: Samsung maps provider choices by slot order. WFF allows 8.
  out.push(fixed(7, 'notifications', G.PROVIDERS.notifications, [205, 414, 40, 10], 'ncount', 'nsrc'));
  return out;
}

// -------------------------------------------------------------------- Build
export function buildFace() {
  carrierCount = 0;
  wrapCount = 0;
  SLOT_BOUNDS.length = 0;
  const bitmapFont = (name, prefix) => el('BitmapFont', { name },
    ...Object.keys(G.GLYPH).map((ch) => el('Character', { name: ch, resource: `${prefix}${ch}`, width: CELL.w, height: CELL.h })));
  const config = el('UserConfigurations', {},
    el('ColorConfiguration', { id: 'fluid', displayName: 'fluid_color', defaultValue: G.THEMES[0].id },
      ...G.THEMES.map((t) => el('ColorOption', { id: t.id, displayName: `theme_${t.id}`, colors: t.colors.join(' ') }))),
    el('ListConfiguration', { id: 'feed', displayName: 'core_fluid', defaultValue: '0' },
      ...['feed_battery', 'feed_day', 'feed_pod_10', 'feed_pod_2', 'feed_pod_4', 'feed_pod_8'].map((s, i) => el('ListOption', { id: String(i), displayName: s }))),
    el('BooleanConfiguration', { id: 'tilt', displayName: 'gravity_tilt', defaultValue: 'TRUE' }),
    el('BooleanConfiguration', { id: 'secs', displayName: 'seconds_spark', defaultValue: 'TRUE' }),
    el('BooleanConfiguration', { id: 'samsungSteps', displayName: 'samsung_steps_target', defaultValue: 'TRUE' }));
  const active = group('active', {}, ambientHide,
    ...chronocast(), ...podHousings(), ...dateLines(), ...weatherLine(), eventBacking(), core(), ...glassRim());
  const scene = el('Scene', { backgroundColor: '#FF000000' }, ...carriers(), active, ambient(), ...slots());
  const xml = el('WatchFace', { width: G.CANVAS, height: G.CANVAS, clipShape: 'CIRCLE' },
    el('Metadata', { key: 'CLOCK_TYPE', value: 'DIGITAL' }),
    el('Metadata', { key: 'PREVIEW_TIME', value: '10:08:32' }),
    config,
    el('BitmapFonts', {}, bitmapFont('numerals', 'num_'), bitmapFont('numerals_outline', 'num_outline_')),
    scene);
  return '<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated by scripts/meniscus/build-face.mjs. Edit the generator, not this file. -->\n' +
    xml.replace(/></g, '>\n<') + '\n';
}

// Debug only (--fake): replaces weather and notification sources with fixed
// sample values and points the pods at system providers, so an emulator
// without weather or health data can render every part of the face.
// Never commit a --fake build; --check rejects it.
function fakeData(xml, diagnostics = false) {
  const conds = [14, 12, 6, 9, 6, 2, 2, 1, 1, 1, 13, 1];
  const temps = [13, 14, 15, 16, 15, 13, 11, 10, 9, 8, 8, 7];
  const days = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
  let out = xml;
  for (let k = 11; k >= 1; k--) {
    const p = `WEATHER.HOURS.${k}`;
    // Hours 10 and 11 have no forecast (condition 0).
    out = out.split(`[${p}.TEMPERATURE]`).join(String(temps[k]))
      .split(`[${p}.CONDITION]`).join(String(k <= 9 ? conds[k] : 0)).split(`[${p}.IS_DAY]`).join(String(days[k]));
  }
  const now = { IS_AVAILABLE: 1, IS_ERROR: 0, TEMPERATURE: temps[0], CONDITION: conds[0], IS_DAY: days[0], DAY_TEMPERATURE_LOW: 7, DAY_TEMPERATURE_HIGH: 17 };
  for (const [key, v] of Object.entries(now)) out = out.split(`[WEATHER.${key}]`).join(String(v));
  out = out.split('[UNREAD_NOTIFICATION_COUNT]').join('3');
  if (!diagnostics) return out;
  // On-screen diagnostics for sensors and carriers (--diag). Reads the
  // accelerometer outside its gate, so it keeps the sensor active.
  const diag = text('debug_readout', [100, 404, 250, 16], { size: 11, color: '#FFFF4FD8', template: 'ax %s x %s tilt %s tap %s',
    params: ['round([ACCELEROMETER_ANGLE_X])', 'round([ACCELEROMETER_X] * 10) / 10', 'round([REFERENCE.tilt])', 'round([REFERENCE.tap])'] });
  return out.replace('</Scene>', `${diag}\n</Scene>`);
}
function fakePods(xml) {
  let out = xml;
  const pods =[['STEP_COUNT', 'RANGED_VALUE'], ['WATCH_BATTERY', 'RANGED_VALUE'], ['DAY_OF_WEEK', 'SHORT_TEXT'], ['HEART_RATE', 'SHORT_TEXT']];
  let i = 0;
  out = out.replace(/<DefaultProviderPolicy [^>]*primaryProvider="[^"]*(?:Steps|Minutes|Calories)[^"]*"[^>]*\/>|<DefaultProviderPolicy defaultSystemProvider="HEART_RATE"[^>]*\/>/g, () => {
    const [p, t] = pods[i++];
    return `<DefaultProviderPolicy defaultSystemProvider="${p}" defaultSystemProviderType="${t}"/>`;
  });
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const xml = process.argv.includes('--fake') ? fakePods(fakeData(buildFace(), process.argv.includes('--diag'))) : buildFace();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') : '';
    if (current !== xml) { console.error('watchface.xml is stale: run node scripts/meniscus/build-face.mjs'); process.exit(1); }
    console.log('watchface.xml is up to date');
  } else {
    fs.writeFileSync(target, xml);
    console.log(`Wrote ${target} (${xml.length} bytes)`);
  }
}
