// Generates watchface/src/main/res/raw/watchface.xml for the Apsis face.
// Edit this file and scripts/lib/apsis-geometry.mjs, then run:
//   node scripts/New-WatchFace.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from './lib/apsis-geometry.mjs';

const { C, RF, RM, D, pt } = G;
const FM = 'oxanium_medium', FB = 'oxanium_bold';
const INK = '#E8EBF7', DIM = '#8187A3', FAINT = '#7B8099', TRACK = '#2A2E40';
const ACCENT = '[CONFIGURATION.accent.3]';

// ---- XML helpers -----------------------------------------------------------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = v => typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : v;
function el(name, attrs = {}, ...kids) {
  kids = kids.flat(Infinity).filter(k => k !== null && k !== undefined && k !== false);
  const a = Object.entries(attrs).filter(([, v]) => v !== undefined).map(([k, v]) => ` ${k}="${esc(num(v))}"`).join('');
  if (!kids.length) return `<${name}${a} />`;
  // Text content must stay free of layout whitespace, so mixed content is inline.
  if (kids.some(k => k.text !== undefined)) return `<${name}${a}>${kids.map(k => k.text !== undefined ? esc(k.text) : k).join('')}</${name}>`;
  const body = kids.map(k => k.text !== undefined ? esc(k.text) : k).join('\n').split('\n').map(l => '    ' + l).join('\n');
  return `<${name}${a}>\n${body}\n</${name}>`;
}
const text = s => ({ text: s });
const FULL = { x: 0, y: 0, width: 450, height: 450 };
const PIVOT = { pivotX: 0.5, pivotY: 0.5 };
const ambientOff = () => el('Variant', { mode: 'AMBIENT', target: 'alpha', value: '0', duration: '0' });
const transform = (target, value) => el('Transform', { target, value });
const fill = color => el('Fill', { color });
const stroke = (color, thickness, cap, ...kids) => el('Stroke', { color, thickness, cap }, ...kids);
const line = (a, b, s) => el('Line', { startX: a[0], startY: a[1], endX: b[0], endY: b[1] }, s);
const circle = (cx, cy, r, ...style) => el('Ellipse', { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }, ...style);
const arc = (r, start, end, direction, ...kids) =>
  el('Arc', { centerX: C, centerY: C, width: 2 * r, height: 2 * r, startAngle: start, endAngle: end, direction }, ...kids);
const group = (name, attrs, ...kids) => el('Group', { name, ...attrs }, ...kids);
const draw = (attrs, ...kids) => el('PartDraw', attrs, ...kids);
// A template with %s placeholders and one expression per placeholder.
const template = (format, ...exprs) => el('Template', {}, text(format), ...exprs.map(e => el('Parameter', { expression: e })));
const font = (family, size, color, ...kids) => el('Font', { family, size, color }, ...kids);
function label(box, family, size, color, content, textAttrs = {}, partAttrs = {}, ...partKids) {
  return el('PartText', { ...box, ...partAttrs }, ...partKids,
    el('Text', { align: 'CENTER', ...textAttrs }, font(family, size, color, content)));
}
const box = (cx, cy, w, h) => ({ x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), width: w, height: h });
const when = (expr, yes, no) => el('Condition', {},
  el('Expressions', {}, el('Expression', { name: 'test' }, text(expr))),
  el('Compare', { expression: 'test' }, yes),
  no ? el('Default', {}, no) : null);
const q = s => `"${s}"`;

// ---- Expressions -----------------------------------------------------------
const OFF = '[REFERENCE.fore_off]';
const IDX = '[REFERENCE.fore_idx]';
const HOUR_ANGLE = `[HOUR_0_11_MINUTE] * 30 + 30 * ${OFF}`;
const MINUTE_ANGLE = '[MINUTE] * 6';
const sm = x => `((${x}) * (${x}) * (3 - 2 * (${x})))`;
const PROGRESS = `clamp((([UTC_TIMESTAMP] % 86400000 - ([REFERENCE.fore_start] - 1) + 86400000) % 86400000) / ${G.FORESIGHT_MS}, 0, 1)`;
const P = '[REFERENCE.fore_progress]';
const OFFSET = `${G.FORECAST_HOURS} * ${sm(`clamp(${P} / 0.75, 0, 1)`)} * (1 - ${sm(`clamp((${P} - 0.8) / 0.2, 0, 1)`)})`;
const HI = '[WEATHER.DAY_TEMPERATURE_HIGH]', LO = '[WEATHER.DAY_TEMPERATURE_LOW]';
const hourField = (i, f) => `[WEATHER.HOURS.${i}.${f}]`;
const tempK = i => `(${HI} > ${LO} ? clamp((${hourField(i, 'TEMPERATURE')} - ${LO}) / (${HI} - ${LO}), 0, 1) : 0.5)`;
// Chooses one expression per forecast hour by the Foresight index.
const byHour = (make, fallback) => {
  let e = fallback;
  for (let i = G.FORECAST_HOURS; i >= 1; i--) e = `${IDX} == ${i} ? ${make(i)} : (${e})`;
  return e;
};

// ---- Foresight control -----------------------------------------------------
// The companion publishes a tap timestamp for six seconds. Only this branch
// uses a millisecond source; references fall back to their defaults otherwise.
function foresightControl() {
  const ref = (name, value, def) => group(`${name}_source`, { x: 0, y: 0, width: 1, height: 1 },
    transform('angle', value), el('Reference', { name, source: 'angle', defaultValue: def }));
  return group('foresight_control', FULL, ambientOff(),
    when('[REFERENCE.fore_start] > 0 && [BATTERY_PERCENT] > 15', [
      ref('fore_progress', PROGRESS, 1),
      ref('fore_off', OFFSET, 0),
      ref('fore_idx', `round(${OFF})`, 0),
    ]));
}

// ---- Corona ----------------------------------------------------------------
function corona() {
  const bars = [];
  for (let i = 1; i <= G.FORECAST_HOURS; i++) {
    const k = tempK(i), rest = Math.round(255 * (1 - (i - 1) * 0.085));
    const top = C - G.BAR_R0 - G.BAR_MIN;
    const cond = hourField(i, 'CONDITION');
    const colour = `colorRgb(round(${k} < 0.5 ? 86 + 300 * ${k} : 236 + 38 * (${k} - 0.5)), round(${k} < 0.5 ? 168 + 144 * ${k} : 240 - 140 * (${k} - 0.5)), round(${k} < 0.5 ? 255 : 255 - 390 * (${k} - 0.5)))`;
    bars.push(group(`bar_${i}`, { ...FULL, ...PIVOT, angle: i * 30 },
      transform('alpha', `${IDX} > 0 ? (${IDX} == ${i} ? 255 : 60) : ${rest}`),
      when(hourField(i, 'IS_AVAILABLE'), [
        draw(FULL, el('Line', { startX: C, startY: C - G.BAR_R0, endX: C, endY: top },
          transform('endY', `${top} - ${G.BAR_SPAN} * ${k}`),
          stroke('#ECF0FF', 5, 'ROUND', transform('color', colour)))),
        when(G.WET.map(c => `${cond} == ${c}`).join(' || '),
          draw(FULL, el('Ellipse', { x: C - 2, y: top - 8.5, width: 4, height: 4 },
            transform('y', `${top - 8.5} - ${G.BAR_SPAN} * ${k}`), fill('#4FD8FF')))),
      ])));
  }
  return group('corona_setting', FULL, ambientOff(),
    el('BooleanConfiguration', { id: 'corona' }, el('BooleanOption', { id: 'TRUE' },
      group('corona', { ...FULL, ...PIVOT }, transform('angle', '[HOUR_0_11] * 30'), ...bars))));
}

function hourTicks() {
  const lines = [];
  for (let h = 0; h < 12; h++) lines.push(line(pt(G.TICK_R0, h * 30), pt(G.TICK_R1, h * 30), stroke(FAINT, 1.5, 'BUTT')));
  return draw(FULL, ambientOff(), ...lines);
}

function numerals() {
  return [['12', 0], ['3', 90], ['6', 180], ['9', 270]].map(([t, a]) => {
    const p = pt(G.NUMERAL_R, a);
    return label(box(p[0], p[1], 30, 20), FM, 16, FAINT, text(t), {}, {}, ambientOff());
  });
}

// ---- Hour frame: crescent, minute ring, satellite ---------------------------
function minuteRing() {
  const R = 150; // ring centre inside its 300-unit holder
  const rp = (r, a) => pt(r, a, R, R);
  const minor = [], major = [];
  for (let m = 0; m < 60; m++) {
    if (m % 5) minor.push(line(rp(RM - 6, m * 6), rp(RM - 1, m * 6), stroke('#5D6279', 1.1, 'BUTT')));
    else if (m === 0) for (const dx of [-2.2, 2.2]) major.push(line([R + dx, R - RM + 15], [R + dx, R - RM + 1], stroke('#CFD3E6', 1.8, 'BUTT')));
    else major.push(line(rp(RM - (m % 15 ? 11 : 15), m * 6), rp(RM - 1, m * 6), stroke('#CFD3E6', m % 15 ? 1.1 : 2.2, 'BUTT')));
  }
  const HOLDER = { x: 0, y: 0, width: 300, height: 300 };
  const top = R - RM; // satellite centre y, at 12 o'clock on the ring
  const trail = [];
  for (let i = 0; i < 8; i++) {
    trail.push(draw({ ...HOLDER, alpha: Math.round(255 * (i + 1) / 8 * 0.9) },
      el('Arc', { centerX: R, centerY: R, width: 2 * RM, height: 2 * RM, startAngle: 290 + i * 8.75, endAngle: 290 + (i + 1) * 8.75 + 0.6, direction: 'CLOCKWISE' },
        stroke(ACCENT, 4, 'BUTT'))));
  }
  const moonlet = el('BooleanConfiguration', { id: 'seconds' }, el('BooleanOption', { id: 'TRUE' },
    when(`[BATTERY_PERCENT] > 15 && [REFERENCE.power_saving] == 0 && ${OFF} == 0`,
      group('moonlet', { x: R - 20, y: top - 20, width: 40, height: 40, ...PIVOT }, ambientOff(),
        transform('angle', '[SECOND] * 6'),
        draw({ x: 0, y: 0, width: 40, height: 40 }, circle(20, 20 - G.MOON_R, 2.3, fill('#FFFFFF')))))));
  const satellite = group('satellite', { ...HOLDER, ...PIVOT },
    transform('angle', MINUTE_ANGLE),
    transform('alpha', `255 - 204 * clamp(${OFF}, 0, 1)`),
    group('trail', HOLDER, ambientOff(), ...trail),
    draw({ ...HOLDER, alpha: 40 }, ambientOff(), circle(R, top, 14, fill(ACCENT))),
    draw({ ...HOLDER, alpha: 70 }, ambientOff(), circle(R, top, 10, fill(ACCENT))),
    draw(HOLDER, circle(R, top, 6.5, fill(ACCENT))),
    group('seconds_setting', HOLDER, moonlet),
    label(box(R, R - G.TAG_R, 36, 22), FB, 17, ACCENT, template('%s', '[MINUTE_Z]'), {}, PIVOT, transform('angle', `0 - (${MINUTE_ANGLE})`)));
  return group('minute_ring', { x: C - R, y: C - D - R, width: 300, height: 300, ...PIVOT },
    transform('angle', `0 - (${HOUR_ANGLE})`),
    draw(HOLDER, el('Variant', { mode: 'AMBIENT', target: 'alpha', value: '150', duration: '0' }),
      circle(R, R, RM, stroke('#CFD3E6', 1.2, 'BUTT'))),
    draw(HOLDER, ambientOff(), ...minor),
    draw(HOLDER, ...major),
    satellite);
}

function hourFrame() {
  return group('hour_frame', { ...FULL, ...PIVOT },
    transform('angle', HOUR_ANGLE),
    // The gradient runs 36 units past the crescent so its last stop, which
    // holds the satellite colour, is never reached.
    draw(FULL, ambientOff(), circle(C, C, RF, el('Fill', { color: '#6A4DFF' },
      el('LinearGradient', { startX: C, startY: C - RF, endX: C, endY: C + RF + 36, colors: '[CONFIGURATION.accent]', positions: '0 0.5 0.9 1' })))),
    draw(FULL, circle(C, C - D, RM, fill('#000000'))),
    minuteRing(),
    draw({ ...FULL, ...PIVOT, angle: 355.5 }, arc(RF, 0, 9, 'CLOCKWISE', stroke('#FFFFFF', 6, 'ROUND'))));
}

// ---- Core ------------------------------------------------------------------
const GLYPH = '#C9CEE6';
function glyphShapes(kind) {
  const cloud = dy => [
    circle(4.2, 10.2 + dy, 3.2, fill(GLYPH)), circle(8, 7.5 + dy, 4, fill(GLYPH)), circle(12, 9.8 + dy, 3.2, fill(GLYPH)),
    line([4.2, 11.6 + dy], [12, 11.6 + dy], stroke(GLYPH, 3.6, 'ROUND')),
  ];
  const s = (a, b, color = GLYPH, w = 1.4) => line(a, b, stroke(color, w, 'ROUND'));
  switch (kind) {
    case 'sun': {
      const rays = [];
      for (let i = 0; i < 8; i++) rays.push(s(pt(5.4, i * 45, 8, 8), pt(7.4, i * 45, 8, 8), GLYPH, 1.2));
      return [circle(8, 8, 3.6, fill(GLYPH)), ...rays];
    }
    case 'moon': return [circle(8, 8, 5.6, fill(GLYPH)), circle(10.6, 6, 5, fill('#000000'))];
    case 'partly': return [circle(11.2, 4.6, 3.2, fill(GLYPH)), circle(8, 8.6, 4.8, fill('#000000')), ...cloud(1)];
    case 'cloud': return cloud(0);
    case 'fog': return [s([2, 4.5], [14, 4.5], GLYPH, 1.6), s([2, 8], [14, 8], GLYPH, 1.6), s([2, 11.5], [14, 11.5], GLYPH, 1.6)];
    case 'wind': return [s([1.5, 5], [11, 5], GLYPH, 1.6), s([3.5, 8.5], [14.5, 8.5], GLYPH, 1.6), s([1.5, 12], [9, 12], GLYPH, 1.6)];
    case 'rain': return [...cloud(-3), s([4.8, 12.4], [3.9, 15.2], '#4FD8FF'), s([8.4, 12.4], [7.5, 15.2], '#4FD8FF'), s([12, 12.4], [11.1, 15.2], '#4FD8FF')];
    case 'snow': return [...cloud(-3), circle(4.4, 13.8, 1.1, fill('#FFFFFF')), circle(8, 13.8, 1.1, fill('#FFFFFF')), circle(11.6, 13.8, 1.1, fill('#FFFFFF'))];
    case 'storm': return [...cloud(-3), s([9, 11.2], [6.6, 13.4], '#FFD23E', 1.3), s([6.6, 13.4], [9, 13.4], '#FFD23E', 1.3), s([9, 13.4], [7.2, 15.8], '#FFD23E', 1.3)];
  }
}
function weatherGlyph(x, y) {
  const c = '[WEATHER.CONDITION]';
  const any = (...v) => v.map(n => `${c} == ${n}`).join(' || ');
  const part = kind => draw({ x, y, width: 16, height: 16 }, ...glyphShapes(kind));
  const cases = [
    ['clear_day', `(${any(1, 8)}) && [WEATHER.IS_DAY]`, 'sun'],
    ['clear_night', any(1, 8), 'moon'],
    ['partly', any(14), 'partly'],
    ['cloudy', any(2), 'cloud'],
    ['fog', any(3, 13), 'fog'],
    ['rain', any(4, 6, 12), 'rain'],
    ['snow', any(5, 7, 10, 11), 'snow'],
    ['storm', any(9), 'storm'],
    ['wind', any(15), 'wind'],
  ];
  return el('Condition', {},
    el('Expressions', {}, ...cases.map(([n, e]) => el('Expression', { name: n }, text(e)))),
    ...cases.map(([n, , kind]) => el('Compare', { expression: n }, part(kind))));
}

const WEEKDAY = `subText(${q('SUNMONTUEWEDTHUFRISAT')}, ([DAY_OF_WEEK] - 1) * 3, [DAY_OF_WEEK] * 3)`;
const dateTemplate = () => template('%s %s', WEEKDAY, `numberFormat(${q('0')}, [DAY])`);

function core() {
  const batteryArc = color => draw(FULL, arc(G.BATTERY_R, 0, 360, 'CLOCKWISE',
    transform('endAngle', '3.6 * clamp([BATTERY_PERCENT], 1, 100)'), stroke(color, 2.4, 'ROUND')));
  const battery = group('battery', FULL, ambientOff(),
    draw(FULL, circle(C, C, G.BATTERY_R, stroke('#23273A', 2.4, 'BUTT'))),
    el('Condition', {},
      el('Expressions', {},
        el('Expression', { name: 'critical' }, text('[BATTERY_PERCENT] <= 10')),
        el('Expression', { name: 'low' }, text('[BATTERY_PERCENT] <= 20'))),
      el('Compare', { expression: 'critical' }, batteryArc('#FF453A')),
      el('Compare', { expression: 'low' }, batteryArc('#FFC53D')),
      el('Default', {}, batteryArc(INK))));

  const LINE1 = box(C, 191, 96, 16), BIG = box(C, 223, 116, 52), LINE3 = box(C, 257, 96, 15);
  const centredDate = () => label(LINE1, FM, 13, '#9AA0BB', dateTemplate());

  // Weather: glyph and date share the top row, so the date is left-aligned.
  const weatherMode = group('core_weather', FULL, ambientOff(),
    when('[WEATHER.IS_AVAILABLE]', [
      weatherGlyph(191, 183),
      label({ x: 211, y: 183, width: 60, height: 16 }, FM, 13, '#9AA0BB', dateTemplate(), { align: 'START' }),
      label(BIG, FB, 44, '#F3F5FF', template('%s°', '[WEATHER.TEMPERATURE]'), { isAutoSize: 'TRUE' }),
      label(LINE3, FM, 12, '#9AA0BB', template('H %s · L %s', HI, LO)),
      label({ x: 262, y: 200, width: 12, height: 14 }, FB, 12, '#FFC53D', text('!'), {}, {}, transform('alpha', '[WEATHER.IS_ERROR] ? 255 : 0')),
    ], [
      centredDate(),
      label(BIG, FB, 44, '#F3F5FF', text('—')),
      label(LINE3, FM, 12, '#9AA0BB', text('H — · L —')),
    ]));
  // Always-on in weather mode keeps only a centred date.
  const ambientDate = group('core_ambient_date', { ...FULL, alpha: 0 },
    el('Variant', { mode: 'AMBIENT', target: 'alpha', value: '255', duration: '0' }), centredDate());

  const ampm = `[IS_24_HOUR_MODE] ? ${q('')} : [AMPM_STRING_ENG]`;
  const timeMode = group('core_time', FULL,
    centredDate(),
    el('DigitalClock', BIG, el('TimeText', { format: 'h:mm', hourFormat: 'SYNC_TO_DEVICE', align: 'CENTER', x: 0, y: 0, width: BIG.width, height: BIG.height },
      el('Font', { family: FB, size: 36, color: '#F3F5FF' }))),
    group('core_time_detail', FULL, ambientOff(),
      when('[WEATHER.IS_AVAILABLE]',
        label(LINE3, FM, 12, '#9AA0BB', template('%s  %s°', ampm, '[WEATHER.TEMPERATURE]')),
        label(LINE3, FM, 12, '#9AA0BB', template('%s', ampm)))));

  // Foresight replaces the core with one forecast hour at a time.
  const X = `([HOUR_0_23] + ${IDX}) % 24`;
  const hourText = `[IS_24_HOUR_MODE] ? numberFormat(${q('00')}, ${X}) : numberFormat(${q('0')}, (${X}) % 12 == 0 ? 12 : (${X}) % 12)`;
  const hourSuffix = `[IS_24_HOUR_MODE] ? ${q(':00')} : ((${X}) < 12 ? ${q('AM')} : ${q('PM')})`;
  const foreTemp = byHour(i => `(${hourField(i, 'IS_AVAILABLE')} ? numberFormat(${q('0')}, ${hourField(i, 'TEMPERATURE')}) : ${q('—')})`, q('—'));
  const foreName = byHour(i => `(${hourField(i, 'IS_AVAILABLE')} ? ${hourField(i, 'CONDITION_NAME')} : ${q('')})`, q(''));
  const foresight = [
    label(LINE1, FM, 13, ACCENT, template('+%sH · %s%s', `numberFormat(${q('0')}, ${IDX})`, hourText, hourSuffix)),
    label(BIG, FB, 44, '#F3F5FF', template('%s°', foreTemp), { isAutoSize: 'TRUE' }),
    label(LINE3, FM, 12, '#9AA0BB', template('%s', foreName), { isAutoSize: 'TRUE' }),
  ];

  const modes = group('core_modes', FULL, el('ListConfiguration', { id: 'core' },
    el('ListOption', { id: '0' }, group('core_mode_weather', FULL, weatherMode, ambientDate)),
    el('ListOption', { id: '1' }, timeMode)));
  return [battery, when(`${IDX} > 0`, foresight, modes)];
}

// ---- Rim complication slots -------------------------------------------------
const PROVIDERS = {
  10: { defaultSystemProvider: 'SUNRISE_SUNSET', defaultSystemProviderType: 'SHORT_TEXT' },
  20: { primaryProvider: 'com.bobbfwed.emberphase.health/com.bobbfwed.emberphase.health.watch.CaloriesDataSource', primaryProviderType: 'GOAL_PROGRESS', defaultSystemProvider: 'EMPTY', defaultSystemProviderType: 'EMPTY' },
  30: { primaryProvider: 'com.samsung.android.wear.shealth/com.samsung.android.wear.shealth.complications.steps.StepsComplicationProviderService', primaryProviderType: 'GOAL_PROGRESS', defaultSystemProvider: 'STEP_COUNT', defaultSystemProviderType: 'RANGED_VALUE' },
  40: { primaryProvider: 'com.bobbfwed.emberphase.health/com.bobbfwed.emberphase.health.watch.MinutesDataSource', primaryProviderType: 'GOAL_PROGRESS', defaultSystemProvider: 'EMPTY', defaultSystemProviderType: 'EMPTY' },
};
function rimSlot(slot) {
  const a = slot.angle, top = G.isTop(a);
  // Reading direction: clockwise on the upper half, counter-clockwise below.
  const lead = top ? a - 25 : a + 25;
  const textArc = top
    ? { width: 2 * G.RIM_TEXT_TOP, height: 2 * G.RIM_TEXT_TOP, startAngle: a - 19, endAngle: a + 29, direction: 'CLOCKWISE' }
    : { width: 2 * G.RIM_TEXT_BOTTOM, height: 2 * G.RIM_TEXT_BOTTOM, startAngle: a + 19, endAngle: a - 29, direction: 'COUNTER_CLOCKWISE' };
  const curved = (...fonts) => el('PartText', FULL,
    el('TextCircular', { centerX: C, centerY: C, ...textArc, align: 'CENTER', ellipsis: 'TRUE' }, ...fonts));
  const title = () => el('Font', { family: FM, size: 14.5, color: DIM }, el('Upper', {}, template('%s ', '[COMPLICATION.TITLE]')));
  const value = expr => el('Font', { family: FB, size: 14.5, color: INK }, template('%s', expr));
  const ip = pt(206, lead);
  const icon = () => el('PartImage', { ...box(ip[0], ip[1], 16, 16), ...PIVOT, angle: top ? lead : lead + 180, tintColor: DIM },
    el('Image', { resource: '[COMPLICATION.MONOCHROMATIC_IMAGE]' }));
  const h = G.RIM_PROGRESS_HALF, start = top ? a - h : a + h, dir = top ? 'CLOCKWISE' : 'COUNTER_CLOCKWISE', sign = top ? '+' : '-';
  const progress = f => [
    draw(FULL, arc(G.RIM_PROGRESS_R, start, top ? a + h : a - h, dir, stroke(TRACK, 2.2, 'ROUND'))),
    draw(FULL, transform('alpha', `(${f}) > 0 ? 255 : 0`),
      arc(G.RIM_PROGRESS_R, start, start, dir, transform('endAngle', `${start} ${sign} ${2 * h} * (${f})`), stroke(INK, 2.2, 'ROUND'))),
  ];
  const GV = '[COMPLICATION.GOAL_PROGRESS_VALUE]', GT = '[COMPLICATION.GOAL_PROGRESS_TARGET_VALUE]';
  const RV = '[COMPLICATION.RANGED_VALUE_VALUE]', RMIN = '[COMPLICATION.RANGED_VALUE_MIN]', RMAX = '[COMPLICATION.RANGED_VALUE_MAX]';
  const grouped = q('#,##0');
  return el('ComplicationSlot', { slotId: slot.id, name: slot.key, displayName: `${slot.key}_slot`, ...FULL, supportedTypes: 'GOAL_PROGRESS RANGED_VALUE SHORT_TEXT EMPTY', isCustomizable: 'TRUE' },
    ambientOff(),
    el('BoundingArc', { centerX: C, centerY: C, width: 2 * G.RIM_MID, height: 2 * G.RIM_MID, thickness: G.RIM_THICKNESS, startAngle: a - G.RIM_HALF, endAngle: a + G.RIM_HALF, direction: 'CLOCKWISE' }),
    el('DefaultProviderPolicy', PROVIDERS[slot.id]),
    el('Complication', { type: 'GOAL_PROGRESS' }, icon(), curved(title(), value(`numberFormat(${grouped}, ${GV})`)),
      progress(`${GT} > 0 ? clamp(${GV} / ${GT}, 0, 1) : 0`)),
    el('Complication', { type: 'RANGED_VALUE' }, icon(),
      curved(title(), value(`textLength([COMPLICATION.TEXT]) > 0 ? [COMPLICATION.TEXT] : numberFormat(${grouped}, ${RV})`)),
      progress(`${RMAX} > ${RMIN} ? clamp((${RV} - ${RMIN}) / (${RMAX} - ${RMIN}), 0, 1) : 0`)),
    el('Complication', { type: 'SHORT_TEXT' }, icon(), curved(title(), value('[COMPLICATION.TEXT]'))),
    el('Complication', { type: 'EMPTY' }, curved(el('Font', { family: FB, size: 14.5, color: DIM }, text('—')))));
}

// ---- Fixed data slots -------------------------------------------------------
function fixedSlot(id, name, bounding, provider, reference, value) {
  return el('ComplicationSlot', { slotId: id, name, displayName: `${name}_slot`, ...(bounding.slot || FULL), supportedTypes: 'RANGED_VALUE EMPTY', isCustomizable: 'FALSE' },
    ambientOff(),
    bounding.shape,
    el('DefaultProviderPolicy', { primaryProvider: `com.bobbfwed.emberphase.health/com.bobbfwed.emberphase.health.watch.${provider}`, primaryProviderType: 'RANGED_VALUE', defaultSystemProvider: 'EMPTY', defaultSystemProviderType: 'EMPTY' }),
    el('Complication', { type: 'RANGED_VALUE' },
      group(`${reference}_export`, { x: 0, y: 0, width: 1, height: 1 }, transform('angle', value),
        el('Reference', { name: reference, source: 'angle', defaultValue: 0 }))));
}

// ---- Document ---------------------------------------------------------------
const r = G.CORE_TAP_R;
const scene = el('Scene', { backgroundColor: '#000000' },
  foresightControl(),
  hourTicks(),
  corona(),
  numerals(),
  hourFrame(),
  draw(FULL, el('Variant', { mode: 'AMBIENT', target: 'alpha', value: '110', duration: '0' }), circle(C, C, RF, stroke('#8E93AD', 1, 'BUTT'))),
  core(),
  G.RIM_SLOTS.map(rimSlot),
  // The reserved range marks a genuine tap timestamp from the companion.
  fixedSlot(50, 'foresight', { shape: el('BoundingOval', { x: C - r, y: C - r, width: 2 * r, height: 2 * r }) }, 'SweepDataSource', 'fore_start',
    '[COMPLICATION.RANGED_VALUE_MAX] == 86400000 && [COMPLICATION.RANGED_VALUE_MIN] == 0 ? [COMPLICATION.RANGED_VALUE_VALUE] : 0'),
  // On the dial, inside the circle: a corner slot is clipped and never activates.
  fixedSlot(60, 'power_saving', { slot: { x: 400, y: 220, width: 8, height: 8 }, shape: el('BoundingBox', { x: 0, y: 0, width: 8, height: 8 }) }, 'PowerSaveDataSource', 'power_saving',
    '[COMPLICATION.RANGED_VALUE_VALUE] > 0 ? 1 : 0'));

const config = el('UserConfigurations', {},
  el('ColorConfiguration', { id: 'accent', displayName: 'accent_setting', defaultValue: '0' },
    ...G.THEMES.map(t => el('ColorOption', { id: t.id, displayName: t.key, colors: t.colors.join(' ') }))),
  el('ListConfiguration', { id: 'core', displayName: 'core_setting', defaultValue: '0' },
    el('ListOption', { id: '0', displayName: 'core_weather' }),
    el('ListOption', { id: '1', displayName: 'core_time' })),
  el('BooleanConfiguration', { id: 'seconds', displayName: 'seconds_setting', defaultValue: 'TRUE' }),
  el('BooleanConfiguration', { id: 'corona', displayName: 'corona_setting', defaultValue: 'TRUE' }));

export const xml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by scripts/New-WatchFace.mjs. Do not edit by hand. WFF 4, no application code. -->
${el('WatchFace', { width: 450, height: 450, clipShape: 'CIRCLE' },
  el('Metadata', { key: 'CLOCK_TYPE', value: 'ANALOG' }),
  el('Metadata', { key: 'PREVIEW_TIME', value: '10:08:32' }),
  config, scene)}
`;

const target = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'watchface', 'src', 'main', 'res', 'raw', 'watchface.xml');
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, xml);
  console.log(`Wrote ${target} (${xml.length} bytes)`);
}
