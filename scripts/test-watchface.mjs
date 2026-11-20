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
// The carrier angle is linear in phase: a = (p - 0.5) * 180 for the moon in view.
function meanPhase(date) {
  return wrap((moonAngle(date)+90)/180,1);
}
let moonCases=0;
for (const year of [1902,1999,2000,2024,2026,2100]) {
  for (let date=new Date(Date.UTC(year,0,1)); date.getUTCFullYear()===year; date=new Date(+date+86400000)) {
    for (const hour of [0,12]) {
      const start=new Date(+date+hour*3600000);
      const angle=moonAngle(start);
      assert.ok(angle>=-90 && angle<270);
      const midpoint=+start+6*3600000;
      const expected=-90+180*wrap((midpoint-moonEpoch)/86400000/lunarMonth,2);
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

// Returns one element by tag and name, including nested elements of the same tag.
function element(tag,name) {
  const start=face.indexOf('<'+tag+' name="'+name+'"');
  assert.ok(start>=0,'Missing '+tag+' '+name);
  const open=new RegExp('<'+tag+'\\b[^>]*?(/?)>|</'+tag+'>','g');
  open.lastIndex=start;
  let depth=0;
  for(let m;(m=open.exec(face));) {
    if(m[0].startsWith('</')) depth--; else if(!m[1]) depth++;
    if(depth===0) return face.slice(start,open.lastIndex);
  }
  throw new Error('Unclosed '+tag+' '+name);
}
const transformOf=(xml,target)=>unescapeXml(xml.match(new RegExp('<Transform target="'+target+'" value="([^"]+)"'))[1]);
const numberAttr=(tag,name)=>Number(tag.match(new RegExp('\\b'+name+'="([^"]+)"'))[1]);

// Moon window: sky, a 140x140 two-moon carrier and one phase cup per moon.
assert.doesNotMatch(face,/moon_disc"|resource="moon_disc/,'moon_disc is replaced by moon_carrier');
const moonSweep=element('Group','moon_sweep');
assert.match(moonSweep,/^<Group name="moon_sweep" x="155" y="46" width="140" height="140" pivotX="0.5" pivotY="0.5">/);
assert.equal(transformOf(moonSweep,'angle'),'360 * [REFERENCE.sweep_turn]');
assert.match(moonPart,/<PartImage name="moon_disc_rotation" x="0" y="0" width="140" height="140" pivotX="0.5" pivotY="0.5">/);
assert.match(moonPart,/<Image resource="moon_carrier" \/>/);
assert.match(moonPart,/<Reference name="moon_angle" source="angle"/);
const skyIndex=face.indexOf('<PartImage name="moon_sky" x="138" y="46" width="174" height="72">');
assert.ok(skyIndex>=0 && skyIndex<face.indexOf('<Group name="moon_sweep"') && !moonSweep.includes('moon_sky'),'The sky is static and drawn before the carrier');
assert.ok(face.indexOf('<Group name="moon_sweep"')>face.indexOf('<Group name="interactive_dial"') && face.indexOf('<Group name="moon_sweep"')<face.indexOf('<Group name="optional_balance"'),'The moon window stays inside the ambient-hidden interactive dial');
assert.equal(face.split('[DAY_OF_YEAR]').length,moonPart.split('[DAY_OF_YEAR]').length,'The long moon expression is not repeated; other parts read REFERENCE.moon_angle');
const frameExpressions=[1,2].map(n=>transformOf(element('Group','moon_frame_'+n+'_source'),'angle'));
const cupGroups=[1,2].map(n=>element('Group','moon_cups_'+n));
assert.equal(transformOf(cupGroups[0],'angle'),'[REFERENCE.moon_angle]');
assert.equal(transformOf(cupGroups[1],'angle'),'[REFERENCE.moon_angle] + 180');
const cupFrames=[...Array(60).keys()].filter(k=>k!==30);
for(const [index,group] of cupGroups.entries()) {
  assert.match(group,/^<Group name="moon_cups_\d" x="0" y="0" width="140" height="140" pivotX="0.5" pivotY="0.5">/);
  const images=[...group.matchAll(/<Compare expression="([^"]+)"><PartImage x="41" y="3" width="58" height="58"><Image resource="moon_cup_(\d\d)" \/><\/PartImage><\/Compare>/g)];
  assert.deepEqual(images.map(m=>Number(m[2])),cupFrames,'Each moon selects among cup frames 00..59 without 30');
  for(const [,name,frame] of images) {
    assert.equal(expressions.get(name),'[REFERENCE.moon_frame_'+(index+1)+'] == '+Number(frame));
    for(const k of [...cupFrames,30]) assert.equal(evaluate(expressions.get(name),{['REFERENCE.moon_frame_'+(index+1)]:k}),k===Number(frame));
  }
  assert.doesNotMatch(group,/<Default>/,'Frame 30 (full) shows no cup');
}
const wrap180=a=>{const w=wrap(a+180,360)-180;return w===-180?180:w;};
const expectedFrame=a=>Math.abs(a)>=88.5?0:Math.round((a+90)/3);
const moonFrames=angle=>frameExpressions.map(e=>evaluate(e,{'REFERENCE.moon_angle':angle}));
// Exact geometry: new (-90 or 90), quarters at -45/45, full at 0, both moon positions.
for(const [angle,expected] of [[-90,[0,0]],[90,[0,0]],[270-1e-9,[0,0]],[-45,[15,0]],[0,[30,0]],[45,[45,0]],[135,[0,15]],[180,[0,30]],[225,[0,45]],[-88.4,[1,0]],[88.4,[59,0]],[-88.5,[0,0]],[88.5,[0,0]],[1.4,[30,0]],[-1.6,[29,0]]]) {
  assert.deepEqual(moonFrames(angle),expected,'Cup frames at carrier angle '+angle);
}
assert.deepEqual(moonFrames(referenceDefaults['REFERENCE.moon_angle']),[0,0],'A missing moon angle closes both cups');
let cupCases=0;
for (const year of [1902,1999,2000,2024,2026,2100]) {
  for (let date=new Date(Date.UTC(year,0,1)); date.getUTCFullYear()===year; date=new Date(+date+43200000)) {
    const angle=moonAngle(date);
    const frames=moonFrames(angle);
    for(const [i,frame] of frames.entries()) {
      const a=wrap180(angle+180*i);
      assert.ok(Number.isInteger(frame) && frame>=0 && frame<=60,'Frame index is an integer 0..60');
      assert.notEqual(frame,60);
      assert.equal(frame,expectedFrame(a),'Frame k = round((a + 90) / 3) for moon '+(i+1));
      if(frame===30) assert.ok(Math.abs(a)<1.5,'No cup only within 1.5 degrees of full');
      if(Math.abs(a)>90) assert.equal(frame,0,'The lower moon is always fully covered');
    }
    assert.ok(frames[0]===0 || frames[1]===0,'The two moons are never both partly lit');
    cupCases++;
  }
}
// USNO events. Only the mean-cycle error (under one day, 6.1 degrees of carrier
// turn) separates the shown frame from the ideal 00/15/30/45: at most two cup steps.
const fixtureFrames=[];
for (const [time,phase] of lunarFixtures) {
  const date=new Date(time),sample=new Date(Math.floor(+date/43200000)*43200000);
  const angle=moonAngle(sample),frames=moonFrames(angle);
  const visible=frames.findIndex(k=>k!==0),a=wrap180(angle+180*Math.max(visible,0));
  fixtureFrames.push(time.slice(0,10)+'='+frames.join('/'));
  const ideal={0:-90,0.25:-45,0.5:0,0.75:45}[phase];
  const offset=phase===0?Math.min(Math.abs(wrap180(angle)+90),Math.abs(wrap180(angle)-90)):Math.abs(a-ideal);
  assert.ok(offset<=180/lunarMonth,'Fixture '+time+' is within one day of carrier turn, off by '+offset.toFixed(2)+' degrees');
  if(phase===0) assert.ok(frames.every(k=>[0,1,2,58,59].includes(k)),'New moon fixture '+time+' shows closed cups, saw '+frames);
  if(phase===0.5) assert.ok(visible>=0 && Math.abs(a)<6.1 && Math.abs(frames[visible]-30)<=2,'Full moon fixture '+time+' shows the top moon, saw '+frames);
  if(phase===0.25) assert.ok(a<0 && Math.abs(frames[visible]-15)<=2,'First quarter '+time+' is on the left at frame 15 +/- 2, saw '+frames);
  if(phase===0.75) assert.ok(a>0 && Math.abs(frames[visible]-45)<=2,'Last quarter '+time+' is on the right at frame 45 +/- 2, saw '+frames);
}
console.log(`PASS: ${cupCases} half-days of phase-cup frames for both moons; USNO fixture frames ${fixtureFrames.join(' ')}.`);
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
assert.doesNotMatch(seconds, /<Transform target="alpha"/, 'Remove the seconds hand at low battery instead of hiding it');
const secondsVisible = expressions.get('seconds_power_available');
for (const [battery, progress, expected] of [[15,1,false],[16,1,true],[73,1,true],[73,0.5,false]]) {
  assert.equal(!!evaluate(secondsVisible, {BATTERY_PERCENT: battery, 'REFERENCE.sweep_progress': progress}), expected);
}
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
  assert.equal(counterclockwise,36,'Each second advances one slice, 36 degrees counterclockwise, including the minute rollover');
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
assert.equal(duration,0.2,'The visible balance step lasts 200 ms');
assert.equal(fps,15,'The balance step is sampled at 15 fps');
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
assert.equal(new Set(slotIds).size, 7);
assert.ok(slotIds.length<=8,'WFF allows at most eight complication slots');
assert.deepEqual(slotIds,['10','20','30','40','50','60','70'],'Append new slots: Samsung maps saved selections by declaration order');
assert.match(face, /BooleanConfiguration id="motion_detail"[^>]*defaultValue="TRUE"/);
assert.equal([...face.matchAll(/<Tick\b/g)].length, 1, 'Only the powered motion branch overshoots');
assert.match(face, /<SecondHand\b[^>]*\/>/, 'Seconds remain available without the overshoot tick');
const motion=expressions.get('motion_power_available');
for (const [battery, saving, expected] of [[21,0,true],[20,0,false],[15,0,false],[100,1,false],[73,0,true]]) {
  assert.equal(!!evaluate(motion,{BATTERY_PERCENT:battery,'REFERENCE.power_saving':saving}), expected, `motion at ${battery}% saving ${saving}`);
}
assert.equal(face.match(/<Group name="balance_sweep"[\s\S]*?<Transform target="angle" value="([^"]+)"/)[1], '0');
assert.doesNotMatch(face.match(/<PartImage name="balance_rest"[\s\S]*?<\/PartImage>/)[0], /\[SECOND\]|<Animation\b/);
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
const hiddenSlotBounds=new Map();
for(const [id,name,provider,display] of [[60,'power_saving_state','PowerSaveDataSource','power_saving_slot'],[70,'brightness_state','BrightnessDataSource','brightness_slot']]) {
  const slot=face.match(new RegExp('<ComplicationSlot slotId="'+id+'"[\\s\\S]*?</ComplicationSlot>'))[0];
  const tag=slot.match(/<ComplicationSlot[^>]+/)[0];
  assert.match(tag,new RegExp('name="'+name+'" x="400" y="'+(id===60?220:232)+'" width="8" height="8" supportedTypes="RANGED_VALUE EMPTY" displayName="'+display+'" isCustomizable="FALSE"'));
  assert.match(slot,/<Variant mode="AMBIENT" target="alpha" value="0" duration="0" \/>\s*<BoundingBox x="0" y="0" width="8" height="8" \/>/);
  assert.ok(slot.includes('primaryProvider="com.bobbfwed.emberphase.health/com.bobbfwed.emberphase.health.watch.'+provider+'" primaryProviderType="RANGED_VALUE" defaultSystemProvider="EMPTY" defaultSystemProviderType="EMPTY"'));
  const box=slot.match(/<BoundingBox[^>]+/)[0];
  const b={x:attribute(tag,'x')+attribute(box,'x'),y:attribute(tag,'y')+attribute(box,'y'),width:attribute(box,'width'),height:attribute(box,'height')};
  for(const [x,y] of [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]]) {
    assert.ok(Math.hypot(x-225,y-225)<225,'Hidden slot '+id+' must sit inside the dial circle so it activates');
  }
  hiddenSlotBounds.set(id,b);
}
// Slot 70: 1 only for a 0..1 range whose value is above zero; anything else is normal.
const lowLightSignal=exportedExpression('low_light_signal');
for(const [max,value,expected] of [[1,1,1],[1,0,0],[1,0.5,1],[100,50,0],[0,0,0],[1,-1,0]]) {
  assert.equal(evaluate(lowLightSignal,{'COMPLICATION.RANGED_VALUE_MAX':max,'COMPLICATION.RANGED_VALUE_VALUE':value}),expected,`brightness signal max ${max} value ${value}`);
}
assert.equal(referenceDefaults['REFERENCE.low_light_signal'],0,'A missing companion leaves the dial normal');
const slotBounds=new Map([[10,{x:52,y:194,width:76,height:94}],[50,{x:205,y:205,width:40,height:40}],...activityBounds,...hiddenSlotBounds]);
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

// Low-light: editor option x companion signal.
assert.match(face,/<ListConfiguration id="light_mode" displayName="light_mode" defaultValue="0">\s*<ListOption id="0" displayName="light_mode_auto" \/>\s*<ListOption id="1" displayName="light_mode_normal" \/>\s*<ListOption id="2" displayName="light_mode_low" \/>\s*<\/ListConfiguration>\s*<\/UserConfigurations>/,'light_mode is the last editor option with Auto as default');
assert.equal(strings.get('light_mode'),'Low-light dial');
const lightBranches=new Map([...element('Group','light_mode_source').match(/<ListConfiguration id="light_mode">([\s\S]*?)<\/ListConfiguration>/)[1]
  .matchAll(/<ListOption id="(\d)">([\s\S]*?)<\/ListOption>/g)].map(m=>[Number(m[1]),Object.fromEntries([...m[2].matchAll(/<Transform target="angle" value="([^"]+)" \/>\s*<Reference name="([^"]+)"/g)].map(r=>['REFERENCE.'+r[2],Number(r[1])]))]));
assert.deepEqual([...lightBranches.keys()],[0,1,2]);
const lowLightSource=element('Group','low_light_source');
assert.match(lowLightSource,/<Reference name="low_light" source="angle" defaultValue="0"/);
const lowLightExpression=transformOf(lowLightSource,'angle');
const lowLight=(mode,signal)=>evaluate(lowLightExpression,{...lightBranches.get(mode),'REFERENCE.low_light_signal':signal});
for(const [mode,signal,expected] of [[0,0,0],[0,1,1],[1,0,0],[1,1,0],[2,0,1],[2,1,1]]) {
  assert.equal(lowLight(mode,signal),expected,`low_light for light_mode ${mode} and signal ${signal}`);
}
assert.equal(evaluate(lowLightExpression,{}),0,'Defaults give the normal dial');
// Reference sources must not sit inside anything hidden in interactive mode.
for(const name of ['light_mode_source','low_light_source']) {
  const source=element('Group',name);
  assert.doesNotMatch(source,/<Variant|target="alpha"/);
  const index=face.indexOf('<Group name="'+name+'"');
  assert.ok(index>face.lastIndexOf('</ComplicationSlot>') && index<face.indexOf('<Group name="lowlight_dial"'),name+' is a top-level scene group');
}
const lowlightDial=element('Group','lowlight_dial');
assert.match(lowlightDial,/^<Group name="lowlight_dial" x="0" y="0" width="450" height="450">\s*<Variant mode="AMBIENT" target="alpha" value="0" \/>/);
assert.match(lowlightDial,/<PartImage x="0" y="0" width="450" height="450">\s*<Image resource="lowlight_dial" \/>/);
const overlayIndex=face.indexOf('<Group name="lowlight_dial"');
assert.ok(overlayIndex>face.indexOf('<Group name="calories_track_render"') && overlayIndex<face.indexOf('<Group name="ambient_dial"') && overlayIndex<face.indexOf('<Group name="normal_hands"'),'The overlay covers the whole dial and sits under the hands');
for(const signal of [0,1]) assert.equal(evaluate(transformOf(lowlightDial,'alpha'),{'REFERENCE.low_light':signal}),signal?255:0);

// Hands: exactly one set shows in every state.
const handGroups=Object.fromEntries(['normal_hands','lowlight_hands','sweep_hands','sweep_normal_hands','sweep_lowlight_hands','optional_ticking_seconds','optional_sweep_seconds','center_caps'].map(n=>[n,element('Group',n)]));
for(const name of ['normal_hands','lowlight_hands','sweep_hands','optional_ticking_seconds','center_caps']) {
  assert.match(handGroups[name],new RegExp('^<Group name="'+name+'"[^>]*>\\s*<Variant mode="AMBIENT" target="alpha" value="0"'),name+' hides in ambient');
}
assert.match(handGroups.lowlight_hands,/<HourHand resource="lowlight_hour_hand" x="203" y="82" width="44" height="172" pivotX="0.5" pivotY="0.8313953" \/>/);
assert.match(handGroups.lowlight_hands,/<MinuteHand resource="lowlight_minute_hand" x="206" y="34" width="38" height="220" pivotX="0.5" pivotY="0.8681818" \/>/);
for(const hand of face.matchAll(/<(?:(?:HourHand|MinuteHand|SecondHand)\b|PartImage name="sweep_\w+_hand")[^>]*/g)) {
  const tag=hand[0];
  const x=numberAttr(tag,'x')+numberAttr(tag,'width')*numberAttr(tag,'pivotX'),y=numberAttr(tag,'y')+numberAttr(tag,'height')*numberAttr(tag,'pivotY');
  assert.ok(Math.abs(x-225)<0.01 && Math.abs(y-225)<0.01,'Every hand pivots on the dial centre: '+tag);
}
for(const name of ['hour','minute']) {
  assert.equal(transformOf(element('PartImage','sweep_lowlight_'+name+'_hand'),'angle'),transformOf(element('PartImage','sweep_'+name+'_hand'),'angle'),'Low-light sweep '+name+' follows the same path');
}
assert.match(handGroups.sweep_lowlight_hands,/resource="lowlight_hour_hand"[\s\S]*resource="lowlight_minute_hand"/);
const alphaOf=(name,data)=>evaluate(transformOf(handGroups[name],'alpha'),data);
let handStates=0;
for(const ambientMode of [false,true]) for(const low of [0,1]) for(const [battery,requested] of [[73,false],[73,true],[10,false],[10,true]]) for(const progress of [0,0.5,0.999,1]) {
  // The sweep references exist only while sweep_requested is true; otherwise they keep defaults.
  const start=requested?1:0;
  const sweeping=evaluate(expressions.get('sweep_requested'),{'REFERENCE.sweep_start':start,BATTERY_PERCENT:battery});
  const data={BATTERY_PERCENT:battery,'REFERENCE.low_light':low,'REFERENCE.sweep_progress':sweeping?progress:referenceDefaults['REFERENCE.sweep_progress']};
  const sweepShown=!ambientMode && evaluate(expressions.get('sweep_hands_visible'),data);
  const sets={
    normal:!ambientMode && alphaOf('normal_hands',data)>0,
    lowlight:!ambientMode && alphaOf('lowlight_hands',data)>0,
    sweepNormal:sweepShown && alphaOf('sweep_normal_hands',data)>0,
    sweepLowlight:sweepShown && alphaOf('sweep_lowlight_hands',data)>0,
    ambient:ambientMode,
  };
  const shown=Object.keys(sets).filter(k=>sets[k]);
  const expected=ambientMode?'ambient':data['REFERENCE.sweep_progress']<1?(low?'sweepLowlight':'sweepNormal'):(low?'lowlight':'normal');
  assert.deepEqual(shown,[expected],`hand sets for ambient ${ambientMode}, low_light ${low}, battery ${battery}, progress ${data['REFERENCE.sweep_progress']}`);
  if(!ambientMode) {
    for(const name of ['optional_ticking_seconds','optional_sweep_seconds']) assert.equal(alphaOf(name,data),low?64:255,name+' dims to 25 percent in low light');
    const caps=['normal_center_cap','lowlight_center_cap'].map(n=>evaluate(transformOf(element('PartImage',n),'alpha'),data));
    assert.deepEqual(caps,low?[0,255]:[255,0],'One centre cap at a time');
  }
  handStates++;
}
assert.equal([...face.matchAll(/<SecondHand\b/g)].length,3,'The ticking seconds block is not duplicated for low light');
assert.match(element('PartImage','normal_center_cap'),/resource="center_cap"/);
assert.match(element('PartImage','lowlight_center_cap'),/x="211" y="211" width="28" height="28"[\s\S]*resource="lowlight_center_cap"/);
assert.deepEqual([...element('Group','ambient_dial').matchAll(/resource="([^"]+)"/g)].map(m=>m[1]),['ambient_indices','ambient_battery_slider','ambient_hour_hand','ambient_minute_hand','ambient_center_cap'],'Ambient mode is unchanged');
assert.doesNotMatch(element('Group','ambient_dial'),/low_light|lowlight/);

// The face installs side by side with mechanical Emberphase under its own ID.
const gradle=fs.readFileSync(path.join(root,'watchface/build.gradle.kts'),'utf8');
const buildScript=fs.readFileSync(path.join(root,'scripts/Build-WatchFace.ps1'),'utf8');
const gradleId=gradle.match(/applicationId = "([^"]+)"/)[1];
const scriptId=buildScript.match(/SetAttribute\('package','([^']+)'\)/)[1];
assert.equal(scriptId,gradleId,'Build-WatchFace.ps1 and Gradle must build the same application ID');
assert.equal(gradleId,'com.bobbfwed.emberphase.tritium');
assert.equal(buildScript.match(/--version-code (\d+)/)[1],gradle.match(/versionCode = (\d+)/)[1],'Version codes agree');
assert.equal(buildScript.match(/--version-name '([^']+)'/)[1],gradle.match(/versionName = "([^"]+)"/)[1],'Version names agree');
assert.equal(strings.get('watch_face_name'),'Emberphase Tritium');
console.log(`PASS: ${calendarCases} calendar dates; activity goals/ranges/empty states; detached reference-driven gauges and disjoint editor targets; battery bounds; seconds cutoff; battery policy.`);
console.log(`PASS: low-light truth table (3 modes x 2 signals); slot 70 signal, geometry and order; ${handStates} hand-visibility states; app ID ${gradleId} ${gradle.match(/versionName = "([^"]+)"/)[1]}.`);

// Artwork. Runs last so a missing file from the art pipeline does not hide other results.
const drawables=path.join(root,'watchface/src/main/res/drawable-nodpi');
const resources=[...new Set([...face.matchAll(/\bresource="([a-z][a-z0-9_]*)"/g)].map(m=>m[1]))];
const cupResources=resources.filter(name=>name.startsWith('moon_cup_')).sort();
assert.deepEqual(cupResources,cupFrames.map(k=>'moon_cup_'+String(k).padStart(2,'0')),'Cup frames are exactly 00..59 without 30');
const expectedSizes={moon_sky:[174,72],moon_carrier:[140,140],dial_frame:[450,450],hour_hand:[22,150],minute_hand:[16,198],
  lowlight_dial:[450,450],lowlight_hour_hand:[44,172],lowlight_minute_hand:[38,220],lowlight_center_cap:[28,28],center_cap:[28,28],
  ...Object.fromEntries(cupResources.map(name=>[name,[58,58]]))};
const missing=[],wrongSize=[];
for(const name of resources) {
  const file=path.join(drawables,name+'.png');
  if(!fs.existsSync(file)) { missing.push(name); continue; }
  const header=fs.readFileSync(file).subarray(0,24);
  assert.equal(header.toString('latin1',1,4),'PNG',name+'.png is a PNG');
  const size=[header.readUInt32BE(16),header.readUInt32BE(20)];
  if(expectedSizes[name] && (size[0]!==expectedSizes[name][0] || size[1]!==expectedSizes[name][1])) wrongSize.push(`${name} is ${size.join('x')}, expected ${expectedSizes[name].join('x')}`);
}
if(missing.length || wrongSize.length) {
  if(missing.length) console.error(`FAIL: ${missing.length} artwork file(s) referenced by watchface.xml are missing from drawable-nodpi: ${missing.join(', ')}`);
  if(wrongSize.length) console.error(`FAIL: artwork with the wrong size: ${wrongSize.join('; ')}`);
  process.exit(1);
}
console.log(`PASS: all ${resources.length} referenced artwork files exist at their interface sizes, including ${cupResources.length} cup frames.`);
