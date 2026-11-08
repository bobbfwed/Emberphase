import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dayProgress,docks,evaluate,fold,watchFace} from './lib/parallax-scene.mjs';
import {progressExpressions,complicationDock} from './lib/parallax-docks.mjs';
import {svg} from './lib/parallax-preview.mjs';
const walk=(node,visit)=>{if(typeof node==='string')return;visit(node);node.children.forEach(c=>walk(c,visit));};
assert.equal(evaluate(dayProgress,{HOUR_0_23:0,MINUTE:0}),0);
assert.equal(evaluate(dayProgress,{HOUR_0_23:12,MINUTE:0}),0.5);
assert.equal(evaluate(dayProgress,{HOUR_0_23:10,MINUTE:8}),608/1440);
let previous=-1;
for(let minute=0;minute<1440;minute++) {
  const sources={HOUR_0_23:Math.floor(minute/60),MINUTE:minute%60};
  const p=evaluate(dayProgress,sources);
  assert.ok(p>previous && p<1);previous=p;
  walk(fold(),node=>{
    if(node.tag!=='Line')return;
    const values=Object.fromEntries(Object.entries(node.attrs).map(([k,v])=>[k,typeof v==='object'?evaluate(v.expression,sources):v]));
    for(const [x,y] of [[values.startX,values.startY],[values.endX,values.endY]]) {
      assert.ok(Number.isFinite(x)&&Number.isFinite(y));
      assert.ok(Math.hypot(x-225,y-225)<215,'Fold endpoint outside safe circle');
    }
  });
}
for(let i=0;i<docks.length;i++) {
  assert.ok(Math.hypot(docks[i].x-225,docks[i].y-225)+52<215);
  for(let j=i+1;j<docks.length;j++)assert.ok(Math.hypot(docks[i].x-docks[j].x,docks[i].y-docks[j].y)>104);
}
assert.doesNotMatch(watchFace(),/\[(?:SECOND|MILLISECOND|UTC_TIMESTAMP)\]/);
const goal=progressExpressions.GOAL_PROGRESS,range=progressExpressions.RANGED_VALUE;
const g=(value,target)=>({'COMPLICATION.GOAL_PROGRESS_VALUE':value,'COMPLICATION.GOAL_PROGRESS_TARGET_VALUE':target});
for(const [value,target,valid,fill] of [[0,100,true,0],[150,100,true,1],[50,100,true,0.5],[50,0,false],[50,-1,false],[NaN,100,false],[1,Infinity,false],[-1,100,false]]) {
  assert.equal(evaluate(goal.valid,g(value,target)),valid);
  if(valid)assert.equal(evaluate(goal.fraction,g(value,target)),fill);
}
const r=(value,min,max)=>({'COMPLICATION.RANGED_VALUE_VALUE':value,'COMPLICATION.RANGED_VALUE_MIN':min,'COMPLICATION.RANGED_VALUE_MAX':max});
assert.equal(evaluate(range.fraction,r(30,20,40)),0.5);
assert.equal(evaluate(range.fraction,r(50,20,40)),1);
assert.equal(evaluate(range.fraction,r(0,20,40)),0);
assert.equal(evaluate(range.valid,r(10,20,20)),false);
assert.equal(evaluate(range.valid,r(Infinity,0,100)),false);
for(const dock of docks) {
  const slot=complicationDock(dock);
  assert.deepEqual(slot.children.filter(c=>c.tag==='Complication').map(c=>c.attrs.type).sort(),['EMPTY','GOAL_PROGRESS','MONOCHROMATIC_IMAGE','RANGED_VALUE','SHORT_TEXT']);
  assert.equal(slot.attrs.isCustomizable,'TRUE');
  assert.ok(slot.children.some(c=>c.tag==='BoundingOval'));
}
const alternate=svg({docks:{101:{type:'SHORT_TEXT',TEXT:'18°',TITLE:'WEATHER'},102:{type:'SHORT_TEXT',TEXT:'14:30',TITLE:'NEXT'},103:{type:'SHORT_TEXT',TEXT:'68',TITLE:'BPM'}}});
assert.match(alternate,/>WEATHER</);assert.match(alternate,/>NEXT</);assert.match(alternate,/>BPM</);
assert.doesNotMatch(alternate,/>MIN<|>KCAL<|>STEPS</);
assert.doesNotMatch(svg({docks:{101:{type:'GOAL_PROGRESS',GOAL_PROGRESS_VALUE:NaN,GOAL_PROGRESS_TARGET_VALUE:0}}}),/>NaN<|>Infinity</);
assert.equal(fs.readFileSync(new URL('../watchface/src/main/res/raw/watchface.xml',import.meta.url),'utf8'),watchFace(),'Generated scene is stale');
console.log('PASS: all 1440 fold positions, civil-day endpoints, dock geometry, minute cadence, and generated WFF consistency.');
