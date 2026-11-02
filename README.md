# Emberphase

A hand-written, resource-only Watch Face Format 4 project for the Galaxy Watch6
Classic **SM-R950 running Wear OS 6 / API 36**. The 450-unit circular design is
scaled by Wear OS to the display. Artwork follows
[the original mockup](Mockup%20Images/Original%20Mockup.png).

The native face includes skeleton analog hands, a two-moon mechanical disc
behind a cut-out aperture, month/weekday/date drums with adjacent entries, a
battery slider and steady low-battery lamps, a weather/custom-data inset, and
three concentric activity bands centered on the hand spindle. The colored
bands have a metallic sheen and sharp cut edges; fine rack teeth are exposed
in the unfilled recessed tracks. Date changes are instantaneous, not animated.
The 3 and 9 share the inner numeral radius. The lowered calendar window partly
covers vertically foreshortened adjacent labels to suggest rotating drums.
Both calendars read **weekday, month, date**. Mechanical seconds default
**on**: each second has a brief native 180 ms tick,
a small overshoot, and a return to the correct mark. The editor can disable
seconds; they disappear at 15% battery or below. Always-on mode follows the
[always-on mockup](Mockup%20Images/Always%20On%20Original%20Mockup.png): orange
hour/minute hands, selected calendar values, and a battery gauge, with white
hour marks and 12/3/6/9 on black.

![Illustrative normal artwork composite](docs/previews/normal.png)

These [normal](docs/previews/normal.png), [low-battery](docs/previews/low-battery.png),
[ambient](docs/previews/ambient.png), [ambient low battery](docs/previews/ambient-low-battery.png), [empty-data](docs/previews/unavailable.png),
and [seconds](docs/previews/seconds.png) previews are Windows artwork
composites, **not Wear OS screenshots**. Their example activity values/goals and
weather come from the mockup and are not built into the live face.

## Data behavior

The [data-source verification](docs/data-sources.md) was written before the data
displays. Samsung Health phone SDK data and actual on-watch complication
availability are different interfaces. Installed service declarations and their
supported types have now been [verified on the watch](docs/device-providers.md).
Version 0.4.0 is installed and active on the physical watch. Awake and ambient rendering,
live Samsung Health steps (`RANGED_VALUE`), and native weather current / high /
condition have been observed. Goal synchronization, source-app comparisons,
other activity payloads, extended ambient behavior, and battery-life measurements still
need [device acceptance checks](docs/device-acceptance.md).

* Steps default to the system step-count complication. Do not assume this is the
  phone-merged Samsung Health count or Samsung's personal goal.
* Active minutes and activity calories start unset. Select matching installed
  providers; unavailable data shows `—` rather than zero or sample numbers.
* A `GOAL_PROGRESS` provider supplies both value and explicit goal. A
  `RANGED_VALUE` provider supplies a normalized gauge range, which is not assumed
  to be a Samsung goal; its goal label remains `—`. `SHORT_TEXT` supplies text
  only and leaves the track unfilled. Numeric totals can exceed their goals.
* **Left inset → Weather** is the default. Native WFF supplies current
  temperature, today's high, conditions, and the user's temperature unit. An
  unknown icon/dashes handle missing data; `!` marks available-but-stale weather.
* **Left inset → Custom complication** switches to the normal provider-based
  slot. Then select its source. The selected provider owns its text/title/icon;
  the face does not invent a daily high by splitting formatted text.

No private Samsung components or undocumented health tags are hard-coded.
Exact Samsung Health totals and goals require suitable provider payloads. If
the installed Samsung Health app does not expose them individually, a separate
consent-based phone bridge and complication-provider app would be needed. This
APK does not contain such a bridge or silently substitute estimated values.

## Build

Prerequisites: Android SDK platform 36, build-tools 36.0.0, Android Studio's JDK,
and Windows PowerShell. The SDK/JDK paths are discovered from `ANDROID_HOME` and
`JAVA_HOME`, with standard Android Studio locations as fallbacks.

The fast SDK-native path requires no Gradle dependencies:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Build-WatchFace.ps1
```

This verifies Google's pinned WFF tools, validates the WFF 4 schema, regenerates
static artwork/previews, compiles and links resources using `aapt2`, aligns and
debug-signs the APK, verifies its signature, checks memory, and rejects DEX code.
Output: `artifacts/emberphase-debug.apk`.

The ordinary Android Studio/Gradle path is also available:

```powershell
.\gradlew.bat :watchface:verifyResourceOnlyDebug :watchface:lintDebug
```

Open this root folder in Android Studio. Gradle 9.3.1 and AGP 9.1.1 are pinned;
the wrapper/distribution checksums were checked against Gradle's official
published hashes. Kotlin runtime injection is disabled because this is WFF.
Output: `watchface/build/outputs/apk/debug/watchface-debug.apk`.

Both build paths use Android's standard user debug keystore, so switching paths
does not change the debug signing identity. These APKs are for development and
sideloading; configure your own release signing before distribution. Downloads,
build output, machine SDK paths, and signing keys are ignored by Git.

If whole-file downloads stall on this network, the optional
`scripts/Get-Gradle.ps1` retrieves the same verified distribution in ranges and
extracts it to `.tools/gradle`; run its `bin/gradle.bat` with the same tasks.

## Install when the watch is available

Enable Developer options and Wireless debugging on the watch. Pairing and
connection use **different ports** shown by the watch:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" pair WATCH_IP:PAIRING_PORT
& "$env:ANDROID_HOME\platform-tools\adb.exe" connect WATCH_IP:DEBUG_PORT
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices -l
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Build-WatchFace.ps1 -Install -Serial WATCH_IP:DEBUG_PORT
```

Enter the pairing code when prompted. The install helper requires an explicit
serial so it cannot choose a different attached device. Long-press the current
face, add **Emberphase**, and open its editor. For activity source selection use:

| Slot | Editor selection point |
| --- | --- |
| Steps (20) | Large steps number |
| Active minutes (30) | Left side of the cyan runner beside the tracks |
| Activity calories (40) | Bottom of the green gauge |
| Custom left inset (10) | Left weather area, after choosing Custom complication |

The activity clip bounds contain both each value and its separated gauge, so
the rectangular regions overlap. These selection points do not overlap. A tap
elsewhere inside overlapping regions can resolve to another activity slot.
One provider subscription per metric keeps the numeric value and its gauge in
the same data context. In 450-unit canvas coordinates the distinct activity
anchors are steps `(225,275)`, minutes `(110,372)`, and calories `(225,411)`.
The teeth and bevels are static artwork; the native gradient bands and their
edges change only with provider data. All activity artwork is hidden in ambient.

Capture available provider declarations:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Inspect-WatchProviders.ps1 -Serial WATCH_IP:DEBUG_PORT
```

This reads model/build and complication service declarations into ignored
`artifacts/device-inspection-*`. It does not read health records or prove the
provider's runtime payload. Complete the [device acceptance checks](docs/device-acceptance.md)
before treating Samsung Health integration as verified.

## Validation and editing

```powershell
node .\scripts\test-watchface.mjs
```

The dependency-free checks evaluate the actual WFF calendar/gauge expressions:
2,192 dates including leap years and the year 2100; zero/negative goals and
ranges; values above targets; battery bounds; the seconds cutoff; bitmap
references; gauge clipping and unique editor anchors; and the no-polling policy.
The Node executable is needed only for these development checks.

* `watchface/src/main/res/raw/watchface.xml`: hand-authored layout, expressions,
  configuration branches, and complication rendering.
* `scripts/New-DialAssets.ps1`: reproducible vector construction of static PNG
  artwork. `New-Previews.ps1` composites illustrative fixture previews.
* `watchface/src/main/res/xml/watch_face_info.xml`: picker/editor metadata.
* `docs/data-sources.md`: verified interfaces, units, missing-data policy, and
  the remaining device verification.

Google's WFF 4 validator and memory checker are fetched into `.tools/wff` with
release-asset SHA-256 verification. Memory budgets are 10 MiB active and 4 MiB
ambient; these are decoded-resource checks, not a battery-life measurement.
Standard Android lint cannot follow WFF's renderer-resolved resource names;
`watchface/lint.xml` scopes that unused-resource false positive to WFF resources.
