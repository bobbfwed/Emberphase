// WFF arithmetic expressions used by the face. Kept separate so the tests can
// evaluate exactly the strings that ship. Plain text here; build-face.mjs
// escapes them for XML. String literals use double quotes (see
// docs/wff-engineering-notes.md).
import * as G from './geometry.mjs';

export const ref = (name) => `[REFERENCE.${name}]`;
const n = (v) => Number(v.toFixed(4)).toString();

// ---- Gates ----
export const MOTION_OK = `[BATTERY_PERCENT] > 20 && ${ref('psave')} < 0.5`;
export const SECONDS_OK = `[BATTERY_PERCENT] > 20 && ${ref('psave')} < 0.5`;
export const SLOSH_ACTIVE = `${ref('tap')} > 0 && ${MOTION_OK}`;

// ---- Fluid level by source (each lives in its own editor branch) ----
export const LEVEL_BATTERY = `clamp([BATTERY_PERCENT] / 100, 0, 1)`;
export const LEVEL_DAY = `clamp(1 - ([HOUR_0_23] * 60 + [MINUTE]) / 1440, 0, 1)`;
export const levelPod = (i) => `clamp(${ref(`p${i}g`)} + ${ref(`p${i}r`)}, 0, 1)`;
export const FEED_REFS = ['lv0', 'lv1', 'lv2', 'lv3', 'lv4', 'lv5'];
export const LEVEL = `clamp(${FEED_REFS.map(ref).join(' + ')}, 0, 1)`;
export const KIND = ['kd0', 'kd1', 'kd2', 'kd3', 'kd4', 'kd5'].map(ref).join(' + ');
export const KIND_LABEL = `${ref('kind')} == 1 ? "BATT" : (${ref('kind')} == 2 ? "DAY" : "GOAL")`;
// Width of the level tag's backing chip: IBM Plex Mono advances 0.6 em, plus
// 0.05 em letter spacing, at size 11; 8 units of padding.
export const LEVEL_CHIP_W = `((${ref('kind')} == 2 ? 3 : 4) + 2 + (round(${ref('lvl')} * 100) >= 100 ? 3 : (round(${ref('lvl')} * 100) >= 10 ? 2 : 1))) * 7.15 + 8`;
export const WARN_FLUID = `${ref('kind')} == 1 && [BATTERY_PERCENT] < 20`;

// ---- Tilt and slosh ----
// Quantized to TILT_STEP degrees so sensor noise does not redraw the face on
// every sample; the carrier's short animation smooths the steps.
export const TILT = `round(clamp(${G.TILT_SIGN} * [ACCELEROMETER_ANGLE_X], ${-G.TILT_LIMIT}, ${G.TILT_LIMIT}) / ${G.TILT_STEP}) * ${G.TILT_STEP}`;
// Milliseconds within the UTC day now, minus the tap stamp (stamp = ms + 1).
const DAY_MS = 86400000;
export const ELAPSED = `((([SECONDS_IN_DAY] * 1000 + [MILLISECOND] - [TIMEZONE_OFFSET_MINUTES_DST] * 60000 - (${ref('tap')} - 1)) % ${DAY_MS}) + ${2 * DAY_MS}) % ${DAY_MS} / 1000`;
const S = G.SLOSH;
export const SLOSH_ANGLE = `(${ELAPSED}) > ${S.seconds} ? 0 : ${S.angle} * exp(${-S.angleDecay} * (${ELAPSED})) * sin(${n(2 * Math.PI * S.angleHz)} * (${ELAPSED}))`;
export const SLOSH_BOB = `(${ELAPSED}) > ${S.seconds} ? 0 : ${S.bob} * exp(${-S.bobDecay} * (${ELAPSED})) * sin(${n(2 * Math.PI * S.bobHz)} * (${ELAPSED}))`;
export const ANGLE = `${ref('tilt')} + ${ref('sloshA')}`;
export const SURFACE_Y = `${G.CORE_BOTTOM} - ${2 * G.CORE} * ${ref('lvl')} + ${ref('sloshB')}`;
// Half chord of the fluid circle at the surface.
export const HALF = `sqrt(clamp(${G.CORE * G.CORE} - pow(${ref('sy')} - ${G.C}, 2), 0, ${G.CORE * G.CORE}))`;
export const SURFACE_VISIBLE = `${ref('lvl')} > 0.005 && ${ref('lvl')} < 0.995`;

// ---- Notification bubbles ----
export const BUBBLES = 6;
export const BUBBLE_BOTTOM = G.CORE_BOTTOM - 24;
// Total notifications from the companion (slot 7). Samsung reports
// UNREAD_NOTIFICATION_COUNT only as 0 or 1, so it is just the fallback when the
// companion has no notification access (its carriers then read 0).
export const NOTIFICATIONS = `(${ref('nsrc')} > 0.5 ? ${ref('ncount')} : [UNREAD_NOTIFICATION_COUNT])`;
export const BUBBLE_COUNT = `clamp(${NOTIFICATIONS}, 0, ${BUBBLES})`;
export const BUBBLE_STEP = `clamp(clamp(${BUBBLE_BOTTOM} - ${ref('sy')} - 10, 8, 300) / (${BUBBLE_COUNT} > 0 ? ${BUBBLE_COUNT} : 1), 4, 13)`;
export const bubbleRadius = (i) => 2.4 + (i % 3) * 0.8;
export const bubbleX = (i) => G.C - 42 + Math.sin(i * 1.7) * 5;
export const bubbleY = (i) => `${BUBBLE_COUNT} > ${i} ? ${BUBBLE_BOTTOM} - ${i} * ${BUBBLE_STEP} - ${n(bubbleRadius(i))} : ${BUBBLE_BOTTOM + 40}`;
// Bubbles need about 50 units of fluid; below that they would crowd the level tag.
export const BUBBLES_VISIBLE = `${ref('sy')} < ${G.CORE_BOTTOM - 50} ? 255 : 0`;
// The count sits left of the bubble column; to its right are the digits.
export const BUBBLE_LABEL_BOX = { x: G.C - 81, w: 28, h: 16 };
// Capped so the box's lower-left corner stays inside the fluid circle.
export const BUBBLE_LABEL_Y = `clamp(${BUBBLE_BOTTOM} - (${BUBBLE_COUNT} - 1) * ${BUBBLE_STEP} - 9, 0, 282)`;
export const BUBBLE_LABEL = `${NOTIFICATIONS} > ${BUBBLES} ? "6+" : round(${NOTIFICATIONS})`;

// ---- Chronocast ring ----
export const sectorStart = (k) => `((([HOUR_0_11] + ${k}) % 12) * 30 + ${G.RING.sectorGap / 2})`;
export const sectorEnd = (k) => `((([HOUR_0_11] + ${k}) % 12) * 30 + ${30 - G.RING.sectorGap / 2})`;
export const CURSOR = `[HOUR_0_11_MINUTE] * 30`;
export function hourSource(k) {
  if (k === 0) return {
    avail: `[WEATHER.IS_AVAILABLE]`, temp: `[WEATHER.TEMPERATURE]`, cond: `[WEATHER.CONDITION]`,
    day: `[WEATHER.IS_DAY]`
  };
  // An hour without forecast reads condition 0 (unknown). Testing that
  // instead of HOURS.n.IS_AVAILABLE keeps the weather subscription small:
  // Samsung's runtime 4.0.00.16 races while registering weather sources.
  const p = `WEATHER.HOURS.${k}`;
  return {
    avail: `([WEATHER.IS_AVAILABLE] && [${p}.CONDITION] > 0)`, temp: `[${p}.TEMPERATURE]`,
    cond: `[${p}.CONDITION]`, day: `[${p}.IS_DAY]`
  };
}
const LO = `[WEATHER.DAY_TEMPERATURE_LOW]`, HI = `[WEATHER.DAY_TEMPERATURE_HIGH]`;
export const terrainDepth = (s) =>
  `(${G.RING.terrainMin} + ${G.RING.terrainMax} * clamp((${s.temp} - ${LO}) / (${HI} - ${LO} > 1 ? ${HI} - ${LO} : 1), 0, 1))`;
const isAny = (c, codes) => '(' + codes.map((v) => `${c} == ${v}`).join(' || ') + ')';
export const isRain = (c) => isAny(c, [4, 6, 10, 12]);
export const isStorm = (c) => `${c} == 9`;
export const isSnow = (c) => isAny(c, [5, 7, 11]);
const rgb = (alpha, [r, g, b]) => `colorArgb(${alpha}, ${r}, ${g}, ${b})`;
export function familyColor(s, alpha) {
  const F = G.FAMILY_RGB, c = s.cond;
  return `(${s.avail} ? (${isRain(c)} ? ${rgb(alpha, F.rain)} : (${isSnow(c)} ? ${rgb(alpha, F.snow)} : ` +
    `(${isStorm(c)} ? ${rgb(alpha, F.storm)} : (${isAny(c, [1, 8])} ? (${s.day} ? ${rgb(alpha, F.clearDay)} : ${rgb(alpha, F.clearNight)}) : ` +
    `(${c} == 14 ? ${rgb(alpha, F.partly)} : (${isAny(c, [2, 3, 13])} ? ${rgb(alpha, F.cloud)} : ` +
    `(${c} == 15 ? ${rgb(alpha, F.wind)} : ${rgb(alpha, F.unknown)}))))))) : colorArgb(0, 0, 0, 0))`;
}
export const bandColor = (s) =>
  `(${s.avail} ? (${s.day} ? ${rgb(140, G.DAY_RGB)} : ${rgb(204, G.NIGHT_RGB)}) : colorArgb(0, 0, 0, 0))`;
export const placeholderColor = (s) => `(${s.avail} ? colorArgb(0, 0, 0, 0) : colorArgb(255, 26, 35, 44))`;
export const rainColor = (s) => `(${s.avail} && (${isRain(s.cond)} || ${isStorm(s.cond)}) ? ${rgb(230, G.FAMILY_RGB.rain)} : colorArgb(0, 0, 0, 0))`;
export const snowColor = (s) => `(${s.avail} && ${isSnow(s.cond)} ? ${rgb(240, G.FAMILY_RGB.snow)} : colorArgb(0, 0, 0, 0))`;
export const labelX = (k, w) => `${G.C} + ${G.RING.labelRadius} * sin(rad(${sectorStart(k)} + ${15 - G.RING.sectorGap / 2})) - ${w / 2}`;
export const labelY = (k, h) => `${G.C} - ${G.RING.labelRadius} * cos(rad(${sectorStart(k)} + ${15 - G.RING.sectorGap / 2})) - ${h / 2}`;

// ---- Pods ----
export const goalFraction = `[COMPLICATION.GOAL_PROGRESS_TARGET_VALUE] > 0 ? clamp([COMPLICATION.GOAL_PROGRESS_VALUE] / [COMPLICATION.GOAL_PROGRESS_TARGET_VALUE], 0, 1) : 0`;
export const goalDone = `[COMPLICATION.GOAL_PROGRESS_TARGET_VALUE] > 0 && [COMPLICATION.GOAL_PROGRESS_VALUE] >= [COMPLICATION.GOAL_PROGRESS_TARGET_VALUE] ? 1 : 0`;
export const rangeFraction = `[COMPLICATION.RANGED_VALUE_MAX] > [COMPLICATION.RANGED_VALUE_MIN] ? clamp(([COMPLICATION.RANGED_VALUE_VALUE] - [COMPLICATION.RANGED_VALUE_MIN]) / ([COMPLICATION.RANGED_VALUE_MAX] - [COMPLICATION.RANGED_VALUE_MIN]), 0, 1) : 0`;
// Samsung Health Steps option: a zero-based range whose maximum is the goal.
export const rangeIsGoal = `[COMPLICATION.RANGED_VALUE_MIN] == 0 && [COMPLICATION.RANGED_VALUE_MAX] > 0 ? 1 : 0`;
export const rangeDone = `[COMPLICATION.RANGED_VALUE_MIN] == 0 && [COMPLICATION.RANGED_VALUE_MAX] > 0 && [COMPLICATION.RANGED_VALUE_VALUE] >= [COMPLICATION.RANGED_VALUE_MAX] ? 1 : 0`;
// Only pod 0 (steps) can treat a ranged maximum as a goal, so only it has d0r.
export const podDoneRefs = (i) => (i === 0 ? ['d0g', 'd0r'] : [`d${i}g`]);
export const podDone = (i) => `${podDoneRefs(i).map(ref).join(' + ')} > 0 ? 255 : 0`;
export const textOr = (number) => `textLength([COMPLICATION.TEXT]) > 0 ? [COMPLICATION.TEXT] : numberFormat("#,##0", ${number})`;
