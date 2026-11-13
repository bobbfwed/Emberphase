# Apsis: design

Status: **built and rendered on the Wear OS 6 emulator. Not yet tested on the
physical watch.** See the [device test checklist](device-acceptance.md).

An interactive browser mockup of the original proposal is in
[design/apsis-mockup.html](design/apsis-mockup.html). It is a page fragment:
open it in a browser to scrub the time, switch to always-on, and run Foresight.
It uses sample data and predates the build, so small details differ.

## Concept

Apsis has no hands. All geometry is in the 450-unit layout, centre (225, 225),
and lives in `scripts/lib/apsis-geometry.mjs`.

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
| Core | 0–62 | Weather or digital time, date, battery ring at 60 |
| Ring travel | 63–162 | Minute ring, ticks, minute number, satellite, crescent |
| Corona | 164–197 | Hour ticks and eight forecast bars |
| Rim | 197–221 | Four curved complication slots, numerals 12 / 3 / 6 / 9 in the gaps |

The minute number's inner edge is 95 units from the ring centre, and the ring
centre is 32 from the dial centre, so a dial-centred disc of radius 63 is
always clear. The checks assert this, along with the tangency.

## Intrinsic data

| Element | Behaviour |
| --- | --- |
| Corona | Eight bars at the hour positions for the next eight hours. Bar *i* shows `[WEATHER.HOURS.i.*]` and sits *i* × 30 degrees clockwise of the current hour, inside a group rotated by `[HOUR_0_11] * 30`. Length is temperature scaled between today's low and high. Colour runs cold blue to warm amber. A dot above the bar marks rain, snow, sleet or thunderstorm conditions. Opacity falls with lead time. If an hour is unavailable its bar is omitted and the plain tick remains. |
| Core weather | Current temperature, high and low, condition glyph. Dashes when unavailable. |
| Date | Weekday and day of month at the top of the core. |
| Battery | Ring around the core. Amber at 20% or less, red at 10% or less. |
| Seconds | The moonlet. Editor toggle. Hidden at 15% battery or less, in power saving, during Foresight and in always-on. |

## Complications

Six slots: four customizable and two fixed.

| Slot | Place | Types | Default |
| --- | --- | --- | --- |
| 10 Rim upper right | Arc centred at 45° | GOAL_PROGRESS, RANGED_VALUE, SHORT_TEXT, EMPTY | System sunrise / sunset |
| 20 Rim lower right | Arc centred at 135° | same | Companion activity calories |
| 30 Rim lower left | Arc centred at 225° | same | Samsung Health steps, then system step count |
| 40 Rim upper left | Arc centred at 315° | same | Companion active minutes |
| 50 Foresight trigger | Core, radius 54, not customizable | RANGED_VALUE, EMPTY | Companion `SweepDataSource` |
| 60 Power saving | On the dial, not customizable | RANGED_VALUE, EMPTY | Companion `PowerSaveDataSource` |

Each rim slot spans 58 degrees. From its leading end it draws the provider's
icon, then curved text: the title in capitals and the value. Goal or ranged
data also fills a progress line on the outer edge. Text reads clockwise on the
upper half and counter-clockwise on the lower half so it is always upright,
and progress fills in the reading direction.

The proposal also offered a custom complication in the core. It was dropped:
the core is the Foresight tap target, and two overlapping slots cannot share
one tap.

## Foresight

Tapping the core fast-forwards the dial for six seconds, using the companion's
tap trigger.

* Progress 0–0.75: the contact point advances 240 degrees, through the next
  eight hours. The satellite and minute number fade. The core shows `+N H`,
  the clock hour, that hour's temperature and its condition name. The matching
  corona bar brightens and the others dim.
* Progress 0.8–1: the contact point eases back to the present.

Foresight is disabled at 15% battery or less and in always-on. It requires
watch companion 0.1.9. Without it the face works and the core tap does nothing.
An hour without forecast data reads as a dash.

## Editor settings

| Setting | Options |
| --- | --- |
| Color | Ion (violet and blue crescent, lime satellite), Solar (red and amber, white), Glacier (teal, coral) |
| Core | Weather, Digital time |
| Seconds moonlet | On, off |
| Forecast hour marks | On, off |

## Always-on

Black background. Hairline hour circle and minute ring, five-minute ticks, the
contact mark, the satellite with its minute number, and the date (plus the
time when the core is set to digital time). No crescent fill, corona, rim,
moonlet, weather or battery ring.

## Typeface

Oxanium medium and bold (SIL Open Font License), bundled as font resources.

## Rendering approach

* `watchface.xml` is generated by `scripts/New-WatchFace.mjs`. It contains
  vector `PartDraw` shapes and text only. The single bitmap is the picker
  preview.
* One group rotates by the continuous hour angle and holds the crescent and
  contact mark. The minute ring is a child placed 32 units up, counter-rotated
  so ticks and text stay upright. The satellite rotates inside it by the
  minute, and the minute number counter-rotates again.
* The crescent is a gradient-filled disc with a black disc drawn over it.
* Nothing animates continuously. The dial changes once a minute, and once a
  second while the moonlet is on. A millisecond source is used only during
  Foresight.

## Findings from the emulator

These were found by rendering on the Wear OS 6.0 emulator image and are
encoded in the generator.

* A gradient ignores `colors="[CONFIGURATION.x]"` and falls back to the fill
  colour. Themes therefore use a list setting with one plain-colour copy of
  the crescent and satellite per theme.
* A complication slot clips its content to its bounding shape, and a
  `BoundingArc` band is measured inward from the given diameter.
* Counter-clockwise curved text needs its start angle greater than its end
  angle. With the smaller angle first it takes the long way round.
* A transform on a stroke's colour with `colorRgb` works, as do transforms on
  a line's `endY` and an arc's `startAngle` and `endAngle`.
* `[AMPM_STRING_ENG]` rendered empty inside a ternary. The face derives AM and
  PM from `[AMPM_STATE]`.
* An empty slot draws nothing, not the face's `EMPTY` content.

## Lessons carried over from the earlier face

* Expression strings must use double quotes (`&quot;`). Single quotes pass the
  validator but break rendering on the watch.
* Samsung formats editor labels, so a literal percent sign in a label crashes
  the editor. Spell out "percent".
* A fixed data slot must sit inside the circle or it never activates.
* The companion's `SAFE_WATCH_FACES` metadata lists allowed face package IDs.
* There is no `min` or `max` expression function. Use `clamp` and ternaries.

## Open risks

* **Hourly forecast on the Watch6.** Only current weather has been observed on
  the device. The emulator has no weather source, so the corona, glyphs and
  Foresight readout were rendered there with constant sample values.
* **Samsung's renderer.** The emulator runs Google's runtime. Samsung's may
  differ, in particular for curved text, arc-shaped slots and the editor.
* **Minute legibility.** Reading an angle on an off-centre ring is unfamiliar.
  The minute number is the safeguard and digital time in the core is the
  fallback.
* **Tap trigger with the real companion.** The animation was exercised on the
  emulator with a looping test trigger, not with a real tap.
* **Lit area.** The crescent is the largest lit region. Its brightness may be
  reduced after measuring battery life on the watch.
