import assert from 'node:assert/strict';
import {loadSweepModel,evaluateWff,sweepFrame} from './lib/sweep-model.mjs';
const model=loadSweepModel(new URL('../watchface/src/main/res/raw/watchface.xml',import.meta.url));
const fixture={YEAR:2026,MONTH:11,DAY:1,DAY_Z:'01',DAY_OF_WEEK:1,DAY_OF_YEAR:305,AMPM_STATE:1,
  HOUR_0_11_MINUTE:10+10/60,MINUTE_SECOND:10+22/60,SECOND:22,BATTERY_PERCENT:73,
  'REFERENCE.steps_goal_end':214-68*.81,'REFERENCE.minutes_goal_end':214-68*.7,'REFERENCE.calories_goal_end':214-68*.76};
const wrap=a=>((a%360)+360)%360;
const idle=sweepFrame(model,0,fixture,true);
const first=sweepFrame(model,0,fixture),end=sweepFrame(model,3000,fixture);
for(const name of ['hour','minute','second','moon','balance']) {
  assert.ok(Math.abs(wrap(first[name])-wrap(idle[name]))<1e-7,name+' starts at live position');
  assert.ok(Math.abs(wrap(end[name])-wrap(idle[name]))<1e-7,name+' lands at live position');
}
for(const name of ['battery','steps','minutes','calories','weekday','month','date']) {
  assert.equal(first[name],idle[name]); assert.equal(end[name],idle[name]);
}
for(const t of [360,2250]) {
  const f=sweepFrame(model,t,fixture);
  assert.ok(Math.abs(wrap(f.hour))<1e-8 && Math.abs(wrap(f.minute))<1e-8,'Both hands meet at 12 around the full rotations');
}
let previous=sweepFrame(model,360,fixture);
for(let t=361;t<=2250;t++) {
  const f=sweepFrame(model,t,fixture);
  assert.ok(f.hour>=previous.hour && f.minute<=previous.minute,'Hands rotate in opposite directions');
  previous=f;
}
const seen={weekday:new Set(),month:new Set(),date:new Set()};
for(let t=0;t<=3000;t+=1000/30) {
  const f=sweepFrame(model,t,fixture);
  for(const name of Object.keys(seen)) seen[name].add(f[name]);
  assert.ok(f.battery>=175 && f.battery<=274);
  for(const name of ['steps','minutes','calories']) assert.ok(f[name]>=146-1e-9 && f[name]<=214+1e-9);
}
assert.equal(seen.weekday.size,7); assert.equal(seen.month.size,12); assert.equal(seen.date.size,31);
// A missing health provider still returns to an empty track, never a fake total.
const empty=sweepFrame(model,3000,{...fixture,'REFERENCE.minutes_goal_end':214});
assert.equal(empty.minutes,214);
const start=86399001;
assert.equal(evaluateWff(model.expressions.progress,{'REFERENCE.sweep_start':start,UTC_TIMESTAMP:86401000}),2/3);
for(const hour of [0,5.25,11.999]) for(const minute of [0,30.5,59.999]) {
  const f=sweepFrame(model,3000,{...fixture,HOUR_0_11_MINUTE:hour,MINUTE_SECOND:minute});
  assert.ok(Math.abs(wrap(f.hour)-hour*30)<1e-8);
  assert.ok(Math.abs(wrap(f.minute)-minute*6)<1e-8);
}
console.log('PASS: three-second sweep endpoints, opposite rotations, all 7/12/31 drum values at 30 fps, gauge bounds, unavailable goals and UTC-midnight wrap.');
