// Single source of truth for Meniscus geometry, glyphs and palette.
// Used by build-assets.mjs (bitmaps), build-face.mjs (watchface.xml) and the
// tests. All coordinates are in the 450-unit WFF canvas, angles in degrees
// clockwise from 12 o'clock.

export const CANVAS = 450;
export const C = 225;          // dial center
export const CORE = 110;       // fluid radius (mask)
export const RIM = 116;        // glass rim outer radius
export const CORE_TOP = C - CORE;
export const CORE_BOTTOM = C + CORE;

// Monoline numerals: stroke centerlines in a 44 x 76 box, stroke 7, square caps.
export const GLYPH = {
  '0': 'M14,0 H30 A14,14 0 0 1 44,14 V62 A14,14 0 0 1 30,76 H14 A14,14 0 0 1 0,62 V14 A14,14 0 0 1 14,0 Z',
  '1': 'M8,14 L24,0 V76',
  '2': 'M0,14 A14,14 0 0 1 14,0 H30 A14,14 0 0 1 44,14 V24 A14,14 0 0 1 30,38 H14 A14,14 0 0 0 0,52 V76 H44',
  '3': 'M0,0 H44 L20,32 H30 A14,14 0 0 1 44,46 V62 A14,14 0 0 1 30,76 H14 A14,14 0 0 1 0,62',
  '4': 'M32,76 V0 L0,50 H44',
  '5': 'M44,0 H2 V34 H30 A14,14 0 0 1 44,48 V62 A14,14 0 0 1 30,76 H0',
  '6': 'M36,0 H14 A14,14 0 0 0 0,14 V62 A14,14 0 0 0 14,76 H30 A14,14 0 0 0 44,62 V50 A14,14 0 0 0 30,36 H0',
  '7': 'M0,0 H44 V8 L18,76 M14,40 H36',
  '8': 'M14,0 H30 A12,12 0 0 1 42,12 V24 A12,12 0 0 1 30,36 H14 A12,12 0 0 1 2,24 V12 A12,12 0 0 1 14,0 Z M14,36 H30 A14,14 0 0 1 44,50 V62 A14,14 0 0 1 30,76 H14 A14,14 0 0 1 0,62 V50 A14,14 0 0 1 14,36 Z',
  '9': 'M8,76 H30 A14,14 0 0 0 44,62 V14 A14,14 0 0 0 30,0 H14 A14,14 0 0 0 0,14 V26 A14,14 0 0 0 14,40 H44'
};
export const GLYPH_STROKE = 7;
export const GLYPH_OUTLINE_INNER = 4.4;   // always-on outline: stroke 7 minus inner 4.4
// Each bitmap cell includes the 12-unit inter-digit gap (6 each side), so a
// centered PartText needs no letter spacing.
export const GLYPH_CELL = { w: 56, h: 86, ox: 6, oy: 5 };
export const RASTER_SCALE = 1.5;          // pixels per canvas unit in bitmaps
export const HOURS_TOP = 140;             // top of the glyph box (not the cell)
export const MINUTES_TOP = 236;
export const REFRACTION = { dx: 3, dy: 2, scale: 1.03 };

// Surface: linear level inside the fluid circle.
export const surfaceY = (level) => CORE_BOTTOM - level * 2 * CORE;
export const TILT_LIMIT = 40;
// ACCELEROMETER_ANGLE_X is positive when 3 o'clock rolls down (verified on the
// Wear OS 6 emulator); the surface then rises toward 3 o'clock (negative angle).
export const TILT_SIGN = -1;
export const TILT_STEP = 2;
export const SLOSH = { seconds: 3.2, angle: 24, angleDecay: 1.25, angleHz: 1.1, bob: 4, bobDecay: 1.6, bobHz: 2.2 };

// Data pods at 10, 2, 4 and 8 o'clock (slot order 0..3).
export const POD = { r: 154, radius: 32, arcRadius: 27, arcSweep: 300, angles: [300, 60, 120, 240] };
export const podCenter = (i) => polar(POD.r, POD.angles[i]);

// Chronocast ring.
export const RING = {
  inner: 188, outer: 222,
  terrainBase: 190, terrainMin: 4, terrainMax: 20,
  bandRadius: 218, bandThickness: 4,
  textureRadius: 196,
  labelRadius: 204, labelHours: [3, 6, 9],
  uvRadius: 185,
  sectorGap: 1.2,
  cursorInner: 180, cursorOuter: 224
};

export const DATE = { weekdayY: 50, weekdaySize: 13, dateY: 68, dateSize: 26 };
export const WEATHER_LINE = { y: 344, h: 22 };
export const EVENT_BAR = { x: 145, y: 370, w: 160, h: 24 };

export const INK = '#04090D';             // submerged digits
export const LIT = '#E6FBFF';             // digits above the surface
export const THEMES = [
  { id: 'plasma', name: 'Plasma', colors: ['#62F5E4', '#2BA8F0', '#1238B8'] },
  { id: 'ion', name: 'Ion', colors: ['#E0A6FF', '#A94DF5', '#5A10B8'] },
  { id: 'ember', name: 'Ember', colors: ['#FFD07A', '#FF8A2E', '#C9300F'] },
  { id: 'chlorophyll', name: 'Chlorophyll', colors: ['#D6FF6E', '#6EE07A', '#08876A'] }
];
export const WARN = ['#FFA27A', '#FF5233', '#8E140A'];
export const FLUID_STOPS = [0, 0.35, 1];
export const FLUID_GRADIENT_DEPTH = 200;

// WFF weather condition enum -> family.
export const COND_FAMILY = {
  1: 'clear', 8: 'clear', 14: 'partly', 2: 'cloud', 3: 'fog', 13: 'fog',
  4: 'rain', 6: 'rain', 10: 'rain', 12: 'rain', 5: 'snow', 7: 'snow', 11: 'snow',
  9: 'storm', 15: 'wind'
};
// ARGB components for ring colors; alpha applied separately.
export const FAMILY_RGB = {
  clearDay: [243, 217, 160], clearNight: [175, 192, 238], partly: [200, 211, 224],
  cloud: [126, 140, 163], fog: [126, 140, 163], rain: [69, 200, 255], snow: [230, 243, 255],
  storm: [177, 132, 255], wind: [79, 209, 181], unknown: [70, 82, 94]
};
export const DAY_RGB = [233, 196, 106];
export const NIGHT_RGB = [51, 70, 160];

// Weather glyphs, 24 x 24 box, white strokes (tinted on the face).
export const WEATHER_ICONS = {
  wx_sun: '<circle cx="12" cy="12" r="4.4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  wx_moon: '<path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.5a7 7 0 0 1-5-13.5z"/>',
  wx_partly_day: '<circle cx="9" cy="8.5" r="3.4"/><path d="M9 2v1.6M2.5 8.5h1.6M4.4 3.9l1.1 1.1M13.6 3.9l-1.1 1.1"/><path d="M7 20h11a3.6 3.6 0 0 0 -.6-7.2a5 5 0 0 0 -9.5 1.2a3 3 0 0 0 -.9 6z"/>',
  wx_partly_night: '<path d="M12 2.8a5.5 5.5 0 1 0 3.6 8.4a4.4 4.4 0 0 1 -3.6-8.4z"/><path d="M7 20.5h11a3.6 3.6 0 0 0 -.6-7.2a5 5 0 0 0 -9.5 1.2a3 3 0 0 0 -.9 6z"/>',
  wx_cloud: '<path d="M6 18.5h12.5a4 4 0 0 0 -.7-8a5.8 5.8 0 0 0 -11 1.4a3.3 3.3 0 0 0 -.8 6.6z"/>',
  wx_fog: '<path d="M6 12.5h12.5a3.6 3.6 0 0 0 -.6-7a5.2 5.2 0 0 0 -10 1.3a2.9 2.9 0 0 0 -1.9 5.7z"/><path d="M4 16h16M6 19.5h12"/>',
  wx_rain: '<path d="M6 14h12.5a3.8 3.8 0 0 0 -.7-7.5a5.5 5.5 0 0 0 -10.5 1.3a3.1 3.1 0 0 0 -1.3 6.2z"/><path d="M8 17l-1.2 3.5M12.5 17l-1.2 3.5M17 17l-1.2 3.5"/>',
  wx_storm: '<path d="M6 13.5h12.5a3.8 3.8 0 0 0 -.7-7.5a5.5 5.5 0 0 0 -10.5 1.3a3.1 3.1 0 0 0 -1.3 6.2z"/><path d="M13 14.5l-3 4.5h4l-2.5 4"/>',
  wx_snow: '<path d="M6 13.5h12.5a3.8 3.8 0 0 0 -.7-7.5a5.5 5.5 0 0 0 -10.5 1.3a3.1 3.1 0 0 0 -1.3 6.2z"/><circle cx="8" cy="18" r="1"/><circle cx="12.5" cy="20.5" r="1"/><circle cx="17" cy="18" r="1"/>',
  wx_wind: '<path d="M3 9h11a3 3 0 1 0 -3-3M3 13.5h15a3 3 0 1 1 -3 3M3 18h7"/>',
  wx_unknown: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="2.5 2.6"/><path d="M12 15.5v.3"/>'
};
export const ICON_SIZE = 24;              // canvas units on the face
export const ICON_SCALE = 2;              // pixels per unit in bitmaps

export function polar(r, deg, cx = C, cy = C) {
  const a = deg * Math.PI / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

// Fixed IDs shared with the companion apps.
export const FACE_ID = 'com.bobbfwed.emberphase.meniscus';
export const COMPANION = 'com.bobbfwed.emberphase.health';
export const PROVIDERS = {
  coreTap: `${COMPANION}/${COMPANION}.watch.CoreTapDataSource`,
  powerSave: `${COMPANION}/${COMPANION}.watch.PowerSaveDataSource`,
  minutes: `${COMPANION}/${COMPANION}.watch.MinutesDataSource`,
  calories: `${COMPANION}/${COMPANION}.watch.CaloriesDataSource`,
  samsungSteps: 'com.samsung.android.wear.shealth/com.samsung.android.wear.shealth.complications.steps.StepsComplicationProviderService'
};
