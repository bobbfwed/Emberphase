# Validation record

2026-11-01. Windows, Android SDK 36 / build-tools 36.0.0, Android Studio JDK 25,
Gradle 9.3.1, AGP 9.1.1. Provider declarations have subsequently been verified
on the physical watch; live data, rendering, and battery-life checks are pending.

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
| Maximum active decoded-resource estimate | 4,272,132 bytes (4.07 MiB) |
| Maximum ambient decoded-resource estimate | 835,872 bytes (0.80 MiB) |
| Actual Samsung provider payloads, weather availability, rendering, battery life | Not yet tested on the watch |
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

Previews are illustrative artwork composites. The native moon position is
coarse; the rotating disc is decorative. Decoded-resource estimates are not
measurements of RAM resident on Samsung firmware or of battery consumption.
Use `device-acceptance.md` for the remaining physical-device checks.
