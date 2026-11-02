import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const face = fs.readFileSync(path.join(root, 'watchface/src/main/res/raw/watchface.xml'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'watchface/src/main/AndroidManifest.xml'), 'utf8');
const stringsXml = fs.readFileSync(path.join(root, 'watchface/src/main/res/values/strings.xml'), 'utf8');
const unescapeXml = s => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
const strings = new Map([...stringsXml.matchAll(/<string\b([^>]*)>([\s\S]*?)<\/string>/g)]
  .map(m => [m[1].match(/\bname="([^"]+)"/)[1],unescapeXml(m[2])]));
for (const match of face.matchAll(/\bdisplayName="([^"]+)"/g)) {
  const label = strings.get(match[1]);
  assert.ok(label !== undefined, `Missing editor label ${match[1]}`);
  // Samsung formats schema labels even with Android formatted="false".
  assert.ok(!label.replace(/%%/g,'').includes('%'), `Unsafe percent format in static editor label ${match[1]}: ${label}`);
}
const compiled = new Map();
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
function numberFormat(format, n) {
  if (format === '00') return Math.round(n).toString().padStart(2, '0');
  assert.equal(format, '#,##0');
  return Math.round(n).toLocaleString('en-US');
}
// WFF string literals require double quotes. JavaScript also accepts single
// quotes, so the expression evaluator alone cannot catch this device failure.
for (const match of face.matchAll(/\b(?:expression|value)="([^"]*)"/g)) {
  assert.ok(!match[1].includes("'"), `Use XML-escaped double quotes in WFF expressions: ${match[1]}`);
}
for (const match of unescapeXml(face).matchAll(/numberFormat\("([^"]*)"/g)) {
  assert.ok(['#,##0', '00'].includes(match[1]), `Untested number pattern: ${match[1]}`);
}
function evaluate(expression, data) {
  if (!compiled.has(expression)) {
    // Evaluate only the arithmetic in this locally authored WFF document.
    const js = expression.replace(/\[([A-Za-z0-9_.]+)\]/g, (_, key) => `data[${JSON.stringify(key)}]`);
    compiled.set(expression, new Function('data', 'clamp', 'numberFormat', 'subText', 'textLength', `"use strict"; return (${js});`));
  }
  return compiled.get(expression)(data, clamp, numberFormat, (s, a, b) => s.substring(a, b), s => s?.length ?? 0);
}
function part(name) {
  const match = face.match(new RegExp(`<PartText[^>]*name="${name}"[^>]*>([\\s\\S]*?)<\\/PartText>`));
  assert.ok(match, `Missing part ${name}`);
  return unescapeXml(match[1].match(/<Parameter expression="([^"]+)"/)[1]);
}
const expressions = new Map([...face.matchAll(/<Expression name="([^"]+)">([\s\S]*?)<\/Expression>/g)]
  .map(m => [m[1], unescapeXml(m[2])]));
const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const weekdays = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
let calendarCases = 0;
for (const year of [1999, 2000, 2024, 2025, 2026, 2100]) {
  for (let d = new Date(Date.UTC(year, 0, 1, 12)); d.getUTCFullYear() === year; d = new Date(+d + 86400000)) {
    const prev = new Date(+d - 86400000), next = new Date(+d + 86400000);
    const data = { YEAR: year, MONTH: d.getUTCMonth()+1, DAY: d.getUTCDate(), DAY_Z: String(d.getUTCDate()).padStart(2,'0'), DAY_OF_WEEK: d.getUTCDay()+1 };
    assert.equal(evaluate(part('drum_date_prev'), data), String(prev.getUTCDate()).padStart(2, '0'));
    assert.equal(evaluate(part('drum_date_next'), data), String(next.getUTCDate()).padStart(2, '0'));
    assert.equal(evaluate(part('drum_month_prev'), data), months[(d.getUTCMonth()+11)%12]);
    assert.equal(evaluate(part('drum_month_next'), data), months[(d.getUTCMonth()+1)%12]);
    assert.equal(evaluate(part('drum_month'), data), months[d.getUTCMonth()]);
    assert.equal(evaluate(part('drum_weekday_prev'), data), weekdays[prev.getUTCDay()]);
    assert.equal(evaluate(part('drum_weekday_next'), data), weekdays[next.getUTCDay()]);
    assert.equal(evaluate(part('drum_weekday'), data), weekdays[d.getUTCDay()]);
    assert.equal(evaluate(part('ambient_weekday'), data), weekdays[d.getUTCDay()]);
    assert.equal(evaluate(part('ambient_month'), data), months[d.getUTCMonth()]);
    assert.equal(evaluate(part('ambient_date'), data), data.DAY_Z);
    calendarCases++;
  }
}

for (const prefix of ['drum','ambient']) {
  const positions=['weekday','month','date'].map(name=>Number(face.match(new RegExp(`<PartText name="${prefix}_${name}" x="(\\d+)"`))[1]));
  assert.ok(positions[0]<positions[1] && positions[1]<positions[2], `${prefix} calendar must read weekday, month, date`);
}
const ambient=face.match(/<Group name="ambient_dial"[\s\S]*?<\/Group>/)[0];
assert.match(ambient, /alpha="0">\s*<Variant mode="AMBIENT" target="alpha" value="255"/);
assert.doesNotMatch(ambient, /<SecondHand|<Tick|<Sweep|COMPLICATION\.|WEATHER\.|MOON_PHASE|drum_\w+_(?:prev|next)/);
assert.match(ambient, /resource="ambient_hour_hand"/);
assert.match(ambient, /resource="ambient_minute_hand"/);
const ambientBattery=unescapeXml(ambient.match(/<Transform target="y" value="([^"]+)"/)[1]);
assert.equal(evaluate(ambientBattery,{BATTERY_PERCENT:0}),274);
assert.equal(evaluate(ambientBattery,{BATTERY_PERCENT:100}),175);

for (const [name, id] of [['steps',20], ['minutes',30], ['calories',40]]) {
  const slot = face.match(new RegExp(`<ComplicationSlot slotId="${id}"[\\s\\S]*?<\\/ComplicationSlot>`))[0];
  const goal = slot.match(/<Complication type="GOAL_PROGRESS">([\s\S]*?)<\/Complication>/)[1];
  const ranged = slot.match(/<Complication type="RANGED_VALUE">([\s\S]*?)<\/Complication>/)[1];
  const goalArc = unescapeXml(goal.match(/<Transform target="endAngle" value="([^"]+)"/)[1]);
  const rangeArc = unescapeXml(ranged.match(/<Transform target="endAngle" value="([^"]+)"/)[1]);
  const goalEdge = unescapeXml(goal.match(/<Transform target="angle" value="([^"]+)"/)[1]);
  const rangeEdge = unescapeXml(ranged.match(/<Transform target="angle" value="([^"]+)"/)[1]);
  for (const target of [-1, 0, 60, 8000]) for (const value of [-5, 0, 1, 42, 8000, 10000]) {
    const data = {'COMPLICATION.GOAL_PROGRESS_VALUE':value, 'COMPLICATION.GOAL_PROGRESS_TARGET_VALUE':target};
    const valid = evaluate(expressions.get(`${name}_target_valid`), data);
    assert.equal(valid, target > 0 && value > 0);
    if (valid) {
      const angle = evaluate(goalArc, data);
      assert.ok(Number.isFinite(angle) && angle >= 146 && angle < 214);
      assert.ok(Math.abs(evaluate(goalEdge,data)+180-angle)<1e-9, 'Cut edge must follow the goal band tip');
      if (value >= target) assert.equal(angle, 146, 'Over-goal totals must clamp only the drawing');
    }
  }
  for (const [min,max,value] of [[0,0,0],[1,0,5],[10,100,10],[10,100,55],[10,100,200],[-10,100,-11]]) {
    const data = {'COMPLICATION.RANGED_VALUE_MIN':min,'COMPLICATION.RANGED_VALUE_MAX':max,'COMPLICATION.RANGED_VALUE_VALUE':value};
    const valid = evaluate(expressions.get(`${name}_range_valid`), data);
    assert.equal(valid, max > min && value > min);
    if (valid) {
      assert.ok(evaluate(rangeArc,data) >= 146 && evaluate(rangeArc,data) < 214);
      assert.ok(Math.abs(evaluate(rangeEdge,data)+180-evaluate(rangeArc,data))<1e-9, 'Cut edge must follow the ranged band tip');
    }
  }
  // Ranged providers cannot silently turn an arbitrary upper bound into a goal.
  const rangeTexts = [...ranged.matchAll(/<PartText[\s\S]*?<\/PartText>/g)].map(m => m[0]);
  assert.ok(rangeTexts.at(-1).includes('\u2014'));
  assert.ok(!rangeTexts.at(-1).includes('RANGED_VALUE_MAX'));
  assert.ok(slot.includes('<Complication type="EMPTY">'));
}

const slider = face.match(/<PartImage name="battery_slider"[\s\S]*?<\/PartImage>/)[0];
const sliderExpression = unescapeXml(slider.match(/<Transform target="y" value="([^"]+)"/)[1]);
assert.equal(evaluate(sliderExpression,{BATTERY_PERCENT:0}),274);
assert.equal(evaluate(sliderExpression,{BATTERY_PERCENT:100}),175);
assert.equal(evaluate(sliderExpression,{BATTERY_PERCENT:-10}),274);
assert.equal(evaluate(sliderExpression,{BATTERY_PERCENT:150}),175);
const seconds = face.match(/<Group name="seconds_visibility"[\s\S]*?<\/Group>/)[0];
const secondsExpression = unescapeXml(seconds.match(/<Transform target="alpha" value="([^"]+)"/)[1]);
assert.equal(evaluate(secondsExpression,{BATTERY_PERCENT:15}),0);
assert.equal(evaluate(secondsExpression,{BATTERY_PERCENT:73}),255);
assert.match(face, /BooleanConfiguration id="mechanical_seconds"[^>]*defaultValue="TRUE"/);
assert.match(face, /ListConfiguration id="left_inset"[^>]*defaultValue="0"/);
assert.match(face, /<BooleanConfiguration id="mechanical_seconds">\s*<BooleanOption id="TRUE">\s*<Group name="seconds_visibility"/);
const tick=face.match(/<SecondHand\b[^>]*>\s*<Tick duration="([^"]+)" strength="([^"]+)"\s*\/>\s*<\/SecondHand>/);
assert.ok(tick, 'Use the native overshooting Tick for seconds');
assert.ok(Number(tick[1])>=0.15 && Number(tick[1])<=0.25, 'Allow a visible tick but hold still for most of each second');
assert.ok(Number(tick[2])>=0.4 && Number(tick[2])<=0.6, 'Overshoot must be visible without a full-step bounce');
assert.doesNotMatch(face, /\[CONFIGURATION\./, 'Use native list/boolean branches for editor options');
assert.match(face, /<Group name="optional_ticking_seconds"[^>]*>\s*<Variant mode="AMBIENT" target="alpha" value="0"/);
assert.doesNotMatch(face, /\[(?:UTC_TIMESTAMP|MILLISECOND|SECOND_MILLISECOND|ACCELEROMETER[^\]]*)\]|<Sweep\b|<Gyro\b/);
assert.doesNotMatch(face, /\u00c2\u00b0|\u00e2\u20ac\u201d/);
assert.match(manifest, /android:hasCode="false"/);
assert.doesNotMatch(manifest, /<service\b|<activity\b|<uses-permission\b/);
const slotIds = [...face.matchAll(/<ComplicationSlot slotId="(\d+)"/g)].map(m => m[1]);
assert.equal(new Set(slotIds).size, 4);
const activityBounds = new Map();
for (const id of [20,30,40]) {
  const slot = face.match(new RegExp(`<ComplicationSlot slotId="${id}"[\\s\\S]*?<\\/ComplicationSlot>`))[0];
  const tag = slot.match(/<BoundingRoundBox[^>]+/)[0];
  const attribute = (tag, name) => Number(tag.match(new RegExp(`\\b${name}="([^"]+)"`))[1]);
  const b = Object.fromEntries(['x','y','width','height'].map(n => [n,attribute(tag,n)]));
  activityBounds.set(id,b);
  for (const text of slot.matchAll(/<PartText[^>]+/g)) {
    const x=attribute(text[0],'x'), y=attribute(text[0],'y'), w=attribute(text[0],'width'), h=attribute(text[0],'height');
    assert.ok(x>=b.x && y>=b.y && x+w<=b.x+b.width && y+h<=b.y+b.height, `Slot ${id} clips a text field`);
  }
  const radius = {20:150,30:168,40:186}[id];
  for (const arc of slot.matchAll(/<Arc\b[\s\S]*?<\/Arc>/g)) {
    assert.equal(attribute(arc[0],'centerX'),225);
    assert.equal(attribute(arc[0],'centerY'),225);
    assert.equal(attribute(arc[0],'width'),radius*2);
    assert.equal(attribute(arc[0],'height'),radius*2);
    assert.match(arc[0], /thickness="12" cap="BUTT"/);
    assert.match(arc[0], /<RadialGradient centerX="225" centerY="225"/);
    const stops=arc[0].match(/positions="([^"]+)"/)[1].split(' ').map(Number);
    assert.ok(stops.length>=3 && stops[0]>=0 && stops.at(-1)===1);
    assert.ok(stops.every((stop,i)=>i===0 || stop>stops[i-1]), 'Metal gradient stops must be strictly increasing');
  }
  for (let angle=146; angle<=214; angle++) {
    const x=225+radius*Math.sin(angle*Math.PI/180), y=225-radius*Math.cos(angle*Math.PI/180);
    assert.ok(x-7>=b.x && x+7<=b.x+b.width && y-7>=b.y && y+7<=b.y+b.height, `Slot ${id} clips its metal band or cut edge`);
  }
}
for (const [id,x,y] of [[20,225,275],[30,110,372],[40,225,411]]) {
  const hits = [...activityBounds].filter(([,b]) => x>b.x && y>b.y && x<b.x+b.width && y<b.y+b.height).map(([id])=>id);
  assert.deepEqual(hits,[id], `Editor anchor for slot ${id} must not overlap another activity slot`);
}
for (const match of face.matchAll(/\bresource="([a-z][a-z0-9_]*)"/g)) {
  assert.ok(fs.existsSync(path.join(root, 'watchface/src/main/res/drawable-nodpi', match[1]+'.png')), `Missing ${match[1]}`);
}
console.log(`PASS: ${calendarCases} calendar dates; activity goals/ranges/empty states; unclipped gauges and unique editor anchors; battery bounds; seconds cutoff; resources and battery policy.`);
