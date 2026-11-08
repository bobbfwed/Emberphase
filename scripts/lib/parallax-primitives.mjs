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
  const js=expression.replace(/\[([A-Za-z0-9_.]+)\]/g,(_,key)=>typeof sources[key]==='number'?String(sources[key]):JSON.stringify(sources[key]??0));
  return Function('min','max','floor','round','abs',`"use strict"; return (${js});`)(Math.min,Math.max,Math.floor,Math.round,Math.abs);
}
export function line(name,a,b,color=colors.cyan,thickness=0.8) {
  return element('PartDraw',{name,x:0,y:0,width:450,height:450},
    element('Line',{startX:a[0],startY:a[1],endX:b[0],endY:b[1]},element('Stroke',{color,thickness,cap:'ROUND'})));
}
export function rectangle(name,x,y,width,height,color) {
  return element('PartDraw',{name,x:0,y:0,width:450,height:450},element('Rectangle',{x,y,width,height},element('Fill',{color})));
}
export function conditional(name,expression,yes,no=null) {
  return element('Condition',{},element('Expressions',{},element('Expression',{name},expression)),
    element('Compare',{expression:name},yes),no?element('Default',{},no):null);
}
export function text(name,x,y,width,height,size,template,parameters=[],options={}) {
  const {color=colors.ivory,family=size>=100?'rajdhani_light':'sans-serif',weight='NORMAL',align='CENTER',...other}=options;
  return element('PartText',{name,x,y,width,height},element('Text',{align,ellipsis:'TRUE',maxLines:1,isAutoSize:'TRUE'},
    element('Font',{family,size,weight,color,...other},parameters.length?element('Template',{},template,...parameters.map(expression=>element('Parameter',{expression}))):template)));
}
export const escapeXml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
