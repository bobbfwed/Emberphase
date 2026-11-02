# Validation record

2026-11-01. Windows, Android SDK 36 / build-tools 36.0.0, Android Studio JDK 25,
Gradle 9.3.1, AGP 9.1.1. Version 0.3.0 was installed and activated on the
physical SM-R950. Awake rendering, live step text/gauge, and native weather
current temperature / high / condition were observed. Goal synchronization,
source-app comparisons, ambient behavior, and battery-life checks are pending.

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
| Maximum active decoded-resource estimate | 4,326,532 bytes (4.13 MiB) |
| Maximum ambient decoded-resource estimate | 835,872 bytes (0.80 MiB) |
| Physical watch install / activation / awake rendering | Passed with 0.3.0; inset 3/9, lowered calendar, live metal band, and enabled seconds observed |
| Mechanical tick motion | Native 80 ms Tick; overshoot and return observed in screen recording |
| Samsung steps payload | Live RANGED_VALUE observed from Samsung Health steps service; explicit goal not established |
| Native weather availability | Unavailable state followed by current temperature, daily high, and condition icon |
| Other activity payloads / source-app comparisons / ambient / battery life | Pending |
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

Previews are illustrative artwork composites. The native moon position is
coarse; the rotating disc is decorative. Decoded-resource estimates are not
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

Seconds now use native [`Tick`](https://developer.android.com/reference/wear-os/wff/clock/tick)
with duration 0.08 and strength 0.2. The option defaults to enabled, with a new
configuration ID so an existing installation receives the requested default.
Two ticks in a 4.35-second recording exhibited approximately 0.28 degrees of
overshoot followed by return; sparse captured frames do not establish an exact
frame count for every tick. No continuous sweep or millisecond expression was
introduced. The native renderer handles the short burst; real battery impact
still needs measurement. The cropped rim is hidden with the active dial in
ambient, and seconds remain gated by ambient mode and the 15% cutoff.
