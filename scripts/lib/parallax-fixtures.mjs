export const healthDocks={
  101:{type:'GOAL_PROGRESS',TEXT:'6,240',TITLE:'STEPS',GOAL_PROGRESS_VALUE:6240,GOAL_PROGRESS_TARGET_VALUE:8000},
  102:{type:'GOAL_PROGRESS',TEXT:'36',TITLE:'MIN',GOAL_PROGRESS_VALUE:36,GOAL_PROGRESS_TARGET_VALUE:60},
  103:{type:'GOAL_PROGRESS',TEXT:'410',TITLE:'KCAL',GOAL_PROGRESS_VALUE:410,GOAL_PROGRESS_TARGET_VALUE:500}
};
export const alternateDocks={101:{type:'SHORT_TEXT',TEXT:'18°',TITLE:'WEATHER'},102:{type:'SHORT_TEXT',TEXT:'14:30',TITLE:'NEXT'},103:{type:'SHORT_TEXT',TEXT:'68',TITLE:'BPM'}};
export const previewCases=[
  {name:'active',label:'Active · sample health data',sources:{docks:healthDocks}},
  {name:'ambient',label:'Always on · outline',mode:'AMBIENT'},
  {name:'ambient-stress',label:'Always on · stress glyphs',mode:'AMBIENT',sources:{HOUR_0_23:88,MINUTE_Z:'88'}},
  {name:'ambient-solid-stress',label:'Always on · thin solid stress',mode:'AMBIENT',sources:{HOUR_0_23:88,MINUTE_Z:'88','CONFIGURATION.ambient_style':'solid'}},
  {name:'empty',label:'Unavailable / no providers',sources:{docks:{}}},
  {name:'alternate',label:'Your data · sample providers',sources:{docks:alternateDocks}},
  {name:'low-battery',label:'18% battery · fold rests',sources:{BATTERY_PERCENT:18,docks:healthDocks}},
  {name:'twelve-hour',label:'12 hour · 11:59 PM',sources:{HOUR_0_23:23,MINUTE:59,MINUTE_Z:'59',AMPM_STRING:'PM','CONFIGURATION.time_format':'12',docks:healthDocks}},
  {name:'midnight',label:'Local midnight · no prior-day totals',sources:{HOUR_0_23:0,MINUTE:0,MINUTE_Z:'00',DAY_OF_WEEK_S:'SUN',DAY_Z:'08',docks:{}}},
  {name:'over-goal',label:'Over goal · full bar, actual total',sources:{docks:{...healthDocks,101:{...healthDocks[101],TEXT:'12,000',GOAL_PROGRESS_VALUE:12000}}}},
  {name:'violet',label:'Violet accent',sources:{'CONFIGURATION.accent.0':'#C1AEFF',docks:healthDocks}},
  {name:'small',label:'360 px display simulation',size:360,sources:{docks:healthDocks}}
];
