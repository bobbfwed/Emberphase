# Apsis

Apsis is an open-source watch face for **Wear OS 6 (Android API 36) and later**
with no hands. A ring of minutes sits off-centre inside a fixed circle and
touches it at exactly one point. That point is the hour.

It is the current face of the Emberphase project, written in native Watch Face
Format 4. Its resource-only APK contains no executable app code. Wear OS scales
the circular 450-unit layout to the watch display.

![Illustrative Apsis preview](docs/previews/normal.png)

## Reading the time

* **Hour.** The white contact mark is where the minute ring touches the fixed
  circle. It travels around the dial once every 12 hours. The glowing crescent
  is thickest directly opposite.
* **Minute.** The satellite bead circles the minute ring once an hour and
  carries the minute as a number. The ring's ticks travel with it.
* **Seconds.** A small moonlet orbits the satellite once a minute. It is
  optional.

## Features

* **Forecast hour marks.** The bars around the dial are the weather for the
  next eight hours, each standing at the hour it describes. Height is
  temperature between today's low and high, colour runs cold to warm, and a dot
  marks rain, snow, sleet or thunderstorms.
* **Foresight.** Tap the centre and the dial fast-forwards through the next
  eight hours while the centre reads out each hour's temperature and
  conditions, then returns to now. Requires the Emberphase Health watch
  companion.
* **Core.** Current temperature, high and low, a conditions glyph and the date,
  inside a battery ring that turns amber at 20% and red at 10%. It can show
  digital time instead.
* **Four rim complications.** Curved slots for any data source, with a progress
  line when the source has a goal or range. The defaults are steps, active
  minutes, activity calories and sunrise / sunset.
* **Three colour themes:** Ion, Solar and Glacier.
* **Always-on.** Two hairline circles, the contact mark, the satellite with its
  minute number, and the date.

The face is drawn as vectors that turn once a minute, plus the moonlet once a
second. Nothing animates continuously. The moonlet hides at 15% battery and in
power saving, and Foresight is disabled at 15%. Battery-life measurements are
still pending.

More previews: [Solar](docs/previews/afternoon-solar.png),
[Glacier](docs/previews/evening-glacier.png),
[always-on](docs/previews/ambient.png) and
[low battery](docs/previews/low-battery.png). These are drawings with sample
data, not device screenshots. There is also a
[Wear OS 6 emulator capture](docs/previews/emulator-normal.png). The [design document](docs/design.md) has the
geometry and an [interactive browser mockup](docs/design/apsis-mockup.html).

## Compatibility and current limitations

The project requires Wear OS 6 / API 36 or later and targets the **Samsung
Galaxy Watch6 Classic SM-R950**. See the
[device test checklist](docs/device-acceptance.md) for what has and has not
been verified.

* Hourly forecast depends on the watch's weather source. Hours without data
  show a plain tick, and Foresight reads only the hours that exist.
* Active minutes and activity calories use the optional **Emberphase Health**
  phone/watch companion, because the tested Samsung Health watch app does not
  expose them as numeric complications. Without it those slots show a dash.
  See [companion setup](docs/health-companion.md).
* Foresight and the power-saving cutoff also use the watch companion. Without
  it the face works, the centre tap does nothing, and the moonlet ignores
  power saving.

For the technical findings, see [data sources](docs/data-sources.md) and
[Samsung provider availability](docs/device-providers.md).

## Build from source

The supplied build scripts use **Windows PowerShell**.
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

This runs the layout checks, validates the WFF schema, compiles the resources,
debug-signs the APK, checks memory limits, and verifies that the APK contains
no DEX code. The output is **`artifacts/apsis-debug.apk`**. The layout checks
need Node.js and are skipped with a warning without it.

Alternatively, open the repository in Android Studio or use the Gradle wrapper:

```powershell
.\gradlew.bat :watchface:verifyResourceOnlyDebug :watchface:lintDebug
```

The Gradle APK is
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
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s WATCH_IP:DEBUG_PORT install -r .\artifacts\apsis-debug.apk
```

Long-press the current watch face, choose **Add watch face**, and select
**Apsis**. Its package ID is `com.bobbfwed.emberphase.apsis`, so it installs
alongside other Emberphase faces. Give watch-face forks their own application
IDs so installing one does not replace another.

Foresight, the power-saving cutoff, active minutes and activity calories need
watch companion 0.1.9 or later, which lists this face as an allowed client.

## Customize

Open the face's editor on the watch.

| Setting | Options |
| --- | --- |
| Color | Ion, Solar, Glacier |
| Core | Weather, Digital time |
| Seconds moonlet | On, off |
| Forecast hour marks | On, off |

The four rim slots are selected by tapping them in the editor. Each accepts
goal, ranged, short-text or empty data. The slot shows the provider's icon and
title when it supplies them, then its value. Goal and ranged data also fill the
progress line. The face displays provider values and does not calculate
activity totals.

For active minutes and calories, install and connect the companion, then choose
**Emberphase · Active minutes** and **Emberphase · Active calories**. New face
instances prefer these providers when installed.

## Modify and validate

The layout is generated. Edit the generator, not the XML.

| File | Purpose |
| --- | --- |
| `scripts/New-WatchFace.mjs` | Generates `watchface/src/main/res/raw/watchface.xml`: layout, expressions, settings and complications |
| `scripts/lib/apsis-geometry.mjs` | Radii, slot positions and themes shared by the generator, previews and checks |
| `scripts/New-Preview.mjs` | Draws the picker image and `docs/previews` with headless Edge or Chrome |
| `scripts/test-watchface.mjs` | Expression, geometry and resource checks |
| `watchface/src/main/res/values/strings.xml` | Face and editor labels |

With Node.js installed:

```powershell
node .\scripts\New-WatchFace.mjs
node .\scripts\test-watchface.mjs
node .\scripts\New-Preview.mjs
```

The checks evaluate the face's expressions for Foresight timing and midnight
wrap, hour and minute angles, forecast bar scaling and colour, battery and rim
progress, and confirm the ring geometry, slot bounds, labels and fonts. They
fail when `watchface.xml` is out of date with the generator. The build also
runs Google's WFF validator and memory checker with 10 MiB active and 4 MiB
ambient limits. None of this emulates the Wear OS renderer, so use the
[device test checklist](docs/device-acceptance.md) for visual changes.

To inspect complication provider declarations on a connected watch:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Inspect-WatchProviders.ps1 -Serial WATCH_IP:DEBUG_PORT
```

## Contribute

Fork the repository to make your own version. To propose an improvement, create
a branch in your fork and open a pull request against this repository's `main`
branch. Explain the change, include watch screenshots for visual
changes, and describe the checks you ran. Pull requests are reviewed by the
maintainer before merging.

Bug reports are welcome through [GitHub Issues](https://github.com/bobbfwed/Emberphase/issues).
Include the watch model, Wear OS version, steps to reproduce, and the selected
complication provider when relevant.

## License

Apsis and the Emberphase companion are licensed under the
[MIT License](LICENSE). You may use, modify, and redistribute them, including
commercially, with the required copyright and license notices retained. The
bundled Oxanium typeface is under the
[SIL Open Font License](docs/licenses/Oxanium-OFL.txt).
