# Apsis: design and build plan

Status: **design proposed, build not started.** The build begins only after the
design is approved. "Apsis" is a working name.

An interactive browser mockup is in
[design/apsis-mockup.html](design/apsis-mockup.html). It is a page fragment:
open it in a browser to scrub the time, switch to always-on, and run Foresight.
It uses sample weather and activity data.

## Concept

Apsis has no hands. All geometry is in the 450-unit layout, centre (225, 225).

* A **fixed hour circle** of radius 162 is drawn around the dial centre.
* A **minute ring** of radius 130 sits inside it, off-centre by 32 units toward
  the current hour. The two circles are internally tangent, so they touch at
  exactly one point. That contact point is the hour. It travels around the
  fixed circle once every 12 hours and carries a white contact mark.
* The gap between the circles is a glowing crescent. It is thickest (64 units)
  directly opposite the hour and vanishes at the contact point.
* A **satellite** bead rides the minute ring once per hour, measured from the
  ring's own centre. It drags a 70-degree fading trail and carries the minute
  as a two-digit number just inside the ring. The ring's 60 ticks travel with
  it and stay upright.
* A **moonlet** dot orbits the satellite at radius 11 once per minute for
  seconds.

An apsis is the extreme point of an orbit, which is where the minute ring
meets the hour circle. The ring swings around the fixed core through the day,
so the composition differs at every hour.

## Fixed regions

These follow from the geometry and never collide with the moving parts.

| Region | Radius from dial centre | Content |
| --- | --- | --- |
| Core | 0–64 | Weather or digital time or a complication, date, battery ring at 60 |
| Ring travel | 64–162 | Minute ring, ticks, minute number, satellite, crescent |
| Corona | 164–194 | Hour ticks and eight forecast bars |
| Rim | 198–221 | Four curved complication slots, numerals 12 / 3 / 6 / 9 in the gaps |

The minute number's inner edge is 96 units from the ring centre, and the ring
centre is at most 32 from the dial centre, so a dial-centred disc of radius 64
is always clear.

## Intrinsic data

| Element | Behaviour |
| --- | --- |
| Corona | Eight bars at the hour positions for the next eight hours. Bar *i* shows `[WEATHER.HOURS.i.*]` and sits *i* × 30 degrees clockwise of the current hour, inside a group rotated by `[HOUR_0_11] * 30`. Length is temperature scaled between today's low and high. Colour runs cold blue to warm amber. A dot above the bar marks rain, snow, sleet or thunderstorm conditions. Opacity falls with lead time. If an hour is unavailable its bar is omitted and the plain tick remains. |
| Core weather | Current temperature, high and low, condition glyph. Dashes when unavailable, as before. |
| Date | Weekday and day of month at the top of the core. |
| Battery | Ring around the core. Amber at 20% or less, red at 10% or less. |
| Seconds | The moonlet. Editor toggle. Hidden at 15% battery or less, in power saving, and in always-on. |

## Complications

Seven slots: five customizable and two fixed. The application ID is new, so the old slot order does not need to
be preserved.

| Slot | Place | Types | Default |
| --- | --- | --- | --- |
| Core | Centre, radius 54 | SHORT_TEXT, RANGED_VALUE, GOAL_PROGRESS, MONOCHROMATIC_IMAGE, SMALL_IMAGE, EMPTY | Empty. Used when the **Core** setting is *Custom complication* |
| Rim upper right | Arc centred at 45° | GOAL_PROGRESS, RANGED_VALUE, SHORT_TEXT, EMPTY | System sunrise / sunset |
| Rim lower right | Arc centred at 135° | same | Companion activity calories |
| Rim lower left | Arc centred at 225° | same | Samsung Health steps, then system step count |
| Rim upper left | Arc centred at 315° | same | Companion active minutes |
| Foresight trigger | Core, fixed, not customizable | RANGED_VALUE, EMPTY | Companion `SweepDataSource` |
| Power saving | On the dial, fixed, not customizable | RANGED_VALUE, EMPTY | Companion `PowerSaveDataSource` |

Each rim slot spans 60 degrees with a `BoundingArc`. It draws curved text
(label and value) and, for goal or ranged data, a progress line on the outer
edge. Text-only data shows no line. Empty shows a dash. The face displays
provider values and never computes activity totals.

## Foresight

Tapping the core fast-forwards the dial for six seconds, using the companion's
existing tap trigger and its timestamp-to-progress expression.

* Progress 0–0.75: the contact point advances 240 degrees, through the next
  eight hours. The satellite and minute number fade out. The core shows
  `+N H`, that hour's temperature and its condition. The matching corona bar
  brightens and the others dim.
* Progress 0.8–1: the contact point eases back to the present.

Foresight is disabled at 15% battery or less and in always-on. It requires the
watch companion. Without it the face works and the core tap does nothing.
With no hourly forecast it shows the current conditions only.

## Editor settings

| Setting | Options |
| --- | --- |
| Colour | Ion (violet and blue crescent, lime satellite), Solar (red and amber, white), Glacier (teal, coral) |
| Core | Weather, Digital time, Custom complication |
| Seconds moonlet | On, off |
| Forecast corona | On, off |
| Samsung Health steps target | On, off (carried over; applies to the steps slot's ranged data) |

## Always-on

Black background. Hairline hour circle and minute ring, five-minute ticks, the
contact mark, the satellite with its minute number, and the date. No crescent
fill, corona, rim, moonlet, weather or battery ring.

## Typeface

Oxanium (SIL Open Font License), bundled in the APK as a font resource, for
all dial text.

## Rendering approach

* Vector `PartDraw` shapes and text only, apart from the picker preview and
  weather glyphs. No large dial bitmap.
* One group rotates by the continuous hour angle and holds the crescent and
  contact mark. The minute ring is a child placed 32 units up, counter-rotated
  so ticks and text stay upright. The satellite rotates inside it.
* The crescent is a gradient-filled disc with a black disc drawn over it.
* Nothing animates continuously. The dial changes once a minute, and once a
  second while the moonlet is on. A millisecond source is used only during
  Foresight.

## Known constraints and lessons carried over

* Expression strings must use double quotes (`&quot;`). Single quotes pass the
  validator but break rendering on the watch.
* Samsung formats editor labels, so a literal percent sign in a label crashes
  the editor. Spell out "percent".
* A fixed data slot must sit inside the circle or it never activates.
* The companion's `SAFE_WATCH_FACES` metadata lists allowed face package IDs.
  The new ID must be added there.
* Hourly forecast is documented for up to eight hours and must be checked with
  `IS_AVAILABLE`. What index 0 means is not documented, so the corona starts
  at index 1.
* There is no `min` or `max` expression function. Use `clamp` and ternaries.
* Stroke colour is transformable in WFF 4. Fill and font colour transforms are
  unconfirmed, so temperature colour is applied to strokes.

## Build plan

1. **Scaffold.** Face name, application ID `com.bobbfwed.emberphase.apsis`,
   version reset, Oxanium font resource, strings, manifest icon, build script
   and Gradle updates. Add the new ID to the watch companion's
   `SAFE_WATCH_FACES`.
2. **Time core.** Hour circle, crescent, minute ring and ticks, contact mark,
   satellite, trail, minute number, moonlet. Validate, build, install on the
   watch, and confirm legibility before continuing.
3. **Intrinsic data.** Core weather and date, battery ring, corona and its
   fallback ticks.
4. **Complications.** Four rim slots and the core slot with goal, range, text
   and empty handling. Fixed power-saving slot.
5. **Foresight.** Trigger slot, progress references, fast-forward, hourly
   readout.
6. **Always-on, themes and power rules.**
7. **Checks and documents.** Node tests for expressions and geometry (ring
   tangency, clear-core radius, disjoint slot bounds, hour rollover in the
   corona, Foresight endpoints), WFF validator and memory check, picker
   preview, README and data docs, and a device test list for the Watch6
   Classic.

A commit follows each step.

## Open risks

* **Hourly forecast on the Watch6.** Only current weather has been observed on
  the device. Step 3 checks this first.
* **Minute legibility.** Reading an angle on an off-centre ring is unfamiliar.
  The minute number is the safeguard and digital time in the core is the
  fallback. Step 2 ends with an on-wrist check for this reason.
* **Curved slots in the Samsung editor.** `BoundingArc` targets and curved
  text need checking in the on-watch editor. The fallback is rounded boxes.
* **Lit area.** The crescent is the largest lit region. Its brightness may be
  reduced after measuring on the watch.
