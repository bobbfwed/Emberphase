# Emberphase

Emberphase is an open-source mechanical-style analog watch face for **Wear OS 6
(Android API 36) and later**. Build it for your watch, customize the design, or
fork it to create your own version.

The face is hand-written in native Watch Face Format 4. Its resource-only APK
contains no executable app code. Wear OS scales the circular 450-unit layout
to the watch display.

![Illustrative Emberphase preview](docs/previews/normal.png)

## Features

* Skeleton analog hands and an optional mechanical second hand with a brief
  overshoot on each tick.
* A rotating twin-moon disc behind a recessed aperture.
* Mechanical calendar drums showing **weekday, month, date**, with partially
  visible adjacent entries.
* A battery slider with steady low-battery indicators.
* Weather showing current temperature, daily high, and conditions, or a
  customizable complication in the same inset.
* Three concentric activity tracks for steps, active minutes, and activity
  calories, with metallic fills, sharp edges, and exposed rack teeth.
* A simplified always-on display with orange hands, calendar, and battery
  gauge, plus white hour markers on black.

The design prioritizes battery efficiency through static artwork, native WFF
rendering, and provider-driven data updates. Seconds disappear in always-on mode
and at 15% battery or below; you can also disable them in the editor. Battery-life
measurements are still pending.

See the [always-on](docs/previews/ambient.png),
[low-battery](docs/previews/low-battery.png),
[always-on low-battery](docs/previews/ambient-low-battery.png), and
[unavailable-data](docs/previews/unavailable.png) previews. These are illustrative
artwork composites with sample data, not device screenshots. The design references
are the [original mockup](Mockup%20Images/Original%20Mockup.png) and
[always-on mockup](Mockup%20Images/Always%20On%20Original%20Mockup.png).

## Compatibility and current limitations

The project requires Wear OS 6 / API 36 or later. It has been tested on a
**Samsung Galaxy Watch6 Classic SM-R950 running Wear OS 6**, including active
and always-on rendering, live steps, and native weather. Other watches and
sizes have not yet been verified. See the
[device test results](docs/device-acceptance.md) for details and outstanding checks.

Activity data depends on the complication providers installed on the watch.
Steps prefer Samsung Health's steps-and-goal provider when available, with the
system step-count provider as a fallback. **Active minutes and
activity calories start unset**, and the tested Samsung Health installation did
not expose suitable individual providers for those two values. The face does
not include a phone companion or health-data bridge. Missing data displays `—`.

The moon disc is a decorative display driven by WFF's coarse moon-phase value,
not a precise astronomical calculation.

## Build from source

The supplied build and artwork-generation scripts use **Windows PowerShell**.
Install Git and Android Studio, then use Android Studio's SDK Manager to install:

* Android SDK Platform 36.
* Android SDK Build-Tools 36.0.0.
* Android SDK Platform-Tools, including ADB.

Clone the repository, or clone your fork if you plan to publish your changes:

```powershell
git clone https://github.com/bobbfwed/Emberphase.git
cd Emberphase
```

Set `ANDROID_HOME` to your Android SDK directory and `JAVA_HOME` to Android
Studio's bundled `jbr` directory. For example, in the current PowerShell session:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
# Adjust this to match your Android Studio installation.
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
```

The build script also checks saved user environment variables and standard
per-user Android Studio installation paths. An internet connection is needed
for validation-tool downloads on the first build.

Run the SDK-native build:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Build-WatchFace.ps1
```

This validates the WFF schema, regenerates artwork and previews, compiles the
resources, debug-signs the APK, checks memory limits, and verifies that the APK
contains no DEX code. The output is **`artifacts/emberphase-debug.apk`**.

Alternatively, open the repository in Android Studio or use the Gradle wrapper:

```powershell
.\gradlew.bat :watchface:verifyResourceOnlyDebug :watchface:lintDebug
```

The Gradle build uses the committed artwork. Its APK is
`watchface/build/outputs/apk/debug/watchface-debug.apk`. Gradle 9.3.1 and Android
Gradle Plugin 9.1.1 are pinned in the project.

Both build paths use Android's standard local debug keystore. Configure release
signing before distributing a release build. Build output, local SDK settings,
and signing keys are ignored by Git.

## Install on your watch

1. Connect the computer and watch to the same Wi-Fi network.
2. Enable Developer options on the watch. On Galaxy Watch, open **Settings →
   About watch → Software information**, then tap **Software version** repeatedly
   until developer mode is enabled.
3. Open **Settings → Developer options**, enable **ADB debugging** and
   **Wireless debugging**, then select **Pair new device**.
4. Use the pairing address and code shown on the watch with the command below.
   After pairing, return to the main Wireless debugging screen and use its
   connection address. **The pairing and connection ports are different.**

Replace `WATCH_IP`, `PAIRING_PORT`, and `DEBUG_PORT` with the values displayed
on your watch:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" pair WATCH_IP:PAIRING_PORT
& "$env:ANDROID_HOME\platform-tools\adb.exe" connect WATCH_IP:DEBUG_PORT
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices -l
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Build-WatchFace.ps1 -Install -Serial WATCH_IP:DEBUG_PORT
```

Enter the pairing code when prompted. Accept any debugging authorization prompt
on the watch. The install command requires an explicit device address or serial.

To install an APK you already built, use:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s WATCH_IP:DEBUG_PORT install -r .\artifacts\emberphase-debug.apk
```

Long-press the current watch face, choose **Add watch face**, and select
**Emberphase**. Open its editor to configure the data sources and second hand.

## Customize the displays

Use **Left inset → Weather** for current temperature, today's high, and conditions
in the watch's temperature unit. Weather availability depends on the system
weather source; missing values show dashes, and `!` indicates available weather
with an error or stale-data state.

Choose **Left inset → Custom complication** to use an installed complication
provider instead, then select its source in the left inset.

For activity providers, select these areas in the watch-face editor:

| Display | Selection point |
| --- | --- |
| Steps | Large steps number |
| Active minutes | Left side of the cyan runner beside the tracks |
| Activity calories | Bottom of the green gauge |
| Custom left inset | Left weather area, after choosing Custom complication |

Some editor regions overlap, so use these selection points if a tap selects
the wrong display. Choose a provider that supplies the corresponding metric;
the face displays the provider's data and does not calculate activity totals.

Explicit goals are shown only when a provider supplies `GOAL_PROGRESS` data.
A `RANGED_VALUE` provider can fill a track, but its range maximum is not assumed
to be your personal goal; the goal label remains `—`. A `SHORT_TEXT` provider
shows text without filling the track. System steps may differ from phone-merged
Samsung Health totals, and automatic Samsung Health goal synchronization has
not been verified.

If the steps target remains a dash after updating the face, reselect **Samsung
Health → Steps** in the editor and save. Existing face instances can retain an
older range-based selection even when the default now requests `GOAL_PROGRESS`.
If the provider still supplies only a range, the target remains unavailable.
Active minutes and calories require separate suitable providers; choosing the
combined Samsung Health Daily Activity display cannot supply those two numeric
values and goals independently.

For the technical findings, see [data sources](docs/data-sources.md) and
[Samsung provider availability](docs/device-providers.md).

## Modify and validate

The main files to edit are:

| File | Purpose |
| --- | --- |
| `watchface/src/main/res/raw/watchface.xml` | Layout, expressions, hands, configuration, and complications |
| `scripts/New-DialAssets.ps1` | Reproducible static artwork |
| `scripts/New-Previews.ps1` | Illustrative previews and picker image |
| `watchface/src/main/res/values/strings.xml` | Watch-face and editor labels |
| `watchface/src/main/res/xml/watch_face_info.xml` | Picker and editor metadata |

After changing the artwork scripts, run the SDK-native build to regenerate the
assets. To regenerate just the artwork and previews:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\New-Previews.ps1
```

With Node.js installed, run the dependency-free expression and geometry checks:

```powershell
node .\scripts\test-watchface.mjs
```

The checks cover calendar rollover and leap years, activity ranges and goals,
battery bounds, the seconds cutoff, artwork references, and selection geometry.
The build additionally uses Google's WFF validator and memory checker, with
10 MiB active and 4 MiB ambient memory limits. See
[validation details](docs/validation.md) and the
[device test checklist](docs/device-acceptance.md) when testing a change.

To inspect complication provider declarations on a connected watch:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Inspect-WatchProviders.ps1 -Serial WATCH_IP:DEBUG_PORT
```

The report is saved under the ignored `artifacts` directory. This inspection
reads device and provider declarations, not health records.

## Contribute

Fork the repository to make your own version. To propose an improvement, create
a branch in your fork and open a pull request against this repository's `main`
branch. Explain the change, include previews or watch screenshots for visual
changes, and describe the checks you ran. Pull requests are reviewed by the
maintainer before merging.

Bug reports are welcome through [GitHub Issues](https://github.com/bobbfwed/Emberphase/issues).
Include the watch model, Wear OS version, steps to reproduce, and the selected
complication provider when relevant.

## License

Emberphase is licensed under the [MIT License](LICENSE). You may use, modify,
and redistribute it, including commercially, with the required copyright and
license notices retained.
