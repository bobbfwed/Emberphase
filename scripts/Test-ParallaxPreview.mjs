import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const browser=process.env.PARALLAX_BROWSER??'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile=path.join(root,'artifacts','preview-cdp-'+process.pid);
fs.mkdirSync(profile,{recursive:true});
const child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile],{windowsHide:true,stdio:'ignore'});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket;let serial=0;const pending=new Map();const errors=[];
function command(method,params={}) {return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
try {
  const portFile=path.join(profile,'DevToolsActivePort');
  for(let i=0;i<150&&!fs.existsSync(portFile);i++)await pause(100);
  assert.ok(fs.existsSync(portFile),'Browser debugging endpoint unavailable');
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
  const target=await (await fetch(`http://127.0.0.1:${port}/json/new?${pathToFileURL(path.join(root,'docs/previews/index.html')).href}`,{method:'PUT'})).json();
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const item=pending.get(message.id);pending.delete(message.id);if(message.error)item.reject(Error(message.error.message));else item.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);});
  await command('Runtime.enable');
  const run=async expression=>{const result=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
  for(let i=0;i<100;i++){if(await run("document.readyState==='complete' && document.querySelector('#face text')!==null"))break;await pause(100);}
  await run('fitText(document.querySelector("#face"))');
  assert.equal(await run("document.querySelector('[data-name=value_101_GOAL_PROGRESS]').textContent"),'6,240');
  await run("document.querySelector('#data').value='alternate';update();fitText(document.querySelector('#face'))");
  assert.ok(await run("[...document.querySelectorAll('#face text')].some(t=>t.textContent==='WEATHER') && ![...document.querySelectorAll('#face text')].some(t=>t.textContent==='KCAL')"));
  await run("document.querySelector('#mode').value='AMBIENT';update();fitText(document.querySelector('#face'))");
  assert.equal(await run("document.querySelectorAll('#face line,#face path').length"),0);
  assert.ok(await run("![...document.querySelectorAll('#face text')].some(t=>t.textContent.startsWith('DAY '))"));
  await run("document.querySelector('#mode').value='ACTIVE';document.querySelector('#minute').value='1439';document.querySelector('#format').value='12';document.querySelector('#low').checked=true;update();fitText(document.querySelector('#face'))");
  assert.equal(await run("document.querySelector('[data-name=hour_active_12]').textContent"),'11');
  assert.equal(await run("document.querySelector('[data-name=minute_active]').textContent"),'59');
  assert.equal(await run("document.querySelector('[data-name=ampm]').textContent"),'PM');
  assert.equal(await run("document.querySelectorAll('#face line').length"),12); // Four corner lines for each dock; fold hidden.
  await run("document.querySelector('#minute').value='0';document.querySelector('#low').checked=false;update();fitText(document.querySelector('#face'))");
  assert.equal(await run("document.querySelector('[data-name=day_percent]').textContent"),'DAY 0%');
  await run("document.querySelector('#face').innerHTML=svg({docks:{101:{type:'SHORT_TEXT',TEXT:'123456789012345678901234567890',TITLE:'A long provider title'},102:{type:'SHORT_TEXT',TEXT:'<unsafe>',TITLE:'Text only'}}});fitText(document.querySelector('#face'))");
  assert.ok(await run("[...document.querySelectorAll('#face text')].every(t=>t.getComputedTextLength()<=Number(t.dataset.maxWidth)+0.5)"));
  assert.ok(await run("document.querySelector('#face').textContent.includes('<unsafe>') && document.querySelector('#face unsafe')===null"));
  const fontBounds=await run(`(()=>{const canvas=document.createElement('canvas'),context=canvas.getContext('2d');context.font='146px Rajdhani';const values=[...Array.from({length:24},(_,i)=>String(i).padStart(2,'0')),...Array.from({length:60},(_,i)=>String(i).padStart(2,'0'))];return Math.max(...values.map(v=>context.measureText(v).width));})()`);
  assert.ok(fontBounds<=156,`Time numerals exceed their box: ${fontBounds}`);
  assert.deepEqual(errors,[]);
  console.log(`PASS: actual browser controls, provider switching, ambient visibility, 12-hour midnight, battery cutoff, long/unsafe text, and all time digit widths (max ${fontBounds.toFixed(2)} / 156).`);
} finally {
  if(socket?.readyState===WebSocket.OPEN){try{await command('Browser.close');}catch{}socket.close();}
  child.kill();
}
