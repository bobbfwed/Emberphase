# Meniscus: design and build plan

Status: **proposal, awaiting approval.** Nothing below is built yet. The
interactive concept mockup is `docs/design/meniscus-concept.html` (open it in
a browser).

## Concept

Meniscus is an instrument face built around a sealed glass core that holds
luminous fluid. Gravity acts on the fluid: the waterline stays level as the
wrist rolls. The time sits inside the core, and the waterline cuts through
the digits. Above the line they glow on dark glass. Below it they turn dark
against the lit fluid, shifted slightly as if bent by refraction, the way a
straw looks broken in a glass of water.

Around the core, the rim of the dial shows the future. Each clock hour
position carries the weather forecast for that hour, so the hour cursor walks
into the next twelve hours of temperature, conditions, daylight and darkness.

Everything else follows the same physical logic: unread notifications are
bubbles in the fluid, data pods dock to the core through conduits that light
up when a goal is met, and a tap on the core makes the fluid slosh.

### What is new here

1. **Gravity-true fluid core.** The waterline follows the watch's
   accelerometer, so the fluid stays level as the wrist rolls.
2. **Waterline numerals.** The time digits invert at the waterline and break
   with a small refraction offset below it.
3. **Chronocast ring.** The next 12 hours of forecast are drawn at the clock
   positions where those hours will occur, with a day/night horizon band
   showing sunset and sunrise at their actual hours.
4. **Notification bubbles.** Unread notifications rise as bubbles in the fluid.
5. **Slosh.** Tapping the core sets off a damped wave in the fluid.
6. **Charged conduits.** A pod's conduit to the core lights up when its goal
   is reached.

## Layout (450-unit canvas, center 225,225)

| Element | Geometry |
| --- | --- |
| Chronocast ring | Annulus r 188–222. Day/night band r 216–220; forecast terrain from r 190, 4–24 units deep; hour cursor r 180–224 |
| Data pods (4) | Centers at r 154, at 60°, 120°, 240°, 300° (2, 4, 8, 10 o'clock). Diameter 60. Progress arc 300°, its gap facing the core |
| Conduits | Short bridges from each pod's gap to the core rim, r 116–124 |
| Date | Top zone, y 52–104: weekday (small caps), day and month (large) |
| Weather line | Bottom zone, y ≈ 352: condition glyph, current temperature, high and low |
| Event bar | Bottom zone, y ≈ 372–396, width ≈ 170: long-text complication |
| Core glass | r 116, metallic rim r 113–116, 60 micro ticks r 110–113 |
| Fluid | Masked to r 110 |
| Numerals | Hours row y 140–216, minutes row y 236–312, glyph 44 × 76, gap 12 |
| Seconds spark | Rides the glass rim at r 116 with a 24° fading tail |

## Elements

### Fluid core

* **Level.** Linear height inside r 110, from the editor's *Core fluid* source:
  Battery (default), Day remaining (`1 − SECONDS_IN_DAY / 86400`), or the
  progress of a chosen pod (shared by WFF 4 `Reference`, so no extra
  complication subscription).
* **Tilt.** Group angle `clamp(±[ACCELEROMETER_ANGLE_X], -40, 40)`, sign to be
  calibrated on the watch. A short `Transform` animation smooths sensor jitter.
  Holding the watch face-up or tilted toward you gives a level surface; only
  rolling the wrist turns it.
* **Surface.** A bright meniscus line across the chord, with small upward curls
  where it meets the glass. A level tag (for example `68%` with a source glyph)
  rides the surface near the right wall.
* **Body.** Vertical gradient from the theme's bright tone at the surface to its
  deep tone at the bottom, with a static low-contrast caustic texture. A
  battery level under 20 percent turns the fluid ember-red, whatever the theme.
* **Glass.** Dark interior, metallic rim, and a specular arc whose position
  shifts slightly with `Gyro`, giving the glass depth.

### Waterline numerals

* Custom monoline numerals designed for this face: stroke 7, 14-unit corner
  radii, square ends, an angled 4 and a spurred 7. One set of white glyphs is
  tinted per use, plus an outline set for always-on. 12-hour time drops the
  leading zero; 24-hour time keeps it.
* Lit digits are drawn first. The fluid group covers them, and inside it the
  same digits are drawn dark with `blendMode="SRC_ATOP"`, so they appear only
  over fluid. The submerged copy is offset by (+2.5, +1.5) and scaled 1.03:
  the refraction break.

Small text on the face (date, pod values, weather line, labels) uses IBM Plex
Mono, bundled under the SIL Open Font License.

### Chronocast ring

* Twelve 30° sectors aligned to clock hours, separated by 1.2° gaps that double
  as hour indices. The current hour's sector uses current weather; the next
  eleven use `WEATHER.HOURS.1` to `WEATHER.HOURS.11`.
* **Terrain depth** maps temperature onto today's low–high range. **Colour**
  follows the condition: sunny in warm white, a clear night in pale moonlight
  blue, cloud, fog and mist in
  slate, rain and sleet in cyan with short streaks, snow in ice white with
  dots, thunderstorms in violet, wind in teal.
* **Day/night band** from `HOURS.n.IS_DAY`: gold by day, indigo by night.
* Temperature labels at +3, +6 and +9 hours. A small violet mark where UV ≥ 6.
* **Hour cursor:** a bright bar with an inward chevron at
  `HOUR_0_11_MINUTE × 30°`. The elapsed part of the current hour's sector is
  dimmed, so the ring reads as "from now onward".
* Hours without forecast data show a dotted placeholder. With no weather at
  all, the ring becomes plain hour sectors and the cursor still tells time.

### Data pods and conduits

* Accept `GOAL_PROGRESS`, `RANGED_VALUE`, `SHORT_TEXT`, `SMALL_IMAGE`,
  `MONOCHROMATIC_IMAGE` and `EMPTY`. Value, label and icon sit inside; the arc
  shows progress. Text-only data leaves the arc empty.
* Defaults: 10 o'clock Steps (Samsung Health steps provider, falling back to
  system steps), 2 o'clock Active minutes and 4 o'clock Active calories (both
  from the Emberphase Health companion), 8 o'clock Heart rate.
* A conduit lights up when its pod reaches 100 percent of a real goal.
  Ranged values without an explicit goal never light it, except behind the
  existing Samsung Steps target option.

### Intrinsic data

Time, seconds, date, current weather with high and low, the 12-hour forecast,
day/night, UV, battery (as the default core fluid) and unread notification
count. None of these needs a complication.

### Notification bubbles

`UNREAD_NOTIFICATION_COUNT` is drawn as up to six bubbles near the bottom of the
fluid, with a small count beside the top bubble (`6+` above six). When the
count changes, the bubbles rise into place with one short animation. Zero
shows no bubbles.

### Slosh

Tapping the core starts a damped wave lasting about 3 seconds: the surface
angle swings by up to 24° at about 1.1 Hz and the level bobs a few units.
It reuses the watch companion's tap provider (now the *Core tap*), which
records a timestamp and publishes a short timeline that returns to idle on its
own. The millisecond clock is used only during the wave. Without the
companion, tapping does nothing.

### Themes

An editor colour setting chooses the fluid: **Plasma** (cyan to ultramarine,
default), **Ion** (violet to magenta), **Ember** (amber to red, after the
project's name) and **Chlorophyll** (lime to teal). The ring's weather
colours stay the same in every theme so they keep their meaning.

## States and power

| State | Behaviour |
| --- | --- |
| Active | Everything shown. Accelerometer tilt, Gyro parallax and seconds on (each can be turned off in the editor) |
| Power saving, or battery ≤ 20 percent | Accelerometer, Gyro, seconds and slosh off; the surface is level relative to the watch |
| Battery ≤ 15 percent | As above, plus the seconds spark is hidden whatever the setting |
| Always-on | Black. Core outline, outline numerals, a horizontal waterline hairline at the core level, digits below it at lower brightness, 12 ring dots with the hour cursor, small date. No fluid fill, pods, weather or sensors |

The face stays resource-only: no code, network or polling. Sensors are used
only while the face is awake and motion is allowed.

## Editor settings and slots

Settings: Core fluid (Battery · Day remaining · a pod's progress), Fluid colour,
Gravity tilt (on/off), Depth parallax (on/off), Seconds spark (on/off),
Samsung Health steps target (on/off).

Slots, in fixed declaration order: 0 pod 10 o'clock, 1 pod 2 o'clock, 2 pod
4 o'clock, 3 pod 8 o'clock, 4 event bar, 5 core tap (fixed companion
provider), 6 power saving (fixed companion provider). Once this ships, new
slots may only be appended.

## Identity

* Face name **Meniscus**, application ID `com.bobbfwed.emberphase.meniscus`, so
  it installs alongside the existing mechanical face.
* The companion's providers add this ID to `SAFE_WATCH_FACES`. The sweep
  provider is renamed **Emberphase · Core tap** and its window shortened to
  about 3.5 seconds.

## Build plan

Each phase ends with WFF schema validation, the SDK-native build, the memory
check, the Node tests that exist by then, and a commit.

1. **Foundation.** New ID, name, strings and editor settings. A single
   `scripts/meniscus/geometry.json` holds glyph paths and layout constants for
   the asset generator, the browser preview and the tests. A PowerShell
   rasterizer produces the numeral PNGs (solid and outline sets).
2. **Core spike, checked on the watch first.** Glass, masked fluid, battery
   level, waterline numerals with `SRC_ATOP` and the refraction offset, and
   accelerometer tilt. This is the riskiest part (masking, blend modes,
   sensor rate and smoothing on Samsung firmware), so it gets a device
   install before anything else is built on it.
3. **Chronocast ring.** Sectors, terrain, day/night band, labels, UV marks,
   cursor, and the no-data fallbacks. Check how many forecast hours the
   firmware actually provides.
4. **Pods, conduits, date, weather line and event bar,** including all
   complication types, the unavailable states, and the editor selection
   bounds.
5. **Bubbles, seconds spark and Gyro parallax.**
6. **Slosh.** Rename and retime the companion tap provider, add the
   `SAFE_WATCH_FACES` entries, bump the companion versions, then add the wave
   expressions to the face.
7. **Always-on, low-battery and power-saving states, and themes.**
8. **Checks and docs.** Node tests for level and tilt geometry, forecast sector
   mapping across midnight and 12/24 hours, gating thresholds, slot order and
   disjoint bounds, and the double-quote and no-percent label rules. Picker
   preview rendered from the browser preview with headless Edge. README,
   device acceptance checklist, final watch run.

## Risks to check on the watch

* Masking plus blend modes inside a rotating group, and their frame cost.
* How often the accelerometer updates, how much it jitters, and the battery
  cost of using it. If it is too costly, gravity tilt becomes opt-in.
* How many `WEATHER.HOURS` entries Samsung's firmware supplies.
* Whether Samsung's always-on display offload accepts the outline numerals.
* Numeral legibility exactly at the waterline, at low fluid levels and in
  bright sunlight.
