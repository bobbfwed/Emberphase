# Watch6 device acceptance

Status: **0.4.9 installed on the SM-R950**, with the health companion installed
on the watch and paired Galaxy S24 Ultra. On 2026-11-02, consented Samsung Health
SDK reads and Data Layer delivery succeeded. After the developer selected the
two Emberphase providers, live active-minute/calorie totals, their numeric goals
and both metal progress tracks rendered on the face. The runtime confirms
GOAL_PROGRESS from MinutesDataSource and CaloriesDataSource. Initial SDK reads
previously returned AuthorizationException until the developer completed
Samsung's SDK read-testing setup and accepted the permission screen.

The wider moon aperture was inspected on the physical watch. Always-on rendering
also showed the orange hands/calendar/battery and white hour markers, with
activity tracks hidden. Initial sync and live rendering are verified; changed
goals, a full scheduled refresh interval, midnight rollover, permission revocation
and longer battery measurements still need physical tests.

Version 0.4.8 adds the selected hidden balance rim. Physical screenshots show
both alternating sides through the two small windows beside the spindle, with
live weather and all three activity totals/targets retained. A six-second
device recording was captured locally. Sleep/wake screenshots confirm the
mechanism disappears in always-on and returns on waking. The runtime accepts
the new default-on editor setting. The low-battery cutoff and disabled setting
have automated expression/structure checks; they still need physical testing.
The 180 ms transition is configured in WFF, not measured from the recording.

Version 0.4.9 enlarges both balance windows by 50% in width and height and
lengthens the native transition to 220 ms. Installation/version and the larger
openings were checked on the physical watch; weather and all activity displays
remain visible. The previous sleep/wake test is from 0.4.8.

Initial **0.4.2 installation** on
2026-11-01: ADB activation succeeded and an awake screenshot confirmed the
analog hands, moon disc, correct SUN / NOV / 01 drums, battery slider, live
steps, and native current temperature / daily high / weather icon. Weather
initially showed the unavailable state, then populated without changing the
selected mode. The step source resolved to Samsung Health's steps service and
returned `RANGED_VALUE`; its explicit goal remains unknown.

The 0.4.1 screenshot confirms the activity symbols and target/dash labels follow
their concentric track radii. The weather inset sits 18 units higher, separating
its high-temperature line from the hour 8. The minute editor selection point
moves to (110,350) at the left side of the smaller cyan runner. Ambient graphics
are unchanged from 0.4.0; the ambient observations below are from that version.

Version 0.4.2 shortens the seconds tick to 130 ms at strength 0.5. Installation
and the reported package version were verified; the motion measurements below
are from the previous 180 ms setting.

Follow-up on 2026-11-02: **0.4.4 installed and rendering**, with a 6,000-step
target visible alongside live steps. Samsung Health's Steps screen shows the
same goal. The Samsung Steps compatibility option handles the retained ranged
payload; native WFF step sources returned zero in a temporary test and are not
used. Goal-change synchronization remains untested. Active minutes, calories,
and their targets remain unavailable through the installed providers; see
`device-providers.md` for the runtime findings.

Version 0.4.5 replaces the moon-age source with a date-based approximation,
updates its position twice per UTC day, corrects waxing/waning direction, and
calibrates the quarter positions to the artwork's window. Awake rendering was
checked on the watch; the exact midnight/noon transitions remain covered by
expression tests rather than an overnight device observation. The display is
an approximate mechanical phase indication, not a precise lunar ephemeris.

Version 0.4.6 uses separate compact selector boxes around Steps, MIN, and CAL.
The watch runtime reports non-overlapping bounds for these and the weather/custom
inset. Steps and its 6,000 target still render, with the progress track outside
the selector box through WFF references. Use the value fields in the editor;
the earlier runner/track selection coordinates below describe older versions.

The 0.4.6 companion defaults request Emberphase Health's active-minute and
active-calorie GOAL_PROGRESS providers. Existing instances retain their empty
selections until the developer selects the two providers once. The compact
selection boxes enabled independent MIN/CAL selection on the physical watch. See
[companion setup](health-companion.md). The earlier provider-availability results
below describe Samsung's installed providers, not the new companion services.

The 0.2.0 awake screenshot also confirms the activity channels are concentric
with the hand spindle, with metallic orange progress and a sharp cut edge over
the exposed toothed track. Cyan/green filled bands are shown in the illustrative
previews; their providers remain unset on the watch. Schema, memory, Gradle
resource-only, lint, and expression/geometry checks pass for this revision.

The awake layout has clear inner-radius 3/9 numerals, an inset battery assembly,
and a lowered calendar with foreshortened neighbors behind its rim. Both modes
now read weekday / month / date. The initial 80 ms tick was too subtle on the
wrist; 0.4.0 uses 180 ms and strength 0.5. A recording captured about 1.4–1.5
degrees of overshoot and return, roughly 25% of a six-degree step. These are
pixel-derived observations, not precision timing.

Ambient rendering was captured while the watch reported `Dozing`, with Samsung
display offload active. The new mockup's orange hands/calendar/battery and white
hour markers render on black; seconds and the normal mode's other displays are
absent. Low-battery behavior and longer-term ambient transitions still need
physical testing.

See [installed provider findings](device-providers.md). Goal-change synchronization,
comparison against the source apps, extended ambient transitions, and battery-life
measurements remain pending. Live MIN/CAL rendering and independent provider
selection are verified as described at the top of this file. Successful activation
does not by itself confirm the face appears in every picker view.

1. Confirm `SM-R950`, API 36, and the installed One UI/Samsung Health/Weather
   versions. Run `Inspect-WatchProviders.ps1` with the explicit watch serial.
2. Install the debug APK and select Emberphase. Check clipping and legibility at
   normal viewing distance. The 450-unit canvas should scale automatically.
3. Select each activity source using the anchors in the README. Record the
   provider label, component (when exposed), supported/returned type, units,
   current value, and any explicit goal in the table below.
4. Compare to Samsung Health **daily activity**, not an exercise session or
   total calories including resting energy. Check steps, active minutes, and
   activity kcal. Note watch-only versus phone-merged totals and sync delay.
5. Change each Samsung Health goal. A `GOAL_PROGRESS` target should follow. If a
   provider returns only text or a range, confirm the face leaves its goal `—`;
   do not claim automatic Samsung-goal synchronization.
6. Test zero progress, a reached/exceeded goal, missing provider permission,
   no provider/empty data, and a provider refresh after midnight. No stale
   fixture values should appear. Check all recessed fills are visible.
7. In native weather mode, compare current temperature, daily high, condition
   icon, day/night, and unit to the system weather source. Test location/weather
   unavailable and stale refreshes. `!` must only indicate the documented
   available-plus-error condition. In custom mode, verify the provider's own
   fields render without parsing or claiming nonexistent weather fields.
8. Test month-end/leap-day and time-zone/date changes. The wheel is a decorative
   twin-moon mechanism uses an approximate mean lunar cycle from UTC date fields,
   with two updates per day. Compare waxing/waning and new/full/quarter positions
   against known phase dates; see `moon-phase.md`. Do not adjust the date of a watch collecting live
   health data solely to test rollover; use a test device or controlled preview.
9. Check the default mechanical seconds and editor toggle, then test at 15% and below: seconds must disappear,
   with no flashing effects. Yellow lamp activates at 20%, red at 10%.
10. Check always-on: orange hands, weekday/month/date, battery and low-battery
    lamps; white hour markers and 12/3/6/9; black background. No weather,
    activity tracks, moon, neighboring drum labels, or seconds. Check
    ambient transitions, burn-in shifting, lock/unlock, wake, and relaunch.
11. Measure a representative full-day battery run against a stock face with
    equal AOD, brightness, connectivity, and activity settings. Turn off wireless
    debugging during battery comparisons. No measured-life claim is made yet.

| Metric | Provider / component | Returned type | Units | Value matches | Goal matches / follows changes |
| --- | --- | --- | --- | --- | --- |
| Steps | Samsung Health `StepsComplicationProviderService`, selected through system STEP_COUNT | RANGED_VALUE observed | Steps | Live text and gauge rendered | Range maximum matched the Steps app goal; goal-change test pending |
| Active minutes | Emberphase Health `MinutesDataSource`, backed by consented phone SDK reads | GOAL_PROGRESS observed | Whole minutes | Live number and metal track rendered; source-app comparison pending | SDK LAST target rendered; goal-change test pending |
| Activity calories | Emberphase Health `CaloriesDataSource`, backed by consented phone SDK reads | GOAL_PROGRESS observed | Active kcal | Live number and metal track rendered; source-app comparison pending | SDK LAST target rendered; goal-change test pending |
| Current temp / high / condition | Native WFF weather | Current / daily high / condition observed | Fahrenheit on this watch | Rendered after initial unavailable state; source-app comparison pending | N/A |

If there is no individual provider with the required numeric values and goals,
stop at this supported boundary. Do not replace it with estimates or hidden
Samsung APIs. See `data-sources.md` for the separate bridge/provider option.
