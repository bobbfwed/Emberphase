import fs from 'node:fs';
import {loadSweepModel,evaluateWff,sweepFrame} from './lib/sweep-model.mjs';
const root=new URL('../',import.meta.url);
const model=loadSweepModel(new URL('watchface/src/main/res/raw/watchface.xml',root));
const images=Object.fromEntries(['moon_disc','dial_frame','calendar_bezel','balance_wheel','battery_slider','hour_hand','minute_hand','second_hand','center_cap','wx_14'].map(name=>[
  name,'data:image/png;base64,'+fs.readFileSync(new URL('watchface/src/main/res/drawable-nodpi/'+name+'.png',root)).toString('base64')]));
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Emberphase · mechanical sweep</title><style>
body{margin:0;background:#101213;color:#eee;font:16px system-ui;text-align:center}main{max-width:550px;margin:26px auto;padding:16px}
h1{font-size:24px}canvas{width:min(90vw,450px);height:auto;display:block;margin:18px auto;touch-action:manipulation}
button{background:#d95417;color:white;border:0;border-radius:8px;padding:12px 24px;font:inherit;cursor:pointer}p{color:#aeb4b8;line-height:1.5}
</style><main><h1>Mechanical sweep</h1><canvas id="face" width="450" height="450" aria-label="Tap the orange center hub to play the sweep"></canvas>
<button id="replay">Replay center tap</button><p>Tap the orange hub. Six seconds, then the live time and date.<br>Weather and activity values are illustrative samples.</p>
<p>On your watch, the sweep runs only when you tap the center hub.<br>Motion timing may vary slightly from this preview.</p></main>
<script>
const model=${JSON.stringify(model)}, urls=${JSON.stringify(images)};
${evaluateWff.toString()}
${sweepFrame.toString()}
const canvas=document.getElementById('face'),ctx=canvas.getContext('2d'),art={};
let start=-Infinity,lastFrame=-Infinity;
function asset(name,x,y,w,h,angle=0,px=.5,py=.5){ctx.save();ctx.translate(x+w*px,y+h*py);ctx.rotate(angle*Math.PI/180);ctx.drawImage(art[name],-w*px,-h*py,w,h);ctx.restore();}
function label(text,x,y,w,size,color='#f6f6f0',scaleY=1){ctx.save();ctx.translate(x+w/2,y+size*.675);ctx.scale(1,scaleY);ctx.font='bold '+size+'px "Arial Narrow", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,0,0,w);ctx.restore();}
function track(radius,end,colors){const ratio=(214-end)/68;if(ratio<=0)return;const g=ctx.createRadialGradient(225,225,radius-6,225,225,radius+6);[0,.12,.32,.45,.58,.84,1].forEach((p,i)=>g.addColorStop(p,colors[i]));ctx.strokeStyle=g;ctx.lineWidth=12;ctx.lineCap='butt';ctx.beginPath();ctx.arc(225,225,radius,124*Math.PI/180,(124-68*ratio)*Math.PI/180,true);ctx.stroke();const a=end*Math.PI/180;ctx.beginPath();ctx.moveTo(225+(radius-5.5)*Math.sin(a),225-(radius-5.5)*Math.cos(a));ctx.lineTo(225+(radius+5.5)*Math.sin(a),225-(radius+5.5)*Math.cos(a));ctx.lineWidth=.8;ctx.strokeStyle=colors[3];ctx.stroke();}
function draw(now){
 if(now-lastFrame<1000/30){requestAnimationFrame(draw);return;}lastFrame=now;
 const date=new Date(),dayOfYear=Math.floor((Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate())-Date.UTC(date.getUTCFullYear(),0,1))/86400000)+1;
 const fixture={YEAR:date.getFullYear(),MONTH:date.getMonth()+1,DAY:date.getDate(),DAY_Z:String(date.getDate()).padStart(2,'0'),DAY_OF_WEEK:date.getDay()+1,DAY_OF_YEAR:dayOfYear,AMPM_STATE:date.getUTCHours()<12?0:1,
 HOUR_0_11_MINUTE:date.getHours()%12+date.getMinutes()/60,MINUTE_SECOND:date.getMinutes()+date.getSeconds()/60,SECOND:date.getSeconds(),BATTERY_PERCENT:73,
 'REFERENCE.steps_goal_end':214-68*6482/8000,'REFERENCE.minutes_goal_end':214-68*42/60,'REFERENCE.calories_goal_end':214-68*380/500};
 const elapsed=now-start,active=elapsed>=0&&elapsed<model.durationMs,f=sweepFrame(model,Math.min(model.durationMs,elapsed),fixture,!active);
 ctx.fillStyle='black';ctx.fillRect(0,0,450,450);
 asset('moon_disc',135,40,180,180,f.moon);ctx.save();ctx.translate(225,225);ctx.scale(1,.38);asset('balance_wheel',-74,-74,148,148,f.balance);ctx.restore();asset('dial_frame',0,0,450,450);
 for(const [kind,x,w] of [['weekday',136,57],['month',197,55],['date',258,55]]){label(f[kind+'_prev'],x,124,w,22,'#c3c3c3',.58);label(f[kind],x,147,w,22,kind==='weekday'?'#ff6a15':'#f6f6f0');label(f[kind+'_next'],x,165,w,22,'#c3c3c3',.58);}
 asset('calendar_bezel',125,125,200,68);asset('battery_slider',359,f.battery,21,13);asset('wx_14',63,194,47,47);
 label('56°',52,236,75,29);label('H 61°F',52,267,75,14);label('6,482',169,257,112,34);label('42',178,307,53,23);label('380',262,307,57,23);
 label('8,000',312,318,43,13);label('60',325,331,43,13);label('500',337,343,43,13);
 track(150,f.steps,['#662400','#bf4005','#ff7415','#ffd79b','#ff9c40','#df5206','#702500']);track(168,f.minutes,['#004955','#008f9e','#00d6e9','#b2faff','#38e9f4','#00a7bc','#004e60']);track(186,f.calories,['#254d00','#4a9700','#79ef06','#e0ffad','#a0ff30','#65c900','#2b5b00']);
 asset('hour_hand',214,93,22,150,f.hour,.5,.88);asset('minute_hand',217,45,16,198,f.minute,.5,.9090909);asset('second_hand',222,23,6,230,f.second,.5,.8782609);asset('center_cap',211,211,28,28);
 requestAnimationFrame(draw);
}
function play(){if(performance.now()-start>=model.durationMs)start=performance.now();}
canvas.addEventListener('pointerup',event=>{const box=canvas.getBoundingClientRect(),x=(event.clientX-box.left)*450/box.width,y=(event.clientY-box.top)*450/box.height;if(Math.hypot(x-225,y-225)<=25)play();});
document.getElementById('replay').onclick=play;
Promise.all(Object.entries(urls).map(([name,url])=>new Promise(resolve=>{const im=new Image();im.onload=()=>{art[name]=im;resolve();};im.src=url;}))).then(()=>{play();requestAnimationFrame(draw);});
</script></html>`;
fs.writeFileSync(new URL('docs/previews/mechanical-sweep.html',root),html);
console.log('Wrote standalone interactive sweep preview from production expressions and artwork.');
