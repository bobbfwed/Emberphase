// One scene description generates native WFF and the review renderer.
export const colors = {black:'#000000', ivory:'#EDF2EA', cyan:'#77F4E6', lime:'#C9F279', secondary:'#A0AAA6', structure:'#34433F'};
export const docks = [{id:101,name:'dock_a',x:119,y:342},{id:102,name:'dock_b',x:225,y:359},{id:103,name:'dock_c',x:331,y:342}];
export const dayProgress = '(([HOUR_0_23] * 60 + [MINUTE]) / 1440)';
export const dynamic = (expression, base=0) => ({expression,base});
export const element = (tag, attrs={}, ...children) => ({tag,attrs,children:children.flat().filter(c=>c!==null && c!==undefined)});
export const group = (name, ...children) => element('Group',{name,x:0,y:0,width:450,height:450},...children);
export const transform = (target,value) => element('Transform',{target,value});
export const activeOnly = () => element('Variant',{mode:'AMBIENT',target:'alpha',value:0});
// Expressions are build-time authored WFF, never provider-controlled source code.
export function evaluate(expression,sources={}) {
  const js=expression.replace(/\[([A-Z0-9_.]+)\]/g,(_,key)=>JSON.stringify(sources[key]??0));
  return Function('min','max','floor','round','abs',`"use strict"; return (${js});`)(Math.min,Math.max,Math.floor,Math.round,Math.abs);
}
export function line(name,a,b,color=colors.cyan,thickness=0.8) {
  return element('PartDraw',{name,x:0,y:0,width:450,height:450},
    element('Line',{startX:a[0],startY:a[1],endX:b[0],endY:b[1]},element('Stroke',{color,thickness,cap:'ROUND'})));
}
export function rectangle(name,x,y,width,height,color) {
  return element('PartDraw',{name,x:0,y:0,width:450,height:450},element('Rectangle',{x,y,width,height},element('Fill',{color})));
}
export function text(name,x,y,width,height,size,template,parameters=[],options={}) {
  const {color=colors.ivory,family=size>=100?'rajdhani_light':'sans-serif',weight='NORMAL',align='CENTER',...other}=options;
  return element('PartText',{name,x,y,width,height},element('Text',{align,ellipsis:'TRUE',maxLines:1,isAutoSize:'TRUE'},
    element('Font',{family,size,weight,color,...other},parameters.length?element('Template',{},template,...parameters.map(expression=>element('Parameter',{expression}))):template)));
}
export function fold() {
  const p=dayProgress;
  const creaseA=[dynamic(`174 + 92 * ${p}`,213),dynamic(`245 - 66 * ${p}`,217)];
  const creaseB=[dynamic(`188 + 92 * ${p}`,227),dynamic(`207 - 66 * ${p}`,179)];
  const mix=(a,b,t)=>a.map((x,i)=>dynamic(`(${typeof x==='object'?x.expression:x}) * ${1-t} + (${typeof b[i]==='object'?b[i].expression:b[i]}) * ${t}`));
  const children=[];
  for(let i=0;i<=10;i++) {
    const t=i/10;
    children.push(line(`fold_past_${i}`,mix([52,283],[99,206],t),mix(creaseA,creaseB,t),i===0||i===10?'#5577F4E6':'#3577F4E6'));
    children.push(line(`fold_future_${i}`,mix(creaseA,creaseB,t),mix([359,171],[377,92],t),i===0||i===10?'#9977F4E6':'#5577F4E6'));
  }
  children.push(line('fold_left_edge',[52,283],[99,206],'#8877F4E6'));
  children.push(line('fold_right_edge',[359,171],[377,92],'#BB77F4E6'));
  children.push(line('fold_now',creaseA,creaseB,colors.cyan,2.4));
  return group('day_fold',activeOnly(),...children);
}
export function dockFrame({id,x,y}) {
  return group(`frame_${id}`,activeOnly(),
    line(`dock_${id}_upper`,[x-44,y-27],[x+44,y-27],colors.structure),
    line(`dock_${id}_left`,[x-44,y-27],[x-53,y+21],colors.structure),
    line(`dock_${id}_right`,[x+44,y-27],[x+35,y+21],colors.structure),
    line(`dock_${id}_lower`,[x-53,y+21],[x-31,y+21],colors.structure));
}
export function scene() {
  const battery=[];
  for(let i=0;i<8;i++) {
    const arc=element('Arc',{centerX:225,centerY:225,width:406,height:406,startAngle:247+i*8,endAngle:252+i*8},
      element('Stroke',{thickness:2.8,cap:'ROUND',color:dynamic(`[BATTERY_PERCENT] >= ${(i+1)*12.5} ? '${colors.cyan}' : '${colors.structure}'`,colors.structure)}));
    battery.push(element('PartDraw',{name:`battery_segment_${i}`,x:0,y:0,width:450,height:450},arc));
  }
  return element('Scene',{backgroundColor:colors.black},
    fold(),
    rectangle('hour_clearance',98,73,145,114,colors.black),
    rectangle('minute_clearance',246,188,140,109,colors.black),
    text('date',108,37,234,26,17,'%s %s %s',['[DAY_OF_WEEK_S]','[DAY_Z]','[MONTH_S]']),
    text('hour',98,67,145,126,146,'%02d',['[HOUR_0_23]']),
    text('minute',246,181,140,126,146,'%s',['[MINUTE_Z]']),
    group('battery_rail',activeOnly(),...battery),
    text('battery',24,187,60,25,19,'%d%%',['[BATTERY_PERCENT]']),
    group('day_caption',activeOnly(),text('day_percent',150,288,150,26,16,'DAY %d%%',[`floor(100 * ${dayProgress})`],{color:colors.lime})),
    ...docks.map(dockFrame),
    group('signature',activeOnly(),text('brand',140,400,170,23,12,'P A R A L L A X',[],{color:colors.secondary})));
}
export const escapeXml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function xml(node,depth=0) {
  if(typeof node==='string') return escapeXml(node);
  const indent='  '.repeat(depth), transforms=[];
  const attributes=Object.entries(node.attrs).map(([key,value])=>{
    if(value && typeof value==='object') {transforms.push(transform(key,value.expression));value=value.base;}
    return ` ${key}="${escapeXml(value)}"`;
  }).join('');
  const children=[...node.children,...transforms];
  if(!children.length) return `${indent}<${node.tag}${attributes} />`;
  return `${indent}<${node.tag}${attributes}>\n${children.map(c=>typeof c==='string'?indent+'  '+escapeXml(c):xml(c,depth+1)).join('\n')}\n${indent}</${node.tag}>`;
}
export function watchFace() {
  return '<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated by scripts/Generate-Parallax.mjs; edit scripts/lib/parallax-scene.mjs. -->\n'+
    xml(element('WatchFace',{width:450,height:450,clipShape:'CIRCLE'},element('Metadata',{key:'CLOCK_TYPE',value:'DIGITAL'}),scene()))+'\n';
}
