import {element,group,text,line,conditional,dynamic,colors,activeOnly} from './parallax-primitives.mjs';
export const progressExpressions={
  GOAL_PROGRESS: {
    valid:'[COMPLICATION.GOAL_PROGRESS_TARGET_VALUE] > 0 && ([COMPLICATION.GOAL_PROGRESS_TARGET_VALUE] - [COMPLICATION.GOAL_PROGRESS_TARGET_VALUE]) == 0 && [COMPLICATION.GOAL_PROGRESS_VALUE] >= 0 && ([COMPLICATION.GOAL_PROGRESS_VALUE] - [COMPLICATION.GOAL_PROGRESS_VALUE]) == 0',
    fraction:'min(1, max(0, [COMPLICATION.GOAL_PROGRESS_VALUE] / [COMPLICATION.GOAL_PROGRESS_TARGET_VALUE]))',
    value:'[COMPLICATION.GOAL_PROGRESS_VALUE]',fallback:'GOAL'
  },
  RANGED_VALUE: {
    valid:'[COMPLICATION.RANGED_VALUE_MAX] > [COMPLICATION.RANGED_VALUE_MIN] && ([COMPLICATION.RANGED_VALUE_MAX] - [COMPLICATION.RANGED_VALUE_MAX]) == 0 && ([COMPLICATION.RANGED_VALUE_MIN] - [COMPLICATION.RANGED_VALUE_MIN]) == 0 && ([COMPLICATION.RANGED_VALUE_VALUE] - [COMPLICATION.RANGED_VALUE_VALUE]) == 0',
    fraction:'min(1, max(0, ([COMPLICATION.RANGED_VALUE_VALUE] - [COMPLICATION.RANGED_VALUE_MIN]) / ([COMPLICATION.RANGED_VALUE_MAX] - [COMPLICATION.RANGED_VALUE_MIN])))',
    value:'[COMPLICATION.RANGED_VALUE_VALUE]',fallback:'RANGE'
  }
};
export function complicationDock({id,name,x,y}) {
  const companion='com.bobbfwed.emberphase.health/com.bobbfwed.emberphase.health.watch.';
  const policy=id===101?{primaryProvider:'com.samsung.android.wear.shealth/com.samsung.android.wear.shealth.complications.steps.StepsComplicationProviderService',primaryProviderType:'GOAL_PROGRESS',defaultSystemProvider:'STEP_COUNT',defaultSystemProviderType:'RANGED_VALUE'}:
    {primaryProvider:companion+(id===102?'MinutesDataSource':'CaloriesDataSource'),primaryProviderType:'GOAL_PROGRESS',defaultSystemProvider:'EMPTY',defaultSystemProviderType:'EMPTY'};
  // Labels always follow provider payloads. Older unlabelled providers use GOAL/RANGE.
  const renderings=['SHORT_TEXT','GOAL_PROGRESS','RANGED_VALUE'].map(type=>{
    const progress=progressExpressions[type];
    const value=conditional(`has_text_${id}_${type}`,"[COMPLICATION.TEXT] != ''",
      text(`value_${id}_${type}`,10,29,84,30,25,'%s',['[COMPLICATION.TEXT]']),
      progress?conditional(`finite_${id}_${type}`,`(${progress.value} - ${progress.value}) == 0`,
        text(`number_${id}_${type}`,10,29,84,30,25,'%.0f',[progress.value]),text(`invalid_${id}_${type}`,10,29,84,30,25,'—')):text(`missing_${id}`,10,29,84,30,25,'—'));
    const label=text(`label_${id}_${type}`,10,58,84,15,11,'%s',[progress?`[COMPLICATION.TITLE] != '' ? [COMPLICATION.TITLE] : '${progress.fallback}'`:'[COMPLICATION.TITLE]'],{color:colors.secondary});
    const bar=progress?conditional(`valid_${id}_${type}`,progress.valid,group(`range_${id}_${type}`,
      line(`track_${id}_${type}`,[15,78],[83,78],colors.structure,2.5),
      conditional(`positive_${id}_${type}`,`${progress.fraction} > 0`,line(`progress_${id}_${type}`,[15,78],[dynamic(`15 + 68 * (${progress.fraction})`,15),78],colors.lime,2.5)))):null;
    return element('Complication',{type},value,label,bar);
  });
  return element('ComplicationSlot',{name,slotId:id,displayName:name,x:x-52,y:y-52,width:104,height:104,isCustomizable:'TRUE',supportedTypes:'SHORT_TEXT RANGED_VALUE GOAL_PROGRESS MONOCHROMATIC_IMAGE EMPTY'},
    activeOnly(),element('BoundingOval',{x:0,y:0,width:104,height:104}),element('DefaultProviderPolicy',policy),...renderings,
    element('Complication',{type:'MONOCHROMATIC_IMAGE'},element('PartImage',{name:`icon_${id}`,x:34,y:31,width:36,height:36,tintColor:colors.ivory},element('Image',{resource:'[COMPLICATION.MONOCHROMATIC_IMAGE]'}))),
    element('Complication',{type:'EMPTY'},text(`empty_${id}`,10,31,84,28,24,'—',[],{color:colors.secondary})));
}
