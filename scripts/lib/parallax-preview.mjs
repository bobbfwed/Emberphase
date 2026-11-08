import fs from 'node:fs';
import {scene,evaluate,escapeXml,colors} from './parallax-scene.mjs';
export const sampleSources={HOUR_0_23:10,MINUTE:8,MINUTE_Z:'08',DAY_OF_WEEK_S:'SAT',DAY_Z:'07',MONTH_S:'NOV',BATTERY_PERCENT:73,IS_24_HOUR_MODE:true,AMPM_STRING:'AM','CONFIGURATION.fold':true,'CONFIGURATION.signature':true,'CONFIGURATION.time_format':'system','CONFIGURATION.ambient_style':'outline','CONFIGURATION.accent.0':colors.cyan};
const font=fs.readFileSync(new URL('../../watchface/src/main/res/font/rajdhani_light.ttf',import.meta.url)).toString('base64');
const val=(v,s)=>v&&typeof v==='object'?evaluate(v.expression,s):v;
function color(value) {
  if(value?.length===9 && value.startsWith('#'))return {paint:'#'+value.slice(3),opacity:parseInt(value.slice(1,3),16)/255};
  return {paint:value,opacity:1};
}
function style(colorValue,kind='fill') {const c=color(colorValue);return `${kind}="${c.paint}" ${kind}-opacity="${c.opacity}"`;}
function format(node,sources) {
  const values=node.children.filter(c=>c.tag==='Parameter').map(c=>evaluate(c.attrs.expression,sources));let index=0;
  return node.children.filter(c=>typeof c==='string').join('').replace(/%%|%0?(\d+)?(?:\.(\d+))?([sdf])/g,(match,width,precision,type)=>{
    if(match==='%%')return '%';const value=values[index++];
    let result=type==='s'?String(value):type==='f'?Number(value).toFixed(Number(precision??0)):String(Math.trunc(value));
    return width?result.padStart(Number(width),'0'):result;
  });
}
export function render(node,sources,mode='ACTIVE') {
  if(typeof node==='string')return escapeXml(node);
  const a=Object.fromEntries(Object.entries(node.attrs).map(([k,v])=>[k,val(v,sources)]));
  for(const child of node.children)if(child.tag==='Transform')a[child.attrs.target]=evaluate(child.attrs.value,sources);
  for(const child of node.children)if(child.tag==='Variant'&&child.attrs.mode===mode)a[child.attrs.target]=child.attrs.value;
  if(Number(a.alpha??255)===0)return '';
  const children=()=>node.children.map(c=>render(c,sources,mode)).join('');
  switch(node.tag) {
    case 'Condition': {
      const expressions=node.children.find(c=>c.tag==='Expressions');
      const branch=node.children.find(c=>c.tag==='Compare'&&evaluate(expressions.children.find(e=>e.attrs.name===c.attrs.expression).children.join(''),sources))??node.children.find(c=>c.tag==='Default');
      return branch?branch.children.map(c=>render(c,sources,mode)).join(''):'';
    }
    case 'ComplicationSlot': {
      const fixture=sources.docks?.[a.slotId]??{type:'EMPTY'};
      const scoped={...sources,'COMPLICATION.TEXT':'','COMPLICATION.TITLE':'',...Object.fromEntries(Object.entries(fixture).map(([k,v])=>['COMPLICATION.'+k,v]))};
      const branch=node.children.find(c=>c.tag==='Complication'&&c.attrs.type===fixture.type);
      return `<g transform="translate(${a.x} ${a.y})">${branch?branch.children.map(c=>render(c,scoped,mode)).join(''):''}</g>`;
    }
    case 'PartImage': return `<g transform="translate(${a.x} ${a.y})" ${style(colors.ivory)}><circle cx="18" cy="18" r="10" fill="none" stroke="${colors.ivory}" stroke-width="2"/><path d="M8,18h20 M18,8v20" stroke="${colors.ivory}" stroke-width="2"/></g>`;
    case 'Scene':return children();
    case 'Group':case 'PartDraw':return `<g transform="translate(${a.x??0} ${a.y??0})" opacity="${Number(a.alpha??255)/255}">${children()}</g>`;
    case 'Line': {
      const stroke=node.children.find(c=>c.tag==='Stroke');let sc=val(stroke.attrs.color,sources);
      return `<line x1="${a.startX}" y1="${a.startY}" x2="${a.endX}" y2="${a.endY}" ${style(sc,'stroke')} stroke-width="${stroke.attrs.thickness}" stroke-linecap="${(stroke.attrs.cap??'BUTT').toLowerCase()}" />`;
    }
    case 'Rectangle':return `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" ${style(val(node.children.find(c=>c.tag==='Fill').attrs.color,sources))} />`;
    case 'Arc': {
      const point=angle=>[a.centerX+a.width/2*Math.sin(angle*Math.PI/180),a.centerY-a.height/2*Math.cos(angle*Math.PI/180)];
      const start=point(a.startAngle),end=point(a.endAngle),stroke=node.children.find(c=>c.tag==='Stroke');
      return `<path d="M${start.join(',')} A${a.width/2},${a.height/2} 0 ${a.endAngle-a.startAngle>180?1:0} 1 ${end.join(',')}" fill="none" ${style(val(stroke.attrs.color,sources),'stroke')} stroke-width="${stroke.attrs.thickness}" stroke-linecap="round" />`;
    }
    case 'PartText': {
      const t=node.children.find(c=>c.tag==='Text'),f=t.children.find(c=>c.tag==='Font');
      const outline=f.children.find(c=>c.tag==='Outline');
      const contentNode=outline??f;
      const label=contentNode.children.find(c=>c.tag==='Template');const content=label?format(label,sources):contentNode.children.filter(c=>typeof c==='string').join('');
      const anchor=t.attrs.align==='START'?'start':t.attrs.align==='END'?'end':'middle';
      const x=Number(a.x)+(anchor==='start'?0:anchor==='end'?Number(a.width):Number(a.width)/2);
      return `<text data-name="${a.name}" data-max-width="${a.width}" x="${x}" y="${Number(a.y)+Number(a.height)/2}" font-family="${f.attrs.family==='rajdhani_light'?'Rajdhani':'Arial'}" font-size="${f.attrs.size}" font-weight="${f.attrs.weight==='BOLD'?700:400}" dominant-baseline="central" text-anchor="${anchor}" ${style(val(f.attrs.color,sources))} ${outline?`stroke="${outline.attrs.color}" stroke-width="${outline.attrs.width}" paint-order="stroke fill"`:''}>${escapeXml(content)}</text>`;
    }
    default:return '';
  }
}
export function svg(overrides={},mode='ACTIVE') {
  const sources={...sampleSources,...overrides};
  return `<svg xmlns="http://www.w3.org/2000/svg" width="450" height="450" viewBox="0 0 450 450"><style>@font-face{font-family:Rajdhani;src:url(data:font/ttf;base64,${font})}text{font-kerning:none;font-variant-numeric:tabular-nums}</style><defs><clipPath id="screen"><circle cx="225" cy="225" r="225"/></clipPath></defs><rect width="450" height="450" fill="${colors.black}"/><g clip-path="url(#screen)">${render(scene(),sources,mode)}</g></svg>`;
}
