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
    compiled.set(expression, new Function('data', 'clamp', 'numberFormat', 'subText', 'textLength', 'floor', 'sin', `"use strict"; return (${js});`));
  }
  return compiled.get(expression)(data, clamp, numberFormat, (s, a, b) => s.substring(a, b), s => s?.length ?? 0, Math.floor, Math.sin);
}
function part(name) {
  const match = face.match(new RegExp(`<PartText[^>]*name="${name}"[^>]*>([\\s\\S]*?)<\\/PartText>`));
  assert.ok(match, `Missing part ${name}`);
  return unescapeXml(match[1].match(/<Parameter expression="([^"]+)"/)[1]);
}
const expressions = new Map([...face.matchAll(/<Expression name="([^"]+)">([\s\S]*?)<\/Expression>/g)]
  .map(m => [m[1], unescapeXml(m[2])]));
const moonPart=face.match(/<PartImage name="moon_disc_rotation"[\s\S]*?<\/PartImage>/)[0];
assert.match(moonPart, /<Localization timeZone="UTC" calendar="GREGORIAN"/);
const moonExpression=unescapeXml(moonPart.match(/<Transform target="angle" value="([^"]+)"/)[1]);
const moonSources=[...moonExpression.matchAll(/\[([^\]]+)\]/g)].map(m=>m[1]);
assert.deepEqual([...new Set(moonSources)].sort(), ['AMPM_STATE','DAY_OF_YEAR','YEAR']);
assert.doesNotMatch(face, /MOON_PHASE_POSITION|MOON_PHASE_TYPE/);
const lunarMonth=29.530588853, moonEpoch=Date.parse('2000-01-06T18:14:00Z');
const wrap=(n,period)=>((n%period)+period)%period;
function moonAngle(date) {
  const year=date.getUTCFullYear();
  return evaluate(moonExpression, {YEAR:year,DAY_OF_YEAR:Math.floor((+date-Date.UTC(year,0,1))/86400000)+1,AMPM_STATE:date.getUTCHours()<12?0:1});
}
const calibratedAngle=angle=>angle+7.5*Math.sin(angle*Math.PI/90);
function meanPhase(date) {
  // Undo the monotonic aperture calibration to check astronomical cycle age.
  const target=moonAngle(date);
  let lo=-90,hi=270;
  for(let i=0;i<48;i++) { const mid=(lo+hi)/2; if(calibratedAngle(mid)<target) lo=mid; else hi=mid; }
  return wrap(((lo+hi)/2+90)/180,1);
}
let moonCases=0;
for (const year of [1902,1999,2000,2024,2026,2100]) {
  for (let date=new Date(Date.UTC(year,0,1)); date.getUTCFullYear()===year; date=new Date(+date+86400000)) {
    for (const hour of [0,12]) {
      const start=new Date(+date+hour*3600000);
      const angle=moonAngle(start);
      assert.ok(angle>=-90 && angle<270);
      const midpoint=+start+6*3600000;
      const expected=calibratedAngle(-90+180*wrap((midpoint-moonEpoch)/86400000/lunarMonth,2));
      assert.ok(Math.abs(angle-expected)<1e-7, 'Gregorian date math must match an independent UTC timestamp calculation');
      assert.equal(moonAngle(new Date(+start+43199999)),angle, 'Moon must stay fixed throughout a UTC half-day');
      const next=moonAngle(new Date(+start+43200000));
      const advance=wrap(next-angle,360);
      assert.ok(advance>2 && advance<4, 'Disc must advance clockwise once per half-day across date/year/cycle rollovers');
      moonCases++;
    }
  }
}
// USNO primary phases, 2026. This is a mean-cycle display, not an ephemeris.
const lunarFixtures=[
  ['2026-01-18T19:52Z',0],['2026-03-19T01:23Z',0],['2026-06-15T02:54Z',0],
  ['2026-09-11T03:27Z',0],['2026-10-10T15:50Z',0],['2026-10-26T04:12Z',0.5],
  ['2026-11-01T20:28Z',0.75],['2026-11-09T07:02Z',0],['2026-11-17T11:48Z',0.25],
  ['2026-11-24T14:53Z',0.5],['2026-12-01T06:08Z',0.75],['2026-12-09T00:52Z',0],
];
let maxMoonErrorDays=0;
for (const [time,expected] of lunarFixtures) {
  const delta=wrap(meanPhase(new Date(time))-expected+0.5,1)-0.5;
  maxMoonErrorDays=Math.max(maxMoonErrorDays,Math.abs(delta)*lunarMonth);
  assert.ok(Math.abs(delta)*lunarMonth<1.5, `Mean moon phase is outside its approximation tolerance at ${time}`);
}
const currentPhase=meanPhase(new Date('2026-11-03T03:00Z'));
assert.ok(currentPhase>0.75 && currentPhase<0.9, 'Early November 2026 must be waning after last quarter');
console.log(`PASS: ${moonCases} moon half-days; twice-daily UTC cadence; phase wrap/direction; 12 USNO phase fixtures (max mean-cycle error ${maxMoonErrorDays.toFixed(2)} days).`);
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
  if (name==='steps') {
    const policy=slot.match(/<DefaultProviderPolicy\b[^>]+/)[0];
    assert.match(policy, /primaryProvider="com\.samsung\.android\.wear\.shealth\/com\.samsung\.android\.wear\.shealth\.complications\.steps\.StepsComplicationProviderService"/);
    assert.match(policy, /primaryProviderType="GOAL_PROGRESS"/);
    assert.match(policy, /defaultSystemProvider="STEP_COUNT" defaultSystemProviderType="RANGED_VALUE"/);
  }
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
  // Only the explicit Samsung steps compatibility option may show a range target.
  const rangeTexts = [...ranged.matchAll(/<PartText[\s\S]*?<\/PartText>/g)].map(m => m[0]);
  assert.ok(rangeTexts.at(-1).includes('\u2014'));
  if (name==='steps') {
    assert.match(ranged, /<BooleanConfiguration id="samsung_steps_target">/);
    const targetText=unescapeXml(rangeTexts[1].match(/<Parameter expression="([^"]+)"/)[1]);
    for (const [min,max,expected] of [[0,6000,'6,000'],[0,8000,'8,000'],[0,0,'—'],[0,-1,'—'],[10,6000,'—']]) {
      assert.equal(evaluate(targetText,{'COMPLICATION.RANGED_VALUE_MIN':min,'COMPLICATION.RANGED_VALUE_MAX':max}),expected);
    }
    assert.match(face, /BooleanConfiguration id="samsung_steps_target"[^>]*defaultValue="TRUE"/);
    assert.match(ranged, /<BooleanOption id="FALSE">[\s\S]*?<Font[^>]*>—<\/Font>/);
  } else {
    assert.ok(!ranged.includes('samsung_steps_target'));
    assert.ok(!rangeTexts.at(-1).includes('RANGED_VALUE_MAX'));
  }
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
assert.ok(Number(tick[1])>=0.1 && Number(tick[1])<=0.2, 'Allow a brief tick but hold still for most of each second');
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
  const radius = {20:150,30:168,40:186}[id];
  for (const text of slot.matchAll(/<PartText[^>]+/g)) {
    const x=attribute(text[0],'x'), y=attribute(text[0],'y'), w=attribute(text[0],'width'), h=attribute(text[0],'height');
    assert.ok(x>=b.x && y>=b.y && x+w<=b.x+b.width && y+h<=b.y+b.height, `Slot ${id} clips a text field`);
    if (w===43 && h===18) {
      assert.ok(Math.abs(Math.hypot(x+w/2-225,y+h/2-225)-radius)<1, `Slot ${id} goal must follow its track radius`);
    }
  }
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
for (const [id,x,y] of [[20,225,275],[30,110,350],[40,225,411]]) {
  const hits = [...activityBounds].filter(([,b]) => x>b.x && y>b.y && x<b.x+b.width && y<b.y+b.height).map(([id])=>id);
  assert.deepEqual(hits,[id], `Editor anchor for slot ${id} must not overlap another activity slot`);
}
for (const match of face.matchAll(/\bresource="([a-z][a-z0-9_]*)"/g)) {
  assert.ok(fs.existsSync(path.join(root, 'watchface/src/main/res/drawable-nodpi', match[1]+'.png')), `Missing ${match[1]}`);
}
console.log(`PASS: ${calendarCases} calendar dates; activity goals/ranges/empty states; unclipped gauges and unique editor anchors; battery bounds; seconds cutoff; resources and battery policy.`);
