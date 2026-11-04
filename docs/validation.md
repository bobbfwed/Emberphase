# Validation record

2026-11-01. Windows, Android SDK 36 / build-tools 36.0.0, Android Studio JDK 25,
Gradle 9.3.1, AGP 9.1.1. Version 0.4.1 was installed and rendered on the
physical SM-R950. Awake rendering, live step text/gauge, and native weather
current temperature / high / condition were observed. Goal synchronization,
source-app comparisons, extended ambient behavior, and battery-life checks are
pending. Ambient rendering and Samsung display offload were observed on-device.

| Check | Result |
| --- | --- |
| Google WFF validator 1.7.0, format 4 | Passed |
| SDK-native resource compilation/linking/alignment | Passed |
| APK signature verification | Passed; SDK-native and Gradle use the same Android debug certificate |
| Packaged WFF versus source | Exact SHA-256 match in both APKs |
| Executable DEX entries | None in either APK |
| Gradle resource-only assertion and Android lint | Passed; lint has 0 errors and 5 warnings |
| Calendar / data / bounds contracts | Passed, including 2,192 dates |
| Google WFF memory evaluator | Passed 10 MiB active / 4 MiB ambient budgets |
| Maximum active decoded-resource estimate | 4,356,632 bytes (4.15 MiB) |
| Maximum ambient decoded-resource estimate | 1,645,872 bytes (1.57 MiB) |
| Physical watch install / activation / awake rendering | Passed with 0.4.1; activity symbols/targets follow the tracks and weather clears the 8 |
| Mechanical tick motion | Native 130 ms Tick, strength 0.5; the earlier 180 ms setting had about 1.4–1.5 degrees of overshoot and return observed |
| Ambient rendering | Orange hands, selected calendar and battery; white hour markers on black; captured while Dozing with display offload active |
| Samsung steps payload | Live RANGED_VALUE observed from Samsung Health steps service; explicit goal not established |
| Native weather availability | Unavailable state followed by current temperature, daily high, and condition icon |
| Other activity payloads / source-app comparisons / extended ambient transitions / battery life | Pending |
| Watch identity and installed provider declarations | Verified; see `device-providers.md` |

The five lint warnings are the available newer Gradle version and four sets of
intentional shared weather icon artwork (clear/sunny, light/heavy rain,
light/heavy snow, fog/mist/wind). The WFF resource names are resolved at runtime;
the ordinary unused-resource false positive is scoped in `watchface/lint.xml`.
R8 strips unused AGP-generated resource classes, with resource shrinking off.
No Kotlin or other runtime libraries are dependencies of the face.

The Node checks evaluate the expressions extracted from `watchface.xml`,
including calendar rollovers/leap years (2000 and 2100), invalid targets/ranges,
values beyond a goal, battery slider endpoints, seconds cutoff, complete gauge
unclipped scene geometry, disjoint editor bounds, reference defaults, resource
presence, and the polling policy.
They do not emulate the Wear OS renderer or prove a provider's units/semantics.

The physical-device run caught two issues that schema validation did not:
Samsung formats editor labels even when Android's `formatted="false"` is set,
so a literal percent in a label caused `FormatFlagsConversionMismatchException`.
The label now spells out "percent". WFF expressions also require double-quoted
string literals; the original single quotes produced shifted calendar text and
a malformed DecimalFormat pattern that stopped rendering. All expression
strings now use `&quot;`, including grouped numeric patterns. See the official
[expression string and formatting rules](https://developer.android.com/reference/wear-os/wff/common/attributes/arithmetic-expression).
Regression guards cover both failures, since the JavaScript expression test
alone accepts single quotes that the WFF runtime does not.

Previews are illustrative artwork composites. The moon uses a mean-cycle date
calculation and a stylized mechanical aperture; see `moon-phase.md`. Decoded-resource estimates are not
measurements of RAM resident on Samsung firmware or of battery consumption.
Use `device-acceptance.md` for the remaining physical-device checks.

The 0.2.0 activity redesign replaces the offset elliptical gauges with circular
arcs centered at (225,225), using radii 150, 168, and 186. Recessed bevels and
subtle radial rack teeth are baked into the dial. Opaque native radial-gradient
strokes conceal the teeth behind filled progress; butt caps and a narrow moving
cut-edge highlight keep the leading edge sharp. Geometry checks cover circular
centers/radii, full progress clip bounds, monotonic gradient stops, and edge
alignment with both goal and ranged progress. No animation, sensor subscription,
or additional complication subscription was added. The host preview also fixes
PowerShell's integer-overload rounding of fractional progress, so its fixture
bands now show their actual partial fills.

The 0.3.0 layout moves 3/9 to radius 174 and shifts the battery assembly eight
units inward to leave the 3 clear. The calendar rim moves down 18 units; the
adjacent live text is compressed vertically to 58% and partly hidden by a
cropped 200-by-68 foreground bezel with shadows. This is a static visual
projection of a drum, with calendar fields still updating only as needed.

Seconds use native [`Tick`](https://developer.android.com/reference/wear-os/wff/clock/tick),
enabled by default. The original 80 ms / strength 0.2 setting produced only
about 0.28 degrees of settling and was not noticeable on the wrist. Version
0.4.0 uses 180 ms / strength 0.5. A 4.78-second recording captured several ticks
with about 1.4–1.5 degrees of overshoot and return. Sparse recorded frames do
not establish an exact frame count for every tick. No continuous sweep or
millisecond expression was introduced; battery impact still needs measurement.

The always-on scene follows `Always On Original Mockup.png`, with dedicated
orange skeleton hand assets, a black-centered orange hub, selected calendar
fields, and an orange battery gauge with threshold lamps. White hour markers
and 12/3/6/9 sit on black. Both calendars use weekday/month/date order and share
the same date expressions. Seconds, neighboring drum entries, moon, weather,
and activity graphics are absent in ambient. The physical watch reported
Dozing and active display offload when its ambient screenshot was captured.
The preview renderer uses typographic text bounds to avoid losing the final
letter when Windows substitutes a wider font for unavailable Arial Narrow.

Version 0.4.1 places the left activity symbols on their respective 150/168/186
unit radii beyond the track ends. The runner and flame are reduced to keep the
symbols separate. Right-side target labels are centered on those same radii;
geometry checks allow less than one unit of rounding error. The minute slot's
distinct editor selection point follows the runner to (110,350). Both weather
and the alternative custom inset move up 18 units, leaving a clear gap above
the hour 8. A physical-watch screenshot confirms the new layout with live steps,
weather, and unavailable-goal dashes. Ambient artwork is unchanged; its recorded
device verification remains from 0.4.0. Decoded-resource estimates are unchanged.

Version 0.4.2 shortens the native seconds tick from 180 ms to 130 ms, retaining
strength 0.5. The faster setting was built, schema/memory checked, and installed
on the SM-R950. The earlier motion recording describes the 180 ms setting;
the 130 ms setting has not been measured from a new recording.

On 2026-11-02, 0.4.3 was built, validated, and installed to request Samsung
Health Steps as `GOAL_PROGRESS`, falling back to system `STEP_COUNT` as
`RANGED_VALUE`. The native runtime accepted the new default policy. Its retained
selection still returned range data; actual goal-progress delivery is pending
editor reselection. The other activity slots were confirmed empty, with no
separate installed Samsung active-time/calorie provider. See the live follow-up
in `device-providers.md`. No health permissions, background service, or extra
complication subscriptions were added.

The 0.4.4 follow-up adds the explicit Samsung Steps range-target compatibility
option and displays the verified 6,000-step target on the physical watch. Tests
cover positive targets, invalid/nonzero-based ranges, the disabled option, and
the exclusion of minutes/calories from this exception. The temporary native
step-source probe was removed; those fields returned zero on this firmware.
Schema, SDK-native build/signature/memory, Gradle resource-only/lint, and the
expression/geometry checks passed. Goal-change synchronization and the two
unavailable activity metrics remain pending.

Version 0.4.5 replaces the platform moon-age field with a UTC Gregorian
date-based mean-lunation calculation. Its only time sources are year,
day-of-year, and AM/PM, changing at midnight/noon UTC. A small periodic angle
correction calibrates quarter positions to the scalloped window, and rotation
now follows waxing/waning correctly. Tests cover 4,384 half-days, calendar and
cycle rollover, fixed positions within each half-day, and 12 published USNO
phase events (maximum fixture error 0.81 days). The corrected moon and the
6,000-step target were inspected on the physical watch. See `moon-phase.md`
for the formula, references, and approximation limits. No network call, timer,
or new high-frequency source was added; decoded-resource estimates are unchanged.

Version 0.4.6 replaces the overlapping activity selection rectangles with compact
boxes around the three value fields. WFF 4 `Reference` exports carry each slot's
progress and target to scene-level drawing, retaining one subscription per
metric. Goal and ranged progress share the same metal arc and cut-edge renderer.
Unavailable/text-only types export no values, using empty-track and missing-goal
defaults. Tests cover all four pairwise-disjoint selector boxes, selecting each
number independently, reference names/defaults, zero/invalid/over-goal payloads,
Samsung target opt-out, gradient geometry, and placement outside clipped slots.
The physical watch's runtime reports the compact bounds, and live step progress
and the 6,000-step target render outside them.

The optional health companion adds separate phone/watch APKs, leaving the face's
resource-only check intact. Samsung Health Data SDK 1.1.0 was imported locally
from the developer-provided AAR; its proprietary binary is ignored by Git. The
phone requests read access to activity summary and the two goal types. Samsung's
LAST goal aggregate supplies actual goals, rather than guessed range limits.
Five shared-model unit tests cover DST/midnight expiry, stale/future samples,
travel date mismatches, unknown/zero/over-goal readings, and invalid values.
Companion assembly and lint pass. The subsequent physical test on 2026-11-02
verified phone consent, SDK queries, Data Layer delivery, and live GOAL_PROGRESS
totals/targets/tracks for both activity providers. Android registered the phone's
background job. A full scheduled interval, goal changes, and permission-loss
handling still need physical observation. See
[companion setup and acceptance checks](health-companion.md).

Version 0.4.7 widens the static moon window's upper arch around the wheel pivot,
giving the painted moon six units of radial clearance. Raster-mask checks cover
both moons throughout rotation, full/new visibility and quarter visibility;
the previous dial fails the upper-rim check. Four-phase previews were widened
to show the entire opening. Date/phase expression tests, WFF schema validation,
memory limits, resource-only APK verification and Android lint pass. Version
0.4.7 was subsequently installed and its wider moon window inspected on the
watch; the always-on view also retained its hands, calendar, battery and markers.

Version 0.4.8 implements the approved hidden balance rim with one small wheel
behind two fixed openings. Native angle animation alternates once per second,
with a 180 ms eased transition at 30 fps and no repeats. The separate seconds
tick remains 130 ms. Expression checks cover parity through second rollover,
the editor toggle, ambient hiding, and the 15% battery cutoff. Raster checks
find 793 changed pixels between the settled states, all confined to the two
inner windows, and verify that the bright rim switches sides. Generated GIFs
have 14 frames, two short transitions and two holds in a looping two-second
cycle. They use sample data and static clock hands, not device recordings.

WFF schema validation, SDK-native assembly/signature verification, Gradle
resource-only verification and lint, moon aperture checks, and expression
tests pass. Maximum decoded-resource estimates are 4,444,248 bytes active
(4.24 MiB) and 1,645,872 bytes ambient (1.57 MiB). The active increase of
87,616 bytes is exactly one 148-by-148 RGBA image; ambient is unchanged.
The installed watch shows both rim positions, and sleep/wake captures confirm
ambient hiding and resumed rendering. A six-second physical recording is
kept locally under ignored artifacts, along with device screenshots. Actual
transition timing, the editor-off setting, low-battery device behavior and
battery consumption have not been measured in this revision.

Version 0.4.9 enlarges the balance apertures from 44 by 18 to 66 by 27 logical
units, retaining their centers and angles. The transition is now 220 ms with
780 ms rest. Both animated previews were regenerated; the close-up crop expands
to include the larger windows. Raster checks find 974 changing pixels confined
to the openings, and both GIFs pass the two-second cycle/hold checks. WFF schema,
SDK-native build/signature/resource-only and memory checks, and expression tests
pass. Version 0.4.9 was installed and its enlarged windows inspected on the
SM-R950. No new artwork resource or ambient change was introduced.

On 2026-11-03, the physical watch still displayed the previous day's MIN/CAL
totals while Steps had rolled over. Its stored snapshot was dated November 2,
and the phone's last successful sync was 22:55 PST. The phone's scheduled worker
was in the RARE standby bucket, with background execution blocked and its next
run overdue by more than nine hours. Changing only the phone companion's battery
setting from Optimized to Unrestricted removed that block. A transient manual
sync failure subsequently recovered on retry; today's SDK read and publish
succeeded. The transient failure's cause was not established.

Companion 0.1.1 adds an explicit NO_DATA complication timeline starting at expiry,
plus a 30-minute cache-check fallback. AndroidX requires the default to retain the
selected metric type; the scheduled NO_DATA entry is its supported type exception.
The timeline accounts for an earlier watch-local midnight as well as the source
date and two-hour expiry. Five instrumentation regression cases cover these
boundaries, stale snapshot rejection and AndroidX timeline validation. Test APK
assembly and both companion lint/build checks pass; existing shared-model unit
tests pass. The phone update is installed. The watch disconnected before its
update/test installation, so execution of the new instrumentation tests and
physical timeline-expiry validation remain pending reconnection. No watch or
phone clock was changed to simulate midnight.

The watch subsequently reconnected on 2026-11-03. All five activity timeline
instrumentation tests passed after adding the required display text to a test
fixture; production health payloads already had text. Watch companion 0.1.2
includes the expiry fix, and today's live minute/calorie readings were observed.
The temporary instrumentation APK was removed after the run. A full overnight
test and renderer expiry under a deliberately disconnected phone remain pending.

Face 0.5.0 adds a fixed center-hub sweep provider in watch companion 0.1.2.
The watch receives one timestamp per tap and a three-second timeline; WFF
references coordinate the hands, calendar, moon, balance and gauges. Five slot
declarations retain the original four-slot order, preventing Samsung's retained
selections from shifting. A physical tap reached the private receiver, and a
mid-animation capture showed motion across the components. Always-on remained
unchanged. The watch's temporary display timeout was restored to 15 seconds.

Two new JVM tests cover tap-session expiry/repeat handling, float precision and
UTC-day wrap. The WFF expression tests cover opposite rotations, initial/final
live positions, all 7/12/31 drum values sampled at 30 fps, battery/track bounds,
unavailable goals, and arbitrary live hand destinations. The existing calendar,
moon, activity, selection geometry, balance raster and GIF checks pass. Schema,
SDK-native build/signature, Gradle resource-only verification and lint pass.
Decoded-resource estimates remain 4,444,248 active and 1,645,872 ambient bytes.
The standalone browser preview is generated from production expressions and
artwork and was rendered in headless Chrome. Physical transition timing and
battery consumption have not been measured.

Face 0.5.1 and watch companion 0.1.3 double that sweep to six seconds: 720 ms
to reach 12, 3,780 ms of opposite rotation, and 1,500 ms of return. The return
uses a smoother ease that is already at rest on the live time. AndroidX stores
timeline bounds as whole epoch seconds, which could drop the last part of the
settle; the published end is rounded up, and a provider refresh during that
extra fraction republishes the same timestamp. Expression checks cover a
monotonic return and final frames within one degree. Four JVM tests, WFF schema
validation, the memory-footprint check, and the signed face APK build pass, as
do the watch-companion unit tests, lint, and debug build. The browser preview
was regenerated from the production expressions. A physical check of the slower
settle is still pending.

Face 0.5.2 replaces the tilted oval balance openings with larger arc slots
centered on the dial. A lighter chamfer and a darker inner wall show the plate
thickness around each clear slot. The wheel is no longer squashed vertically,
so its rim follows those arcs. Raster checks find 1,851 changing pixels, all
inside the two slots, and both settled states expose the bright rim on the
correct side. The motion previews keep the 220 ms transition and the looping
two-second cycle. Expression tests, WFF schema validation, the memory-footprint
check, and the signed APK build pass. A later install on the SM-R950
succeeded; the watch reports version 0.5.2. The new arc openings have not yet
been inspected on the device.
