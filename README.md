# Emberphase · Meniscus

Meniscus is an open-source watch face for **Wear OS 6 (Android API 36) and
later**, written in native Watch Face Format 4, with optional Samsung Health
companion apps. It is part of the Emberphase project.

![Illustrative Meniscus preview](watchface/src/main/res/drawable-nodpi/preview.png)

A sealed glass core holds luminous fluid that stays level as you roll your
wrist. The time sits in the fluid: above the waterline the digits glow on dark
glass, below it they turn dark against the fluid with a slight refraction
offset. The rim of the dial shows the next twelve hours of weather at the
clock positions where those hours will happen.

Try the [interactive concept](docs/design/meniscus-concept.html) by
downloading it and opening it in a browser. The design and its rationale are
in [docs/DESIGN.md](docs/DESIGN.md).

## Features

* **Gravity-true fluid core.** The accelerometer keeps the waterline level as
  the wrist rolls. The level shows the battery by default, the time left in
  the day, or any pod's goal progress. Below 20 percent the battery fluid
  turns ember-red.
* **Waterline numerals.** Custom monoline digits invert at the surface.
* **Chronocast ring.** Each clock hour carries that hour's forecast:
  temperature as terrain depth, conditions as colour (rain streaks, snow
  dots), and day and night as an outer band. The hour cursor walks into the forecast; the elapsed part of the hour is dimmed.
* **Four data pods** at 10, 2, 4 and 8 o'clock for any complication, with
  progress arcs. A pod's conduit to the core lights up when a real goal is
  reached. Defaults: steps, active minutes, active calories, heart rate.
* **Event bar** for the next calendar event or any text complication.
* **Notification bubbles** rise in the fluid, one per notification on your
  phone and watch (needs the companions with notification access; otherwise
  one bubble means something is unread).
* **Slosh.** Tap the core and the fluid swings and settles over about three
  seconds (needs the Emberphase Health watch companion).
* **Seconds spark** with a fading tail on the glass rim.
* **Fluid colours:** Plasma, Ion, Ember and Chlorophyll.
* **Always-on:** outline digits split at the waterline, the hour cursor, ring
  dots and the date on black, with no sensors.

Tilt, seconds and slosh stop at 20 percent battery or below and in
Android power saving (reported by the watch companion). The accelerometer is
never used in always-on. While the screen is awake the watch-face runtime keeps
it subscribed whenever **Gravity tilt** is on, even when low battery has
stopped the motion; turn it off in the editor to release it.
The face has no executable code, network access or polling.

## Compatibility

The project requires Wear OS 6 / API 36 or later and has been tested on a
**Samsung Galaxy Watch6 Classic SM-R950 running Wear OS 6**. The face APK is
resource-only: it contains no executable app code.

Active minutes and activity calories use the optional **Emberphase Health**
phone/watch companion, because the tested Samsung Health watch app does not
expose individual numeric providers for them. See
[companion setup](docs/health-companion.md), [data sources](docs/data-sources.md),
[Samsung provider availability](docs/device-providers.md) and
[WFF engineering notes](docs/wff-engineering-notes.md).

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

It also needs **Node.js** (for the face generator and tests). This checks that
the generated `watchface.xml` is current, runs the expression and layout tests,
validates the WFF schema, compiles the
resources, debug-signs the APK, checks memory limits, and verifies that the APK
contains no DEX code. The output is **`artifacts/meniscus-debug.apk`**.

Alternatively, open the repository in Android Studio or use the Gradle wrapper:

```powershell
.\gradlew.bat :watchface:verifyResourceOnlyDebug :watchface:lintDebug
```

Its APK is
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
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s WATCH_IP:DEBUG_PORT install -r .\artifacts\meniscus-debug.apk
```

Long-press the current watch face, choose **Add watch face**, and select
**Meniscus**.

Meniscus uses the package ID `com.bobbfwed.emberphase.meniscus`, so it
installs alongside the mechanical Emberphase face
(`com.bobbfwed.emberphase.mechanical`) and other forks. Give your own fork its
own application ID so installing one does not replace another.

Install the updated **watch companion** too (see
[companion setup](docs/health-companion.md)): it supplies active minutes and
calories, the core tap for the slosh, the power-saving signal and the
notification count.

The notification count needs notification access on both devices. Phone
notifications reach the watch only through Wear OS's private notification list,
so the phone app counts its own and sends just the number to the watch:

* **Phone:** open Emberphase Health and tap **Notification count on the
  watch**, then allow access.
* **Watch** (for notifications from watch apps): the watch has no screen for
  this, so with the watch connected over ADB run

  ```powershell
  adb shell cmd notification allow_listener com.bobbfwed.emberphase.health/com.bobbfwed.emberphase.health.watch.NotificationCountListener
  ```

The companions only count notifications (ignoring ongoing ones such as media
or workouts); they never read or send contents. Without access, the bubbles
fall back to Samsung's unread flag, which is only 0 or 1.

## Customize the face

Long-press the face and open its editor:

| Setting | Effect |
| --- | --- |
| Fluid colour | Plasma, Ion, Ember or Chlorophyll |
| Core fluid shows | Battery (default), day remaining, or a pod's goal progress |
| Gravity tilt | Fluid follows wrist roll (accelerometer) |
| Seconds spark | Spark on the glass rim, once per second |
| Samsung Health steps target | Treat a zero-based steps range maximum as the goal (10 o'clock pod) |

Tap a pod or the event bar in the editor to choose its data. Pods accept
goal-progress, ranged, short-text and image complications. For active
minutes and calories choose **Emberphase · Active minutes** and
**Emberphase · Active calories**. Values and goals always come from the
provider; the face never invents a goal.

## Test on an emulator

A Wear OS 6 emulator renders the face with the real WFF runtime. It has no
weather, health data or notifications, so build a sample-data variant:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .scriptsBuild-WatchFace.ps1 -Fake
& "$env:ANDROID_HOMEplatform-toolsadb.exe" -s EMULATOR_SERIAL install -r .artifactsmeniscus-fake-debug.apk
& "$env:ANDROID_HOMEplatform-toolsadb.exe" -s EMULATOR_SERIAL shell am broadcast -a com.google.android.wearable.app.DEBUG_SURFACE --es operation set-watchface --es watchFaceId com.bobbfwed.emberphase.meniscus
```

`-Fake` substitutes fixed forecast hours, three notifications and system pod
providers; add `-Diag` for an on-screen sensor readout. The committed
`watchface.xml` is restored afterwards; never ship the fake APK. Use
`adb -s EMULATOR_SERIAL emu sensor set acceleration X:Y:Z` to roll the wrist.
See [WFF engineering notes](docs/wff-engineering-notes.md) for emulator tips.

## Modify and validate

The face is generated. Edit the generator, not `watchface.xml`:

| File | Purpose |
| --- | --- |
| `scripts/meniscus/geometry.mjs` | Layout, glyph paths, palette, provider IDs |
| `scripts/meniscus/expressions.mjs` | Every WFF expression (level, tilt, slosh, forecast, pods) |
| `scripts/meniscus/build-face.mjs` | Writes `watchface/src/main/res/raw/watchface.xml` |
| `scripts/meniscus/build-assets.mjs`, `scripts/New-MeniscusAssets.ps1` | Rasterize numerals, weather glyphs, app icon and preview (needs Microsoft Edge) |
| `scripts/test-meniscus.mjs` | Evaluates the shipped expressions and checks structure, gating, slots and resources |
| `watchface/src/main/res/values/strings.xml` | Face name and editor labels (never use a percent sign) |

```powershell
node .scriptsmeniscusuild-face.mjs
node .scripts	est-meniscus.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .scriptsNew-MeniscusAssets.ps1
```

The build also runs Google's WFF validator and memory checker (10 MiB active,
4 MiB ambient). Use the [device checklist](docs/device-acceptance.md) when
testing on a watch, and see the [WFF engineering notes](docs/wff-engineering-notes.md)
for platform pitfalls. Small text uses IBM Plex Mono under the
[SIL Open Font License](docs/licenses/IBMPlexMono-OFL.txt).

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
