import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dayProgress,docks,evaluate,fold,watchFace} from './lib/parallax-scene.mjs';
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
assert.equal(fs.readFileSync(new URL('../watchface/src/main/res/raw/watchface.xml',import.meta.url),'utf8'),watchFace(),'Generated scene is stale');
console.log('PASS: all 1440 fold positions, civil-day endpoints, dock geometry, minute cadence, and generated WFF consistency.');
