// Dependency-free checks for the generated Meniscus face.
// Evaluates the exact expression strings that ship (scripts/meniscus/expressions.mjs)
// and checks structure, resources, gating and geometry of watchface.xml.
// Run: node scripts/test-meniscus.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import * as G from './meniscus/geometry.mjs';
import * as X from './meniscus/expressions.mjs';
import { buildFace, SLOT_BOUNDS } from './meniscus/build-face.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const res = path.join(root, 'watchface', 'src', 'main', 'res');
const xml = fs.readFileSync(path.join(res, 'raw', 'watchface.xml'), 'utf8').replace(/\r\n/g, '\n');
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error(`FAIL ${name}\n  ${e.message}`); process.exitCode = 1; }
}

// ------------------------------------------------ WFF expression evaluator
// Translates a WFF expression to JS. Sources are looked up in env; unknown
// sources throw so a typo cannot pass silently.
const FUNCS = {
  clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi), sqrt: Math.sqrt, pow: Math.pow, sin: Math.sin, cos: Math.cos,
  exp: Math.exp, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, rad: (d) => d * Math.PI / 180,
  textLength: (s) => String(s).length, numberFormat: (_f, v) => Math.round(v).toLocaleString('en-US'),
  colorArgb: (a, r, g, b) => ({ a, r, g, b })
};
function wff(expr, env) {
  const js = expr.replace(/\[([A-Za-z0-9_.]+)\]/g, (_, name) => {
    if (!(name in env)) throw new Error(`Unbound source [${name}] in ${expr.slice(0, 80)}`);
    return `E[${JSON.stringify(name)}]`;
  });
  return new Function('E', ...Object.keys(FUNCS), `return (${js});`)(env, ...Object.values(FUNCS));
}
const R = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [`REFERENCE.${k}`, v]));

// ------------------------------------------------------------- Generation
test('watchface.xml matches its generator', () => {
  assert.equal(xml, buildFace(), 'run: node scripts/meniscus/build-face.mjs');
});

// ------------------------------------------------------------ Fluid level
test('battery, day and pod levels', () => {
  assert.equal(wff(X.LEVEL_BATTERY, { BATTERY_PERCENT: 68 }), 0.68);
  assert.equal(wff(X.LEVEL_BATTERY, { BATTERY_PERCENT: 140 }), 1);
  assert.equal(wff(X.LEVEL_DAY, { HOUR_0_23: 0, MINUTE: 0 }), 1);
  assert.equal(wff(X.LEVEL_DAY, { HOUR_0_23: 12, MINUTE: 0 }), 0.5);
  assert.ok(wff(X.LEVEL_DAY, { HOUR_0_23: 23, MINUTE: 59 }) < 0.001);
  assert.equal(wff(X.levelPod(2), R({ p2g: 0.7, p2r: 0 })), 0.7);
  // Only the selected feed branch exists; the others fall back to 0.
  const refs = { lv0: 0, lv1: 0, lv2: 0, lv3: 0.4, lv4: 0, lv5: 0 };
  assert.equal(wff(X.LEVEL, R(refs)), 0.4);
});
test('surface height spans the fluid circle', () => {
  const sy = (lvl, bob = 0) => wff(X.SURFACE_Y, R({ lvl, sloshB: bob }));
  assert.equal(sy(0), G.CORE_BOTTOM);
  assert.equal(sy(1), G.CORE_TOP);
  assert.equal(sy(0.5), G.C);
  assert.equal(sy(0.5, 3), G.C + 3);
  const half = (y) => wff(X.HALF, R({ sy: y }));
  assert.equal(half(G.C), G.CORE);
  assert.equal(half(G.CORE_TOP), 0);
  assert.equal(half(G.CORE_BOTTOM + 30), 0, 'clamped outside the circle');
  assert.equal(wff(X.SURFACE_VISIBLE, R({ lvl: 0 })), false);
  assert.equal(wff(X.SURFACE_VISIBLE, R({ lvl: 0.5 })), true);
});
test('low battery warning applies only to the battery fluid', () => {
  assert.equal(wff(X.WARN_FLUID, { BATTERY_PERCENT: 19, ...R({ kind: 1 }) }), true);
  assert.equal(wff(X.WARN_FLUID, { BATTERY_PERCENT: 20, ...R({ kind: 1 }) }), false);
  assert.equal(wff(X.WARN_FLUID, { BATTERY_PERCENT: 5, ...R({ kind: 2 }) }), false);
  assert.equal(wff(X.KIND_LABEL, R({ kind: 1 })), 'BATT');
  assert.equal(wff(X.KIND_LABEL, R({ kind: 2 })), 'DAY');
  assert.equal(wff(X.KIND_LABEL, R({ kind: 3 })), 'GOAL');
});

// ------------------------------------------------------- Tilt, slosh, gates
test('tilt is clamped and signed', () => {
  assert.equal(wff(X.TILT, { ACCELEROMETER_ANGLE_X: 90 }), G.TILT_SIGN * G.TILT_LIMIT);
  assert.equal(wff(X.TILT, { ACCELEROMETER_ANGLE_X: -90 }), -G.TILT_SIGN * G.TILT_LIMIT);
  assert.equal(wff(X.TILT, { ACCELEROMETER_ANGLE_X: -10 }), -10 * G.TILT_SIGN);
  // Quantized: small noise around a value does not change the result.
  assert.equal(wff(X.TILT, { ACCELEROMETER_ANGLE_X: 10.4 }), wff(X.TILT, { ACCELEROMETER_ANGLE_X: 9.7 }));
  assert.equal(Math.abs(wff(X.TILT, { ACCELEROMETER_ANGLE_X: 13.3 })) % G.TILT_STEP, 0);
  assert.equal(wff(X.TILT, { ACCELEROMETER_ANGLE_X: 0 }) + 0, 0);
});
test('motion gates at 20 percent and in power saving', () => {
  const ok = (b, p) => wff(X.MOTION_OK, { BATTERY_PERCENT: b, ...R({ psave: p }) });
  assert.equal(ok(21, 0), true);
  assert.equal(ok(20, 0), false);
  assert.equal(ok(80, 1), false);
  assert.equal(wff(X.SLOSH_ACTIVE, { BATTERY_PERCENT: 80, ...R({ tap: 0, psave: 0 }) }), false);
  assert.equal(wff(X.SLOSH_ACTIVE, { BATTERY_PERCENT: 80, ...R({ tap: 5, psave: 0 }) }), true);
});
test('slosh elapsed time across time zones and UTC midnight', () => {
  const DAY = 86400000;
  for (const offset of [-480, 0, 330, 840]) {
    for (const tapUtc of [0, 1500, 43_200_000, DAY - 1200]) {
      for (const dt of [0, 250, 1000, 3100]) {
        const nowUtc = (tapUtc + dt) % DAY;
        const local = ((nowUtc + offset * 60000) % DAY + DAY) % DAY;
        const env = {
          SECONDS_IN_DAY: Math.floor(local / 1000), MILLISECOND: local % 1000,
          TIMEZONE_OFFSET_MINUTES_DST: offset, ...R({ tap: tapUtc + 1 })
        };
        assert.ok(Math.abs(wff(X.ELAPSED, env) - dt / 1000) < 1e-9, `offset ${offset} tap ${tapUtc} dt ${dt}`);
      }
    }
  }
});
test('slosh wave starts level, stays bounded and settles', () => {
  const at = (e, which) => {
    const DAY = 86400000, tap = 10_000_000, local = tap + e * 1000;
    return wff(which, { SECONDS_IN_DAY: Math.floor(local / 1000), MILLISECOND: Math.round(local % 1000), TIMEZONE_OFFSET_MINUTES_DST: 0, ...R({ tap: tap + 1 }) });
  };
  assert.ok(Math.abs(at(0, X.SLOSH_ANGLE)) < 1e-9);
  let peak = 0;
  for (let e = 0; e <= 3.2; e += 0.01) peak = Math.max(peak, Math.abs(at(e, X.SLOSH_ANGLE)));
  assert.ok(peak > 12 && peak <= G.SLOSH.angle, `peak ${peak}`);
  for (let e = 2.6; e <= 3.2; e += 0.05) assert.ok(Math.abs(at(e, X.SLOSH_ANGLE)) < 1.5);
  assert.equal(at(3.3, X.SLOSH_ANGLE), 0);
  assert.equal(at(3.3, X.SLOSH_BOB), 0);
  for (let e = 0; e <= 3.2; e += 0.01) assert.ok(Math.abs(at(e, X.SLOSH_BOB)) <= G.SLOSH.bob);
});

// ------------------------------------------------------------ Chronocast
test('ring sectors tile the dial from the current hour', () => {
  for (let h = 0; h < 12; h++) {
    const starts = [];
    for (let k = 0; k < 12; k++) {
      const s = wff(X.sectorStart(k), { HOUR_0_11: h }), e = wff(X.sectorEnd(k), { HOUR_0_11: h });
      assert.ok(s >= 0 && s < 360 && e > s && Math.abs(e - s - (30 - G.RING.sectorGap)) < 1e-9);
      starts.push(Math.round(s - G.RING.sectorGap / 2));
    }
    assert.deepEqual([...starts].sort((a, b) => a - b), Array.from({ length: 12 }, (_, i) => i * 30));
    for (let m = 0; m < 60; m++) {
      const cursor = wff(X.CURSOR, { HOUR_0_11_MINUTE: h + m / 60 });
      const s0 = wff(X.sectorStart(0), { HOUR_0_11: h }) - G.RING.sectorGap / 2;
      assert.ok(cursor >= s0 && cursor < s0 + 30, 'cursor lies in the current-hour sector');
    }
  }
});
test('terrain depth stays in range, even with a flat day', () => {
  const s = X.hourSource(4);
  for (const [t, lo, hi] of [[10, 5, 20], [-5, 5, 20], [40, 5, 20], [12, 12, 12]]) {
    const d = wff(X.terrainDepth(s), { 'WEATHER.HOURS.4.TEMPERATURE': t, 'WEATHER.DAY_TEMPERATURE_LOW': lo, 'WEATHER.DAY_TEMPERATURE_HIGH': hi });
    assert.ok(d >= G.RING.terrainMin && d <= G.RING.terrainMin + G.RING.terrainMax, `depth ${d}`);
  }
});
test('every weather condition maps to its colour family', () => {
  const expect = { 0: 'unknown', 1: 'clear', 2: 'cloud', 3: 'fog', 4: 'rain', 5: 'snow', 6: 'rain', 7: 'snow', 8: 'clear', 9: 'storm', 10: 'rain', 11: 'snow', 12: 'rain', 13: 'fog', 14: 'partly', 15: 'wind' };
  const s = X.hourSource(2);
  for (let c = 0; c <= 15; c++) {
    for (const day of [true, false]) {
      const env = { 'WEATHER.IS_AVAILABLE': true, 'WEATHER.HOURS.2.CONDITION': c, 'WEATHER.HOURS.2.IS_DAY': day };
      const col = wff(X.familyColor(s, 200), env);
      if (c === 0) continue; // condition 0 means no forecast for that hour
      const fam = expect[c] === 'clear' ? (day ? 'clearDay' : 'clearNight') : expect[c];
      assert.deepEqual([col.r, col.g, col.b], G.FAMILY_RGB[fam], `condition ${c}`);
      assert.equal(col.a, 200);
      assert.equal(wff(X.rainColor(s), env).a > 0, [4, 6, 9, 10, 12].includes(c));
      assert.equal(wff(X.snowColor(s), env).a > 0, [5, 7, 11].includes(c));
    }
  }
  const off = { 'WEATHER.IS_AVAILABLE': true, 'WEATHER.HOURS.2.CONDITION': 0, 'WEATHER.HOURS.2.IS_DAY': true };
  assert.equal(wff(X.familyColor(s, 200), off).a, 0);
  assert.equal(wff(X.bandColor(s), off).a, 0);
  assert.equal(wff(X.rainColor(s), off).a, 0);
  assert.equal(wff(X.placeholderColor(s), off).a, 255);
});
test('ring labels sit on the ring', () => {
  for (const k of G.RING.labelHours) for (let h = 0; h < 12; h++) {
    const x = wff(X.labelX(k, 40), { HOUR_0_11: h }) + 20, y = wff(X.labelY(k, 18), { HOUR_0_11: h }) + 9;
    assert.ok(Math.abs(Math.hypot(x - G.C, y - G.C) - G.RING.labelRadius) < 1e-6);
  }
});

// ------------------------------------------------------------------ Pods
test('goal and ranged progress never invent goals', () => {
  const goal = (v, t) => ({ 'COMPLICATION.GOAL_PROGRESS_VALUE': v, 'COMPLICATION.GOAL_PROGRESS_TARGET_VALUE': t });
  assert.equal(wff(X.goalFraction, goal(4000, 8000)), 0.5);
  assert.equal(wff(X.goalFraction, goal(9000, 8000)), 1);
  assert.equal(wff(X.goalFraction, goal(500, 0)), 0);
  assert.equal(wff(X.goalDone, goal(8000, 8000)), 1);
  assert.equal(wff(X.goalDone, goal(7999, 8000)), 0);
  assert.equal(wff(X.goalDone, goal(10, 0)), 0);
  const range = (v, lo, hi) => ({ 'COMPLICATION.RANGED_VALUE_VALUE': v, 'COMPLICATION.RANGED_VALUE_MIN': lo, 'COMPLICATION.RANGED_VALUE_MAX': hi });
  assert.equal(wff(X.rangeFraction, range(3000, 0, 6000)), 0.5);
  assert.equal(wff(X.rangeFraction, range(5, 5, 5)), 0);
  assert.equal(wff(X.rangeIsGoal, range(1, 0, 6000)), 1);
  assert.equal(wff(X.rangeIsGoal, range(1, 10, 6000)), 0);
  assert.equal(wff(X.rangeDone, range(6000, 0, 6000)), 1);
  assert.equal(wff(X.podDone(1), R({ d1g: 1 })), 255);
  assert.equal(wff(X.podDone(0), R({ d0g: 0, d0r: 0 })), 0);
  assert.equal(wff(X.textOr('[COMPLICATION.GOAL_PROGRESS_VALUE]'), { 'COMPLICATION.TEXT': '', ...goal(7412, 8000) }), '7,412');
  assert.equal(wff(X.textOr('[COMPLICATION.GOAL_PROGRESS_VALUE]'), { 'COMPLICATION.TEXT': '7.4k', ...goal(7412, 8000) }), '7.4k');
});

// --------------------------------------------------------------- Bubbles
test('notification bubbles stay inside the core and hide when read', () => {
  const at = (count, sy, i) => wff(X.bubbleY(i), { UNREAD_NOTIFICATION_COUNT: count, ...R({ sy, nsrc: 0, ncount: 0 }) });
  for (let i = 0; i < X.BUBBLES; i++) assert.ok(at(0, 185, i) - G.C > G.CORE, 'hidden below the mask');
  for (const sy of [130, 185, 260]) for (const count of [1, 3, 6, 9]) {
    for (let i = 0; i < Math.min(count, 6); i++) {
      const y = at(count, sy, i), r = X.bubbleRadius(i), cx = X.bubbleX(i), cy = y + r;
      assert.ok(Math.hypot(cx - G.C, cy - G.C) + r < G.CORE, `bubble ${i} inside core`);
      if (sy <= 185) assert.ok(y > sy, 'below the surface when there is room');
    }
  }
  // The count label stays inside the fluid and clear of the bubble column.
  for (const count of [1, 3, 6, 9]) for (const sy of [130, 185, 260]) {
    const y = wff(X.BUBBLE_LABEL_Y, { UNREAD_NOTIFICATION_COUNT: count, ...R({ sy, nsrc: 0, ncount: 0 }) });
    const B = X.BUBBLE_LABEL_BOX;
    for (const cy of [y, y + B.h]) assert.ok(Math.hypot(B.x - G.C, cy - G.C) < G.CORE, `label inside core (${count}, ${sy})`);
    assert.ok(B.x + B.w < X.bubbleX(0) - 4 - 1 && B.x + B.w < Math.min(...[0, 1, 2, 3, 4, 5].map((i) => X.bubbleX(i) - X.bubbleRadius(i))), 'label left of the bubbles');
  }
  // Without notification access the slot's carriers read their default 0.
  const noCompanion = R({ nsrc: 0, ncount: 0 });
  assert.equal(wff(X.BUBBLES_VISIBLE, R({ sy: 185 })), 255);
  assert.equal(wff(X.BUBBLES_VISIBLE, R({ sy: G.CORE_BOTTOM - 20 })), 0, 'hidden when the fluid is shallow');
  assert.equal(wff(X.BUBBLE_LABEL, { UNREAD_NOTIFICATION_COUNT: 9, ...noCompanion }), '6+');
  assert.equal(wff(X.BUBBLE_LABEL, { UNREAD_NOTIFICATION_COUNT: 2, ...noCompanion }), 2);
  // The watch's own count, or the 0-or-1 unread flag for forwarded phone
  // notifications, whichever is larger.
  const total = (n) => ({ UNREAD_NOTIFICATION_COUNT: 1, ...R({ nsrc: 1, ncount: n }) });
  assert.equal(wff(X.BUBBLE_COUNT, total(4)), 4);
  assert.equal(wff(X.BUBBLE_COUNT, total(0)), 1, 'unread forwarded notification');
  assert.equal(wff(X.BUBBLE_COUNT, { UNREAD_NOTIFICATION_COUNT: 0, ...R({ nsrc: 1, ncount: 0 }) }), 0);
  assert.equal(wff(X.BUBBLE_LABEL, total(11)), '6+');
  assert.equal(wff(X.BUBBLE_COUNT, { UNREAD_NOTIFICATION_COUNT: 1, ...noCompanion }), 1);
});

// ----------------------------------------------------- Structure of the XML
const exprs = [...xml.matchAll(/(?:value|expression|x|y|alpha)="([^"]*\[[^"]*)"/g)].map((m) => m[1])
  .concat([...xml.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map((m) => m[1]));
test('every referenced value is defined exactly once', () => {
  const defined = [...xml.matchAll(/<Reference name="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(defined).size, defined.length, 'duplicate Reference names');
  const used = new Set([...xml.matchAll(/\[REFERENCE\.([A-Za-z0-9_]+)\]/g)].map((m) => m[1]));
  for (const u of used) assert.ok(defined.includes(u), `undefined reference ${u}`);
});
test('expression strings use double quotes only', () => {
  for (const e of exprs) assert.ok(!e.includes("'"), `single quote in ${e.slice(0, 60)}`);
});
test('sensors and millisecond sources stay inside their gates', () => {
  const blocks = (open, close) => {
    const spans = []; let i = 0;
    while ((i = xml.indexOf(open, i)) >= 0) {
      let depth = 0, j = i;
      const tag = close.slice(2, -1);
      const re = new RegExp(`<${tag}[ >]|</${tag}>`, 'g'); re.lastIndex = i;
      let m;
      while ((m = re.exec(xml))) { depth += m[0].startsWith('</') ? -1 : 1; if (!depth) { j = re.lastIndex; break; } }
      spans.push([i, j]); i = j;
    }
    return spans;
  };
  const inside = (idx, spans) => spans.some(([a, b]) => idx > a && idx < b);
  const gated = blocks('<BooleanConfiguration id="tilt">', '</BooleanConfiguration>');
  for (const m of xml.matchAll(/ACCELEROMETER/g)) assert.ok(inside(m.index, gated), 'accelerometer outside its editor gate');
  const conditions = blocks('<Condition>', '</Condition>');
  const sloshBlocks = conditions.filter(([a, b]) => xml.slice(a, b).includes('[REFERENCE.tap] &gt; 0') || xml.slice(a, b).includes('[REFERENCE.tap] > 0'));
  for (const m of xml.matchAll(/\[MILLISECOND\]/g)) assert.ok(inside(m.index, sloshBlocks), 'millisecond clock outside the slosh branch');
  const secs = blocks('<BooleanConfiguration id="secs">', '</BooleanConfiguration>');
  for (const m of xml.matchAll(/\[SECOND\]/g)) assert.ok(inside(m.index, secs), 'seconds outside the seconds setting');
});
test('scene stays within what Samsung runtime 4.0.00.16 survives', () => {
  // The runtime crashed (ConcurrentModificationException) at screen-state
  // changes with 63 weather sources, a Gyro transform and 1 s Variants.
  const weather = new Set(xml.match(/\[WEATHER\.[A-Z0-9_.]+\]/g));
  assert.ok(weather.size <= 40, `${weather.size} weather sources`);
  assert.ok(!xml.includes('<Gyro'), 'Gyro transform');
  for (const m of xml.matchAll(/<Variant [^>]*>/g)) assert.match(m[0], /duration="0"/, m[0]);
});
test('complication slots keep their order and do not overlap', () => {
  const ids = [...xml.matchAll(/<ComplicationSlot slotId="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(ids, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.ok(ids.length <= 8);
  const shapes = SLOT_BOUNDS.map((b) => ({ ...b, cx: b.x + b.w / 2, cy: b.y + b.h / 2 }));
  const overlap = (a, b) => {
    if (a.shape !== 'box' && b.shape !== 'box' && a.w === a.h && b.w === b.h) return Math.hypot(a.cx - b.cx, a.cy - b.cy) < (a.w + b.w) / 2;
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h &&
      !(a.shape !== 'box' && a.w === a.h && Math.hypot(Math.max(b.x - a.cx, 0, a.cx - b.x - b.w), Math.max(b.y - a.cy, 0, a.cy - b.y - b.h)) >= a.w / 2) &&
      !(b.shape !== 'box' && b.w === b.h && Math.hypot(Math.max(a.x - b.cx, 0, b.cx - a.x - a.w), Math.max(a.y - b.cy, 0, b.cy - a.y - a.h)) >= b.w / 2);
  };
  for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
    assert.ok(!overlap(shapes[i], shapes[j]), `slots ${shapes[i].slotId} and ${shapes[j].slotId} overlap`);
  }
  for (const s of shapes) for (const [x, y] of [[s.x, s.y], [s.x + s.w, s.y], [s.x, s.y + s.h], [s.x + s.w, s.y + s.h]]) {
    if (s.shape === 'box') assert.ok(Math.hypot(x - G.C, y - G.C) <= G.RING.inner, `slot ${s.slotId} inside the ring`);
  }
});
test('pods clear the core and the ring', () => {
  for (let i = 0; i < 4; i++) {
    const [x, y] = G.podCenter(i), d = Math.hypot(x - G.C, y - G.C);
    assert.ok(d - G.POD.radius > G.RIM, 'clear of the glass rim');
    assert.ok(d + G.POD.radius < G.RING.inner, 'clear of the ring');
  }
});
test('resources and labels exist and follow the Samsung editor rule', () => {
  const strings = fs.readFileSync(path.join(res, 'values', 'strings.xml'), 'utf8');
  const names = new Set([...strings.matchAll(/<string name="([^"]+)"/g)].map((m) => m[1]));
  for (const m of xml.matchAll(/displayName="([^"]+)"/g)) assert.ok(names.has(m[1]), `missing string ${m[1]}`);
  for (const m of strings.matchAll(/<string name="[^"]+">([^<]*)</g)) assert.ok(!m[1].includes('%'), `percent sign in label: ${m[1]}`);
  const drawables = new Set(fs.readdirSync(path.join(res, 'drawable-nodpi')).map((f) => f.replace(/\.png$/, '')));
  for (const m of xml.matchAll(/resource="([^"[]+)"/g)) assert.ok(drawables.has(m[1]), `missing drawable ${m[1]}`);
  const fonts = new Set(fs.readdirSync(path.join(res, 'font')).map((f) => f.replace(/\.ttf$/, '')));
  for (const m of xml.matchAll(/<Font family="([^"]+)"/g)) assert.ok(fonts.has(m[1]), `missing font ${m[1]}`);
  for (const m of xml.matchAll(/<BitmapFont family="([^"]+)"/g)) assert.ok(xml.includes(`<BitmapFont name="${m[1]}"`), `missing bitmap font ${m[1]}`);
  for (const m of xml.matchAll(/<Font [^>]*size="([\d.]+)"/g)) assert.ok(Number(m[1]) >= 9, `text size ${m[1]} too small`);
});
test('fixed providers match the companion manifest', () => {
  const manifest = fs.readFileSync(path.join(root, 'health-watch', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
  for (const key of ['coreTap', 'powerSave', 'minutes', 'calories']) {
    const cls = G.PROVIDERS[key].split('/')[1];
    const block = manifest.match(new RegExp(`<service android:name="${cls.replace(/\./g, '\\.')}"[\\s\\S]*?</service>`));
    assert.ok(block, `${cls} is declared`);
    assert.ok(block[0].includes(G.FACE_ID), `${cls} allows ${G.FACE_ID}`);
  }
  const gradle = fs.readFileSync(path.join(root, 'watchface', 'build.gradle.kts'), 'utf8');
  assert.ok(gradle.includes(`applicationId = "${G.FACE_ID}"`));
});

console.log(`${passed} Meniscus checks passed${process.exitCode ? ', some FAILED' : ''}`);
