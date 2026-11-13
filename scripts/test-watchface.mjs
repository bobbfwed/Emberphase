// Dependency-free checks for the generated Apsis layout:
//   node scripts/test-watchface.mjs
// They evaluate the WFF expressions in JavaScript and check geometry and
// resource contracts. They do not emulate the Wear OS renderer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from './lib/apsis-geometry.mjs';
import { xml as generated } from './New-WatchFace.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const res = path.join(root, 'watchface/src/main/res');
const face = fs.readFileSync(path.join(res, 'raw/watchface.xml'), 'utf8').replace(/\r\n/g, '\n');
const strings = fs.readFileSync(path.join(res, 'values/strings.xml'), 'utf8');
const unescape = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
let checks = 0;
const test = (name, fn) => { fn(); checks++; };

// ---- Expression evaluation --------------------------------------------------
const fns = {
  clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
  round: Math.round, floor: Math.floor,
  textLength: s => String(s).length,
  subText: (s, a, b) => String(s).substring(a, b),
  numberFormat: (pattern, v) => {
    const n = Math.round(v);
    if (pattern === '#,##0') return n.toLocaleString('en-US');
    if (pattern === '00') return String(n).padStart(2, '0');
    if (pattern === '0') return String(n);
    throw new Error(`Unexpected number pattern ${pattern}`);
  },
  colorRgb: (r, g, b) => [r, g, b],
};
function evaluate(expr, sources) {
  const js = expr.replace(/\[([A-Z0-9_.a-z]+)\]/g, (_, name) => {
    assert.ok(name in sources, `Expression needs [${name}]: ${expr.slice(0, 80)}`);
    return `S[${JSON.stringify(name)}]`;
  }).replace(/(?<![=!<>])==(?!=)/g, '===');
  return new Function('S', ...Object.keys(fns), `return (${js});`)(sources, ...Object.values(fns));
}
const allExpressions = [
  ...[...face.matchAll(/\b(?:value|expression)="([^"]*)"/g)].map(m => unescape(m[1])),
  ...[...face.matchAll(/<Expression name="[^"]*">([^<]*)<\/Expression>/g)].map(m => unescape(m[1])),
];
// The value of the Transform that follows the named element's opening tag.
function transformOf(elementPattern, target) {
  const at = face.search(elementPattern);
  assert.ok(at >= 0, `Missing element ${elementPattern}`);
  const m = face.slice(at).match(new RegExp(`<Transform target="${target}" value="([^"]*)"`));
  assert.ok(m, `Missing ${target} transform after ${elementPattern}`);
  return unescape(m[1]);
}

// ---- Generator and document contracts ---------------------------------------
test('generated layout is current', () => {
  assert.equal(face, generated, 'watchface.xml is stale: run node scripts/New-WatchFace.mjs');
});
test('expression syntax rules', () => {
  assert.ok(allExpressions.length > 100);
  for (const e of allExpressions) {
    // The WFF runtime requires double-quoted string literals.
    assert.ok(!e.includes("'"), `Single quote in expression: ${e.slice(0, 80)}`);
    let depth = 0;
    for (const ch of e) { if (ch === '(') depth++; if (ch === ')') depth--; assert.ok(depth >= 0, `Unbalanced: ${e.slice(0, 80)}`); }
    assert.equal(depth, 0, `Unbalanced parentheses: ${e.slice(0, 80)}`);
    assert.equal((e.match(/"/g) || []).length % 2, 0, `Unbalanced quotes: ${e.slice(0, 80)}`);
    assert.ok(!/\b(min|max)\(/.test(e), 'WFF has no min or max function');
  }
});
test('sources, references and configuration ids resolve', () => {
  const known = new Set(['HOUR_0_11_MINUTE', 'HOUR_0_11', 'HOUR_0_23', 'MINUTE', 'MINUTE_Z', 'SECOND', 'DAY', 'DAY_OF_WEEK', 'UTC_TIMESTAMP',
    'IS_24_HOUR_MODE', 'AMPM_STATE', 'BATTERY_PERCENT', 'WEATHER.IS_AVAILABLE', 'WEATHER.IS_ERROR', 'WEATHER.CONDITION', 'WEATHER.IS_DAY',
    'WEATHER.TEMPERATURE', 'WEATHER.DAY_TEMPERATURE_HIGH', 'WEATHER.DAY_TEMPERATURE_LOW',
    'COMPLICATION.TITLE', 'COMPLICATION.TEXT', 'COMPLICATION.MONOCHROMATIC_IMAGE', 'COMPLICATION.GOAL_PROGRESS_VALUE',
    'COMPLICATION.GOAL_PROGRESS_TARGET_VALUE', 'COMPLICATION.RANGED_VALUE_VALUE', 'COMPLICATION.RANGED_VALUE_MIN', 'COMPLICATION.RANGED_VALUE_MAX']);
  const references = new Set([...face.matchAll(/<Reference name="([^"]+)"/g)].map(m => m[1]));
  assert.deepEqual([...references].sort(), ['fore_idx', 'fore_off', 'fore_progress', 'fore_start', 'power_saving']);
  const configs = new Set([...face.matchAll(/<(?:List|Boolean)Configuration id="([^"]+)" displayName/g)].map(m => m[1]));
  for (const m of face.matchAll(/\[([A-Z][A-Za-z0-9_.]*)\]/g)) {
    const name = m[1];
    if (name.startsWith('REFERENCE.')) assert.ok(references.has(name.slice(10)), `Undefined reference ${name}`);
    else if (name.startsWith('CONFIGURATION.')) assert.ok(configs.has(name.split('.')[1]), `Undefined configuration ${name}`);
    else if (/^WEATHER\.HOURS\.\d+\./.test(name)) {
      const [, , index, field] = name.split('.');
      assert.ok(+index >= 1 && +index <= G.FORECAST_HOURS, `Forecast index out of range: ${name}`);
      assert.ok(['IS_AVAILABLE', 'CONDITION', 'CONDITION_NAME', 'TEMPERATURE'].includes(field), name);
    } else assert.ok(known.has(name), `Unknown source [${name}]`);
  }
  for (const m of face.matchAll(/<(?:List|Boolean)Configuration id="([^"]+)">/g)) assert.ok(configs.has(m[1]), `Undefined setting ${m[1]}`);
});
test('labels, fonts and images exist', () => {
  for (const m of face.matchAll(/displayName="([^"]+)"/g)) assert.ok(strings.includes(`name="${m[1]}"`), `Missing string ${m[1]}`);
  // Samsung formats editor labels, so a literal percent sign crashes its editor.
  assert.ok(!/<string[^>]*>[^<]*%/.test(strings), 'Labels must not contain a percent sign');
  for (const m of face.matchAll(/family="([^"]+)"/g)) assert.ok(fs.existsSync(path.join(res, 'font', `${m[1]}.ttf`)), `Missing font ${m[1]}`);
  assert.ok(fs.existsSync(path.join(res, 'drawable-nodpi/preview.png')));
  assert.ok(fs.existsSync(path.join(res, 'drawable/ic_apsis.xml')));
  assert.ok(!face.includes('PartAnimatedImage'), 'No animated images');
});
test('complication slots', () => {
  const slots = [...face.matchAll(/<ComplicationSlot slotId="(\d+)"[^>]*isCustomizable="(TRUE|FALSE)"/g)].map(m => [+m[1], m[2]]);
  assert.deepEqual(slots, [[10, 'TRUE'], [20, 'TRUE'], [30, 'TRUE'], [40, 'TRUE'], [50, 'FALSE'], [60, 'FALSE']]);
  assert.ok(slots.length <= 8, 'WFF allows at most eight slots');
  // Rim arcs must not overlap each other and must stay on the display.
  const arcs = [...face.matchAll(/<BoundingArc[^>]*startAngle="([\d.]+)" endAngle="([\d.]+)"/g)].map(m => [+m[1], +m[2]]);
  assert.equal(arcs.length, 4);
  arcs.forEach(([s, e], i) => { const next = arcs[(i + 1) % 4][0] + (i === 3 ? 360 : 0); assert.ok(e < next, 'Rim slots overlap'); assert.ok(e - s <= 60); });
  assert.ok(G.RIM_MID + G.RIM_THICKNESS / 2 <= G.C - 3, 'Rim slot leaves the display');
  assert.ok(G.RIM_PROGRESS_R + 1.1 <= G.RIM_MID + G.RIM_THICKNESS / 2, 'Progress line outside its slot');
  assert.ok(G.RIM_TEXT_TOP - 1 >= G.RIM_MID - G.RIM_THICKNESS / 2, 'Rim text outside its slot');
  // The power-saving slot must be on the dial, or it never activates.
  const corner = Math.hypot(408 - G.C, 228 - G.C);
  assert.ok(corner < G.C, 'Power-saving slot is clipped');
});

// ---- Geometry ---------------------------------------------------------------
test('ring geometry', () => {
  assert.equal(G.RM + G.D, G.RF, 'The minute ring must be tangent to the hour circle');
  const clear = G.TAG_R - G.TAG_HALF - G.D;
  assert.ok(clear >= G.BATTERY_R + 2, `Minute number can reach the core (clear radius ${clear})`);
  assert.ok(G.CORE_TAP_R < G.BATTERY_R);
  assert.ok(G.RF < G.TICK_R0 && G.TICK_R1 < G.BAR_R0);
  const barTop = G.BAR_R0 + G.BAR_MIN + G.BAR_SPAN + G.DOT_GAP + G.DOT_R;
  assert.ok(barTop <= G.RIM_MID - G.RIM_THICKNESS / 2, `Forecast bars reach the rim (${barTop})`);
  // Satellite and moonlet stay inside the hour circle side of the corona.
  assert.ok(G.D + G.RM + G.MOON_R + 2.3 < G.BAR_R0 + 5);
});

// ---- Foresight ---------------------------------------------------------------
const base = { 'REFERENCE.fore_start': 0, 'REFERENCE.fore_progress': 1, 'REFERENCE.fore_off': 0, 'REFERENCE.fore_idx': 0 };
test('Foresight progress and offset', () => {
  const progress = transformOf(/<Group name="fore_progress_source"/, 'angle');
  const at = (start, now) => evaluate(progress, { 'UTC_TIMESTAMP': now, 'REFERENCE.fore_start': start + 1 });
  assert.equal(at(1000, 1000), 0);
  assert.ok(Math.abs(at(1000, 4000) - 0.5) < 1e-9);
  assert.equal(at(1000, 7000), 1);
  assert.equal(at(1000, 90000), 1);
  // A tap just before UTC midnight keeps running across the wrap.
  assert.ok(Math.abs(at(86400000 - 1500, 86400000 * 3 + 1500) - 0.5) < 1e-9);
  const offset = transformOf(/<Group name="fore_off_source"/, 'angle');
  const off = p => evaluate(offset, { 'REFERENCE.fore_progress': p });
  assert.equal(off(0), 0);
  assert.equal(off(0.75), G.FORECAST_HOURS);
  assert.equal(off(0.8), G.FORECAST_HOURS);
  assert.equal(off(1), 0);
  for (let p = 0; p <= 1.0001; p += 0.01) {
    assert.ok(Math.abs(off(p) - G.foresightOffset(p)) < 1e-9);
    assert.ok(off(p) >= 0 && off(p) <= G.FORECAST_HOURS);
  }
  const gate = unescape(face.match(/<Group name="foresight_control"[\s\S]*?<Expression name="test">([^<]*)</)[1]);
  assert.equal(evaluate(gate, { 'REFERENCE.fore_start': 5, 'BATTERY_PERCENT': 15 }), false);
  assert.equal(evaluate(gate, { 'REFERENCE.fore_start': 5, 'BATTERY_PERCENT': 16 }), true);
  assert.equal(evaluate(gate, { 'REFERENCE.fore_start': 0, 'BATTERY_PERCENT': 90 }), false);
});

// ---- Time ---------------------------------------------------------------------
test('hour and minute angles', () => {
  const hour = transformOf(/<Group name="hour_frame"/, 'angle');
  const ring = transformOf(/<Group name="minute_ring"/, 'angle');
  const sat = transformOf(/<Group name="satellite"/, 'angle');
  for (let h = 0; h < 12; h++) for (const m of [0, 17, 59]) {
    const s = { ...base, 'HOUR_0_11_MINUTE': h + m / 60, 'MINUTE': m };
    assert.ok(Math.abs(evaluate(hour, s) - (h * 30 + m / 2)) < 1e-9);
    // The ring counter-rotates so its ticks and minute number stay upright.
    assert.ok(Math.abs(evaluate(hour, s) + evaluate(ring, s)) < 1e-9);
    assert.equal(evaluate(sat, s), m * 6);
  }
  assert.equal(evaluate(hour, { ...base, 'HOUR_0_11_MINUTE': 3, 'REFERENCE.fore_off': 8 }), 330);
  const tag = face.match(/<Transform target="angle" value="(0 - \(\[MINUTE\] \* 6\))"/);
  assert.ok(tag, 'The minute number must counter-rotate the satellite');
  const fade = transformOf(/<Group name="satellite"/, 'alpha');
  assert.equal(evaluate(fade, base), 255);
  assert.equal(evaluate(fade, { ...base, 'REFERENCE.fore_off': 4 }), 51);
});
test('date text', () => {
  const day = unescape(face.match(/expression="(subText\(&quot;SUNMON[^"]*)"/)[1]);
  ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].forEach((name, i) => assert.equal(evaluate(day, { 'DAY_OF_WEEK': i + 1 }), name));
});

// ---- Corona ---------------------------------------------------------------------
test('forecast bars', () => {
  const bars = [...face.matchAll(/<Group name="bar_(\d+)"[^>]*angle="(\d+)"/g)];
  assert.equal(bars.length, G.FORECAST_HOURS);
  bars.forEach(m => assert.equal(+m[2], +m[1] * 30, 'Bar i stands i hours ahead'));
  assert.equal(transformOf(/<Group name="corona"/, 'angle'), '[HOUR_0_11] * 30');
  const endY = transformOf(/<Group name="bar_3"/, 'endY'), colour = transformOf(/<Group name="bar_3"/, 'color');
  const dotY = transformOf(/<Group name="bar_3"[\s\S]*?<Ellipse/, 'y'), alpha = transformOf(/<Group name="bar_3"/, 'alpha');
  const wx = (t, lo = 50, hi = 70) => ({ 'WEATHER.HOURS.3.TEMPERATURE': t, 'WEATHER.DAY_TEMPERATURE_LOW': lo, 'WEATHER.DAY_TEMPERATURE_HIGH': hi });
  const top = G.C - G.BAR_R0;
  assert.equal(top - evaluate(endY, wx(50)), G.BAR_MIN);
  assert.equal(top - evaluate(endY, wx(70)), G.BAR_MIN + G.BAR_SPAN);
  assert.equal(top - evaluate(endY, wx(20)), G.BAR_MIN, 'Below today\'s low clamps');
  assert.equal(top - evaluate(endY, wx(99)), G.BAR_MIN + G.BAR_SPAN, 'Above today\'s high clamps');
  assert.equal(top - evaluate(endY, wx(60, 60, 60)), G.BAR_MIN + G.BAR_SPAN / 2, 'Equal high and low must not divide by zero');
  for (const t of [50, 55, 60, 65, 70]) {
    const rgb = evaluate(colour, wx(t)), want = G.barColor((t - 50) / 20).map(Math.round);
    assert.deepEqual(rgb, want);
    rgb.forEach(v => assert.ok(v >= 0 && v <= 255));
    assert.ok(evaluate(endY, wx(t)) - evaluate(dotY, wx(t)) > 4, 'The dot sits above the bar');
  }
  assert.equal(evaluate(alpha, base), Math.round(255 * (1 - 2 * 0.085)));
  assert.equal(evaluate(alpha, { ...base, 'REFERENCE.fore_idx': 3 }), 255);
  assert.equal(evaluate(alpha, { ...base, 'REFERENCE.fore_idx': 5 }), 60);
  const wet = unescape(face.match(/<Expression name="test">(\[WEATHER\.HOURS\.3\.CONDITION\] == [^<]*)</)[1]);
  for (let c = 0; c <= 15; c++) assert.equal(evaluate(wet, { 'WEATHER.HOURS.3.CONDITION': c }), G.WET.includes(c));
});

// ---- Core ---------------------------------------------------------------------
test('battery ring', () => {
  const end = transformOf(/<Group name="battery"[\s\S]*?<Arc/, 'endAngle');
  assert.equal(evaluate(end, { 'BATTERY_PERCENT': 100 }), 360);
  assert.equal(evaluate(end, { 'BATTERY_PERCENT': 50 }), 180);
  assert.ok(evaluate(end, { 'BATTERY_PERCENT': 0 }) > 0 && evaluate(end, { 'BATTERY_PERCENT': 250 }) === 360);
});
test('Foresight readout', () => {
  const params = [...face.matchAll(/\+%sH · %s%s((?:<Parameter expression="[^"]*" \/>)+)/g)][0][1];
  const [idx, hour, suffix] = [...params.matchAll(/expression="([^"]*)"/g)].map(m => unescape(m[1]));
  const s = (h, i, h24) => ({ 'HOUR_0_23': h, 'REFERENCE.fore_idx': i, 'IS_24_HOUR_MODE': h24 });
  assert.equal(evaluate(idx, s(9, 3, 0)), '3');
  assert.equal(evaluate(hour, s(9, 3, 0)) + evaluate(suffix, s(9, 3, 0)), '12PM');
  assert.equal(evaluate(hour, s(22, 2, 0)) + evaluate(suffix, s(22, 2, 0)), '12AM');
  assert.equal(evaluate(hour, s(22, 5, 0)) + evaluate(suffix, s(22, 5, 0)), '3AM');
  assert.equal(evaluate(hour, s(22, 5, 1)) + evaluate(suffix, s(22, 5, 1)), '03:00');
  const temp = unescape(face.match(/%s°<Parameter expression="(\[REFERENCE\.fore_idx\][^"]*)"/)[1]);
  const hours = {};
  for (let i = 1; i <= G.FORECAST_HOURS; i++) { hours[`WEATHER.HOURS.${i}.IS_AVAILABLE`] = i !== 6; hours[`WEATHER.HOURS.${i}.TEMPERATURE`] = 50 + i; }
  for (let i = 1; i <= G.FORECAST_HOURS; i++) assert.equal(evaluate(temp, { ...hours, 'REFERENCE.fore_idx': i }), i === 6 ? '—' : String(50 + i));
  assert.equal(evaluate(temp, { ...hours, 'REFERENCE.fore_idx': 0 }), '—');
});

// ---- Rim ---------------------------------------------------------------------
test('rim progress', () => {
  for (const slot of G.RIM_SLOTS) {
    const at = face.indexOf(`slotId="${slot.id}"`), body = face.slice(at, face.indexOf('</ComplicationSlot>', at));
    const ends = [...body.matchAll(/<Transform target="(?:start|end)Angle" value="([^"]*)"/g)].map(m => unescape(m[1]));
    assert.equal(ends.length, 2);
    const top = G.isTop(slot.angle), h = G.RIM_PROGRESS_HALF, sign = top ? 1 : -1, start = slot.angle - sign * h;
    const goal = (v, t) => evaluate(ends[0], { 'COMPLICATION.GOAL_PROGRESS_VALUE': v, 'COMPLICATION.GOAL_PROGRESS_TARGET_VALUE': t });
    const range = (v, lo, hi) => evaluate(ends[1], { 'COMPLICATION.RANGED_VALUE_VALUE': v, 'COMPLICATION.RANGED_VALUE_MIN': lo, 'COMPLICATION.RANGED_VALUE_MAX': hi });
    assert.equal(goal(0, 100), start);
    assert.equal(goal(50, 100), slot.angle);
    assert.equal(goal(400, 100), start + sign * 2 * h, 'Beyond the goal clamps');
    assert.equal(goal(50, 0), start, 'A missing target shows no progress');
    assert.equal(range(15, 10, 20), slot.angle);
    assert.equal(range(5, 10, 10), start, 'An empty range shows no progress');
    assert.ok(Math.abs(goal(400, 100) - slot.angle) < G.RIM_HALF, 'Progress stays inside the slot');
  }
});

console.log(`${checks} check groups passed over ${allExpressions.length} expressions.`);
