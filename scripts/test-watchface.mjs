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
const referenceDefaults=Object.fromEntries([...face.matchAll(/<Reference name="([^"]+)" source="([^"]+)" defaultValue="([^"]+)"/g)].map(m=>['REFERENCE.'+m[1],Number(m[3])]));
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
  data={...referenceDefaults,...data};
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

const referenceNames=[...face.matchAll(/<Reference name="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(referenceNames).size,referenceNames.length,'Reference exports must have unique names');
for(const match of face.matchAll(/\[REFERENCE\.([^\]]+)\]/g)) assert.ok(referenceNames.includes(match[1]),'Missing Reference export '+match[1]);
function exportedExpression(name) {
  const group=face.match(new RegExp('<Group name="'+name+'_export"[\\s\\S]*?</Group>'))[0];
  assert.match(group,/<Reference[^>]*source="angle"/);
  assert.doesNotMatch(group,/\[REFERENCE\./,'Export calculations must not depend on other references or form cycles');
  return unescapeXml(group.match(/<Transform target="angle" value="([^"]+)"/)[1]);
}
for (const [name, id] of [['steps',20], ['minutes',30], ['calories',40]]) {
  const slot=face.match(new RegExp('<ComplicationSlot slotId="'+id+'"[\\s\\S]*?</ComplicationSlot>'))[0];
  if(name==='steps') {
    const policy=slot.match(/<DefaultProviderPolicy\b[^>]+/)[0];
    assert.match(policy,/primaryProvider="com\.samsung\.android\.wear\.shealth\/com\.samsung\.android\.wear\.shealth\.complications\.steps\.StepsComplicationProviderService"/);
    assert.match(policy,/primaryProviderType="GOAL_PROGRESS"/);
    assert.match(policy,/defaultSystemProvider="STEP_COUNT" defaultSystemProviderType="RANGED_VALUE"/);
  }
  const goalEnd=exportedExpression(name+'_goal_end');
  const goalTarget=exportedExpression(name+'_goal_target');
  const rangeEnd=exportedExpression(name+'_range_end');
  const drawing=face.match(new RegExp('<PartDraw name="'+name+'_progress_band"[\\s\\S]*?</PartDraw>'))[0];
  const endExpression=unescapeXml(drawing.match(/<Transform target="endAngle" value="([^"]+)"/)[1]);
  const edge=face.match(new RegExp('<Group name="'+name+'_track_cut_edge"[\\s\\S]*?</Group>'))[0];
  const edgeExpression=unescapeXml(edge.match(/<Transform target="angle" value="([^"]+)"/)[1]);
  const targetText=part(name+'_target_display');
  for(const target of [-1,0,60,8000]) for(const value of [-5,0,1,42,8000,10000]) {
    const data={'COMPLICATION.GOAL_PROGRESS_VALUE':value,'COMPLICATION.GOAL_PROGRESS_TARGET_VALUE':target};
    const angle=evaluate(goalEnd,data);
    const refs={...referenceDefaults,['REFERENCE.'+name+'_goal_end']:angle,['REFERENCE.'+name+'_goal_target']:evaluate(goalTarget,data)};
    const valid=target>0 && value>0;
    assert.equal(evaluate(expressions.get(name+'_track_visible'),refs),valid);
    assert.equal(evaluate(targetText,refs),target>0?numberFormat('#,##0',target):'—');
    if(valid) {
      assert.ok(Number.isFinite(angle) && angle>=146 && angle<214);
      assert.equal(evaluate(endExpression,refs),angle);
      assert.ok(Math.abs(evaluate(edgeExpression,refs)+180-angle)<1e-9);
      if(value>=target) assert.equal(angle,146,'Only the progress drawing should clamp at the goal');
    } else assert.equal(angle,214);
  }
  for(const [min,max,value] of [[0,0,0],[1,0,5],[10,100,10],[10,100,55],[10,100,200],[-10,100,-11],[0,6000,2199]]) {
    const data={'COMPLICATION.RANGED_VALUE_MIN':min,'COMPLICATION.RANGED_VALUE_MAX':max,'COMPLICATION.RANGED_VALUE_VALUE':value};
    const angle=evaluate(rangeEnd,data);
    const refs={...referenceDefaults,['REFERENCE.'+name+'_range_end']:angle};
    const valid=max>min && value>min;
    assert.equal(evaluate(expressions.get(name+'_track_visible'),refs),valid);
    assert.equal(evaluate(targetText,refs),'—','Disabled Samsung option and generic ranges must not invent personal targets');
    if(valid) {
      assert.ok(angle>=146 && angle<214);
      assert.equal(evaluate(endExpression,refs),angle);
      assert.ok(Math.abs(evaluate(edgeExpression,refs)+180-angle)<1e-9);
    } else assert.equal(angle,214);
    if(name==='steps') {
      refs['REFERENCE.steps_range_target']=evaluate(exportedExpression('steps_range_target'),data);
      assert.equal(evaluate(targetText,refs),min===0 && max>0?numberFormat('#,##0',max):'—');
    }
  }
  for(const type of ['SHORT_TEXT','EMPTY']) {
    const body=slot.match(new RegExp('<Complication type="'+type+'">([\\s\\S]*?)</Complication>'))[1];
    assert.doesNotMatch(body,/<Reference\b/,'Unavailable or text-only providers must clear detached progress and goals');
  }
  assert.equal(evaluate(targetText,referenceDefaults),'—');
  assert.equal(evaluate(expressions.get(name+'_track_visible'),referenceDefaults),false);
  assert.doesNotMatch(slot,/<Arc\b|width="43" height="18"/,'Detached tracks and goals must not enlarge the editor slot');
  if(name==='steps') {
    assert.match(slot,/<BooleanConfiguration id="samsung_steps_target">/);
    const disabled=slot.match(/<BooleanOption id="FALSE">([\s\S]*?)<\/BooleanOption>/)[1];
    assert.doesNotMatch(disabled,/<Reference\b/);
    assert.match(face,/BooleanConfiguration id="samsung_steps_target"[^>]*defaultValue="TRUE"/);
  } else assert.ok(!slot.includes('samsung_steps_target'));
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
const balance=face.match(/<PartImage name="balance_oscillator"[\s\S]*?<\/PartImage>/)[0];
const balanceAngle=unescapeXml(balance.match(/<Transform target="angle" value="([^"]+)"/)[1]);
assert.deepEqual([...balanceAngle.matchAll(/\[([^\]]+)\]/g)].map(m=>m[1]),['SECOND']);
const wrap360=angle=>((angle%360)+360)%360;
for(let second=0;second<120;second++) {
  const angle=evaluate(balanceAngle,{SECOND:second%60});
  const next=evaluate(balanceAngle,{SECOND:(second+1)%60});
  const counterclockwise=(wrap360(angle)-wrap360(next)+360)%360;
  assert.equal(counterclockwise,30,'Each second advances 30 degrees counterclockwise, including the minute rollover');
}
for(let battery=0;battery<=100;battery++) {
  assert.equal(evaluate(expressions.get('balance_power_available'),{BATTERY_PERCENT:battery}),battery>15);
}
assert.match(face, /BooleanConfiguration id="mechanical_balance"[^>]*defaultValue="TRUE"/);
assert.match(face, /<Group name="optional_balance"[^>]*>\s*<Variant mode="AMBIENT" target="alpha" value="0" duration="0"/);
assert.match(face, /<BooleanConfiguration id="mechanical_balance">\s*<BooleanOption id="TRUE">\s*<Condition>[\s\S]*?<Compare expression="balance_power_available">\s*<Group name="balance_perspective"/);
const balanceAnimation=balance.match(/<Animation\b[^>]+/)[0];
const duration=Number(balanceAnimation.match(/duration="([^"]+)"/)[1]);
const fps=Number(balanceAnimation.match(/fps="([^"]+)"/)[1]);
assert.ok(duration>=0.1 && duration<=0.25 && fps>=15 && fps<=30,'Use a short bounded animation and rest for most of the second');
assert.match(balanceAnimation,/angleDirection="COUNTER_CLOCKWISE"/);
assert.match(balanceAnimation,/repeat="0"/);
assert.match(balanceAnimation,/interpolation="CUBIC_BEZIER" controls="0.42 0 0.58 1"/);
assert.ok(face.indexOf('name="balance_oscillator"')<face.indexOf('resource="dial_frame"'),'The dial must occlude the shared wheel');
assert.doesNotMatch(ambient,/balance_|mechanical_balance|\[SECOND\]/);
for(const [ambientName,liveName] of [['ambient_weekday','drum_weekday'],['ambient_month','drum_month'],['ambient_date','drum_date']]) {
  const ambientBox=face.match(new RegExp(`<PartText name="${ambientName}"([^>]*)>`))[1];
  const liveBox=face.match(new RegExp(`<PartText name="${liveName}"([^>]*)>`))[1];
  for(const attr of ['x','y','width','height']) {
    assert.equal(ambientBox.match(new RegExp(`${attr}="([^"]+)"`))[1], liveBox.match(new RegExp(`${attr}="([^"]+)"`))[1], `${ambientName} ${attr} matches the live date row`);
  }
  assert.equal(
    face.match(new RegExp(`name="${ambientName}"[\\s\\S]*?size="([^"]+)"`))[1],
    face.match(new RegExp(`name="${liveName}"[\\s\\S]*?size="([^"]+)"`))[1],
    `${ambientName} uses the live date size`);
}
const sweepControl=face.slice(face.indexOf('<Group name="sweep_control"'),face.indexOf('<!-- The twin-moon'));
assert.match(sweepControl, /<Compare expression="sweep_requested">[\s\S]*\[UTC_TIMESTAMP\]/);
assert.doesNotMatch(face.replace(sweepControl,''), /\[(?:UTC_TIMESTAMP|MILLISECOND|SECOND_MILLISECOND|ACCELEROMETER[^\]]*)\]|<Sweep\b|<Gyro\b/);
assert.doesNotMatch(face, /\u00c2\u00b0|\u00e2\u20ac\u201d/);
assert.match(manifest, /android:hasCode="false"/);
assert.doesNotMatch(manifest, /<service\b|<activity\b|<uses-permission\b/);
const slotIds = [...face.matchAll(/<ComplicationSlot slotId="(\d+)"/g)].map(m => m[1]);
assert.equal(new Set(slotIds).size, 5);
assert.deepEqual(slotIds,['10','20','30','40','50'],'Append new slots: Samsung maps saved selections by declaration order');
assert.match(face, /name="sweep_hub"[^>]*isCustomizable="FALSE"/);
const activityBounds=new Map();
const attribute=(tag,name)=>Number(tag.match(new RegExp('\\b'+name+'="([^"]+)"'))[1]);
for(const [id,name] of [[20,'steps'],[30,'minutes'],[40,'calories']]) {
  const slot=face.match(new RegExp('<ComplicationSlot slotId="'+id+'"[\\s\\S]*?</ComplicationSlot>'))[0];
  const tag=slot.match(/<BoundingRoundBox[^>]+/)[0];
  const b=Object.fromEntries(['x','y','width','height'].map(n=>[n,attribute(tag,n)]));
  activityBounds.set(id,b);
  for(const text of slot.matchAll(/<PartText[^>]+/g)) {
    const x=attribute(text[0],'x'),y=attribute(text[0],'y'),w=attribute(text[0],'width'),h=attribute(text[0],'height');
    assert.ok(x>=b.x && y>=b.y && x+w<=b.x+b.width && y+h<=b.y+b.height,'Slot '+id+' clips its number');
  }
  const target=face.match(new RegExp('<PartText name="'+name+'_target_display"[^>]+'))[0];
  const radius={20:150,30:168,40:186}[id];
  assert.ok(Math.abs(Math.hypot(attribute(target,'x')+attribute(target,'width')/2-225,attribute(target,'y')+attribute(target,'height')/2-225)-radius)<1,'Target must follow its track radius');
  const drawing=face.match(new RegExp('<PartDraw name="'+name+'_progress_band"[\\s\\S]*?</PartDraw>'))[0];
  const arc=drawing.match(/<Arc\b[\s\S]*?<\/Arc>/)[0];
  assert.equal(attribute(arc,'centerX'),225); assert.equal(attribute(arc,'centerY'),225);
  assert.equal(attribute(arc,'width'),radius*2); assert.equal(attribute(arc,'height'),radius*2);
  assert.match(arc,/thickness="12" cap="BUTT"/);
  assert.match(arc,/<RadialGradient centerX="225" centerY="225"/);
  const stops=arc.match(/positions="([^"]+)"/)[1].split(' ').map(Number);
  assert.ok(stops.length>=3 && stops[0]>=0 && stops.at(-1)===1);
  assert.ok(stops.every((stop,i)=>i===0 || stop>stops[i-1]));
  assert.match(drawing,/x="0" y="0" width="450" height="450"/);
  assert.ok(face.indexOf('<Group name="'+name+'_track_render"')>face.lastIndexOf('</ComplicationSlot>'),'Tracks must render outside cropped complication slots');
  assert.match(face,new RegExp('<Group name="'+name+'_track_render"[^>]*>\\s*<Variant mode="AMBIENT" target="alpha" value="0"'));
  for(let angle=146;angle<=214;angle++) {
    const x=225+radius*Math.sin(angle*Math.PI/180),y=225-radius*Math.cos(angle*Math.PI/180);
    assert.ok(x-7>=0 && y-7>=0 && x+7<=450 && y+7<=450,'Track must fit the scene viewport');
  }
}
const slotBounds=new Map([[10,{x:52,y:194,width:76,height:94}],[50,{x:205,y:205,width:40,height:40}],...activityBounds]);
for (const [id,provider] of [[30,'MinutesDataSource'],[40,'CaloriesDataSource']]) {
  const slot=face.match(new RegExp('<ComplicationSlot slotId="'+id+'"[\\s\\S]*?</ComplicationSlot>'))[0];
  assert.ok(slot.includes('primaryProvider="com.bobbfwed.emberphase.health/com.bobbfwed.emberphase.health.watch.'+provider+'" primaryProviderType="GOAL_PROGRESS"'));
  assert.ok(slot.includes('defaultSystemProvider="EMPTY" defaultSystemProviderType="EMPTY"'));
}
for(const [id,a] of slotBounds) for(const [other,b] of slotBounds) {
  if(id>=other) continue;
  assert.ok(a.x+a.width<=b.x || b.x+b.width<=a.x || a.y+a.height<=b.y || b.y+b.height<=a.y,'Editor slots '+id+' and '+other+' must never overlap');
}
for(const [id,x,y] of [[20,225,275],[30,204,325],[40,290,325]]) {
  const hits=[...slotBounds].filter(([,b])=>x>b.x && y>b.y && x<b.x+b.width && y<b.y+b.height).map(([id])=>id);
  assert.deepEqual(hits,[id],'Each activity number must select only its own provider');
}
for (const match of face.matchAll(/\bresource="([a-z][a-z0-9_]*)"/g)) {
  assert.ok(fs.existsSync(path.join(root, 'watchface/src/main/res/drawable-nodpi', match[1]+'.png')), `Missing ${match[1]}`);
}
console.log(`PASS: ${calendarCases} calendar dates; activity goals/ranges/empty states; detached reference-driven gauges and disjoint editor targets; battery bounds; seconds cutoff; resources and battery policy.`);
