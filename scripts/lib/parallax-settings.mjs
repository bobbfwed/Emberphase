import {element,dynamic,colors,conditional,text,group,activeOnly} from './parallax-primitives.mjs';
export const use24="[CONFIGURATION.time_format] == '24' || ([CONFIGURATION.time_format] == 'system' && [IS_24_HOUR_MODE])";
export const foldVisible="[CONFIGURATION.fold] == 'TRUE' && [BATTERY_PERCENT] > 20 && [BATTERY_PERCENT] <= 100";
export function settings() {
  return element('UserConfigurations',{},
    element('ColorConfiguration',{id:'accent',displayName:'accent',defaultValue:'cyan'},
      ...[['cyan',colors.cyan],['white',colors.ivory],['violet','#C1AEFF']].map(([id,color])=>element('ColorOption',{id,displayName:`accent_${id}`,colors:color}))),
    element('BooleanConfiguration',{id:'fold',displayName:'fold_setting',defaultValue:'TRUE'}),
    element('BooleanConfiguration',{id:'signature',displayName:'signature_setting',defaultValue:'TRUE'}),
    element('ListConfiguration',{id:'ambient_style',displayName:'ambient_style',defaultValue:'outline'},
      ...['outline','solid'].map(id=>element('ListOption',{id,displayName:`ambient_${id}`}))),
    element('ListConfiguration',{id:'time_format',displayName:'time_format',defaultValue:'system'},
      ...['system','12','24'].map(id=>element('ListOption',{id,displayName:`time_${id}`}))));
}
function outlined(node) {
  const t=node.children.find(c=>c.tag==='Text'),f=t.children.find(c=>c.tag==='Font');
  f.attrs.color=colors.black;
  f.children=[element('Outline',{color:colors.ivory,width:1},...f.children)];
  return node;
}
function hour(name,outline) {
  const make=(id,format,param)=>{
    const value=text(id,98,67,156,126,146,format,[param]);
    return outline?outlined(value):value;
  };
  return conditional(name,use24,make(name+'_24','%02d','[HOUR_0_23]'),make(name+'_12','%d','([HOUR_0_23] + 11) % 12 + 1'));
}
export function timeDisplay() {
  const active=group('time_active',activeOnly(),hour('hour_active',false),text('minute_active',246,181,156,126,146,'%s',['[MINUTE_Z]']));
  const ambient=group('time_ambient',element('Variant',{mode:'AMBIENT',target:'alpha',value:255}),
    conditional('ambient_outline',"[CONFIGURATION.ambient_style] == 'outline'",group('outlined_time',hour('hour_ambient',true),outlined(text('minute_ambient',246,181,156,126,146,'%s',['[MINUTE_Z]']))),
      group('solid_time',hour('hour_ambient_solid',false),text('minute_ambient_solid',246,181,156,126,146,'%s',['[MINUTE_Z]']))));
  ambient.attrs.alpha=0;
  return [active,ambient,conditional('ampm_visible',`!(${use24})`,group('ampm_label',
    element('PartDraw',{x:278,y:163,width:74,height:20},element('Rectangle',{x:0,y:0,width:74,height:20},element('Fill',{color:colors.black}))),
    text('ampm',280,163,70,20,12,'%s',['[AMPM_STRING]'],{color:colors.secondary})))];
}
export function applyAccent(foldNode) {
  for(const part of foldNode.children) {
    if(part.tag!=='PartDraw')continue;
    const stroke=part.children[0].children.find(c=>c.tag==='Stroke');
    if(stroke.attrs.color.length===9)part.attrs.alpha=parseInt(stroke.attrs.color.slice(1,3),16);
    stroke.attrs.color='[CONFIGURATION.accent.0]';
  }
  return conditional('show_fold',foldVisible,foldNode);
}
