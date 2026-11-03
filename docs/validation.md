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
clip bounds, distinct editor anchors, resource presence, and the polling policy.
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
