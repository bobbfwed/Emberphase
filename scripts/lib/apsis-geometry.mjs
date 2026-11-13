// Shared geometry for the Apsis face: used by the layout generator, the
// preview renderer and the tests. All values are in the 450-unit layout.
export const SIZE = 450;
export const C = 225;                 // dial centre
export const RF = 162;                // fixed hour circle radius
export const RM = 130;                // travelling minute ring radius
export const D = RF - RM;             // ring centre offset toward the hour
export const TAG_R = 104;             // minute number centre, from ring centre
export const TAG_HALF = 9;            // minute number half height
export const MOON_R = 11;             // seconds moonlet orbit radius
export const BATTERY_R = 60;          // battery ring radius around the core
export const CORE_TAP_R = 54;         // Foresight tap target radius
export const TICK_R0 = 164, TICK_R1 = 168;
export const BAR_R0 = 171, BAR_MIN = 6, BAR_SPAN = 16;
export const FORECAST_HOURS = 8;
export const RIM_MID = 209, RIM_THICKNESS = 24, RIM_HALF = 29;
export const RIM_TEXT_TOP = 201, RIM_TEXT_BOTTOM = 213, RIM_PROGRESS_R = 219.5, RIM_PROGRESS_HALF = 26;
export const NUMERAL_R = 207;
export const FORESIGHT_MS = 6000;

export const RIM_SLOTS = [
  { id: 10, key: 'rim_ne', angle: 45 },
  { id: 20, key: 'rim_se', angle: 135 },
  { id: 30, key: 'rim_sw', angle: 225 },
  { id: 40, key: 'rim_nw', angle: 315 },
];

export const THEMES = [
  { id: '0', key: 'accent_ion', colors: ['#0A22C3FF', '#6B6A4DFF', '#F222C3FF', '#FFD9FF43'] },
  { id: '1', key: 'accent_solar', colors: ['#0AFFB84A', '#6BFF4D2E', '#F2FFB84A', '#FFFFFFFF'] },
  { id: '2', key: 'accent_glacier', colors: ['#0A8CF2FF', '#6B12D6B0', '#F28CF2FF', '#FFFF6B8B'] },
];

// Conditions drawn with a precipitation dot: rain, snow, sleet, thunderstorm.
export const WET = [4, 5, 6, 7, 9, 10, 11, 12];

const rad = a => a * Math.PI / 180;
// Angles are clockwise from 12 o'clock.
export const pt = (r, a, cx = C, cy = C) => [cx + r * Math.sin(rad(a)), cy - r * Math.cos(rad(a))];
export const isTop = a => a < 90 || a > 270;
export const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
// Hours ahead of now during Foresight, for progress 0..1.
export const foresightOffset = p => FORECAST_HOURS * smooth(p / 0.75) * (1 - smooth((p - 0.8) / 0.2));
// Cold to warm bar colour for a 0..1 temperature position.
export function barColor(k) {
  k = Math.max(0, Math.min(1, k));
  return k < 0.5
    ? [86 + 300 * k, 168 + 144 * k, 255]
    : [236 + 38 * (k - 0.5), 240 - 140 * (k - 0.5), 255 - 390 * (k - 0.5)];
}
