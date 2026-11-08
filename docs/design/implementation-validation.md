# PARALLAX local validation

Initial local validation completed 2026-11-07. The subsequent installation and
native rendering fixes are recorded in [device acceptance](device-acceptance.md).

| Check | Result |
| --- | --- |
| Google WFF validator 1.7.0 / format 4 | Passed for generated native XML. |
| Google memory checker | Passed with 10 MiB active and 4 MiB ambient limits. No measured battery-life claim. |
| SDK-native APK | Built, aligned, debug-signed; APK signature verified. |
| Gradle APK / `verifyResourceOnlyDebug` | Passed. Both APK paths contain the native face and font license, with no DEX. |
| Watch-face lint | Passed; no issues found. |
| Watch companion 0.1.9 | Build, lint, and unit tests passed. |
| Shared/watch companion tests | 12 Gradle unit tests passed: snapshot expiry (5), power delivery (3), sweep compatibility (4). |
| Scene/data checks | All 1,440 minute positions, midnight, DST skip/repeat, travel, independent hit areas, all five supported types, invalid/zero/over-goal ranges, title replacement, and mode/time controls passed. |
| Resource contract audit | Native editor strings, custom font, picker preview, license copy, and stable slots 101–103 passed. |
| Actual browser interactions | Provider switching, ambient visibility, 12-hour/midnight, low-battery cutoff, long text and markup escaping passed. |
| Typeface bounds | Every valid hour/minute pair fits the final 156-unit boxes at a fixed 146-unit font size; maximum browser advance 150.38 units. |
| Ambient preview coverage | 2.937% sample, 3.452% outline stress, 4.556% thin-solid stress, counting every nonblack pixel inside the circular screen. Browser measurements. |
| Review assets | 12 rendered states, including 360 px scaling, plus a portable interactive gallery generated from the WFF scene model. |

## Reproduce

```powershell
node .\scripts\Generate-Parallax.mjs
node .\scripts\test-parallax.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-ParallaxResources.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Build-WatchFace.ps1
node .\scripts\Test-ParallaxPreview.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Measure-ParallaxAmbient.ps1
.\gradlew.bat :watchface:verifyResourceOnlyDebug :watchface:lintDebug
.\gradlew.bat :health-common:testDebugUnitTest :health-watch:testDebugUnitTest :health-watch:assembleDebug :health-watch:lintDebug
```

The native build regenerates XML, runs data/geometry checks, validates the schema,
renders previews (Chrome/Edge), audits resources, packages/signs, checks memory,
and checks APK contents. `-SkipPreviews` uses the committed picker image when a
browser is unavailable. Gradle uses the committed generated resources; rerun the
generator after source-model edits. Configure `JAVA_HOME` and `ANDROID_HOME` as
described in the project README.

The gallery includes sample data and a schematic stand-in for provider icons.
Actual provider icon artwork and tap actions belong to Wear OS. Native font
metrics, editor bounds, complication delivery, ambient offload, and battery use
still require the [device acceptance pass](device-acceptance.md). System power
saving is not guessed from battery level: only the explicit battery cutoff is
implemented until the companion signal can be verified on the watch.

The superseded design-only checks remain in [the design-round record](validation.md).

The first physical install required additional native compatibility fixes:
compact rich-text serialization, double-quoted WFF expression strings, explicit
`"TRUE"` Boolean comparisons, direct configuration color bindings, native clamp
for progress, and no-data fallback rendering outside the complication branch.
These now have regression checks. The native active and ambient captures were
inspected; the latter measures 3.150% lit circular pixels. Renderer offload was
rejected for a timeDataSource node and is not marked passed.

## Device-readiness preflight

The preparation script verifies source XML/font/license and decoded picker pixels
against the built face, validates both APK package/version/signatures, and emits
SHA-256 checksums with a pending-acceptance manifest. A negative check confirmed
that changing the scene after a build causes stale-APK rejection. The final
native audit removed slot-wide tinting; only provider icon images are tinted so
per-element progress colors remain intact. Automatic resizing is disabled for
the measured clock numerals; arbitrary provider text retains it. Rebuilt candidates are checked again
before handoff. No ADB operation is part of this script or the completed checks.
