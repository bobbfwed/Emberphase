import fs from 'node:fs';

export function loadSweepModel(file) {
  const xml=fs.readFileSync(file,'utf8');
  const decode=s=>s.replace(/&quot;/g,'"').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&');
  const expression=name=> {
    const part=xml.match(new RegExp('<(?:Group|PartImage|PartText) name="'+name+'"[\\s\\S]*?<(?:Transform|Parameter) [^>]*(?:value|expression)="([^"]+)"'));
    if(!part) throw new Error('Missing sweep expression: '+name);
    return decode(part[1]);
  };
  const expressions={};
  for(const name of ['progress','home','turn','settle']) expressions[name]=expression('sweep_'+name+'_source');
  for(const name of ['hour','minute','second']) expressions[name]=expression('sweep_'+name+'_hand');
  expressions.moon=expression('moon_disc_rotation');
  expressions.balance=expression('balance_oscillator');
  expressions.balanceSweep=expression('balance_sweep');
  expressions.battery=expression('battery_slider');
  for(const kind of ['weekday','month','date']) for(const suffix of ['_prev','','_next']) expressions[kind+suffix]=expression('drum_'+kind+suffix);
  for(const metric of ['steps','minutes','calories']) {
    const band=xml.match(new RegExp('<PartDraw name="'+metric+'_progress_band"[\\s\\S]*?</PartDraw>'))[0];
    expressions[metric]=decode(band.match(/target="endAngle" value="([^"]+)"/)[1]);
  }
  const defaults=Object.fromEntries([...xml.matchAll(/<Reference name="([^"]+)" source="[^"]+" defaultValue="([^"]+)"/g)].map(m=>['REFERENCE.'+m[1],Number(m[2])]));
  const duration=expressions.progress.match(/\/\s*(\d+(?:\.\d+)?)\s*,\s*0\s*,\s*1\s*\)\s*$/);
  if(!duration) throw new Error('Sweep duration missing from progress expression');
  return {expressions,defaults,durationMs:Number(duration[1])};
}

// Shared by the expression tests and the standalone browser preview. All
// expressions come from the checked-in WFF; no separate animation equations.
export function evaluateWff(expression,data) {
  const js=expression.replace(/\[([\w.]+)\]/g,(_,key)=>'data['+JSON.stringify(key)+']');
  return new Function('data','clamp','floor','sin','subText','numberFormat','return ('+js+');')(
    data,(n,a,b)=>Math.min(b,Math.max(a,n)),Math.floor,Math.sin,(s,a,b)=>s.substring(a,b),
    (pattern,n)=>pattern==='00'?Math.round(n).toString().padStart(2,'0'):Math.round(n).toLocaleString('en-US'));
}

export function sweepFrame(model,elapsed,fixture,idle=false) {
  const data={...model.defaults,...fixture,'REFERENCE.sweep_start':43200001,UTC_TIMESTAMP:43200000+elapsed};
  if(!idle) for(const name of ['progress','home','turn','settle']) data['REFERENCE.sweep_'+name]=evaluateWff(model.expressions[name],data);
  const result={data};
  for(const [key,expr] of Object.entries(model.expressions)) result[key]=evaluateWff(expr,data);
  result.moon+=360*data['REFERENCE.sweep_turn'];
  result.balance+=result.balanceSweep;
  return result;
}
