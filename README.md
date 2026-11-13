# Emberphase

Emberphase is an open-source watch face for **Wear OS 6 (Android API 36) and
later**, hand-written in native Watch Face Format 4, with optional Samsung
Health companion apps.

> **Redesign in progress.** The previous mechanical-style dial has been removed.
> The new design and build plan are in [docs/DESIGN.md](docs/DESIGN.md). Until
> it is built, the face module contains a plain placeholder clock.

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

This validates the WFF schema, compiles the
resources, debug-signs the APK, checks memory limits, and verifies that the APK
contains no DEX code. The output is **`artifacts/emberphase-debug.apk`**.

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
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s WATCH_IP:DEBUG_PORT install -r .\artifacts\emberphase-debug.apk
```

Long-press the current watch face, choose **Add watch face**, and select
**Emberphase**.

Emberphase stays installed and available under **Add watch face** when another
face is active. Add it once to keep it in the watch's face carousel for quick
switching. The face uses the package ID
`com.bobbfwed.emberphase.mechanical`, so it can coexist with PARALLAX or other
forks that use the original `com.bobbfwed.emberphase` ID. This is a separate
installation from older Emberphase builds; configure its complications once.
Future updates to this package preserve its settings. Give other watch-face
forks their own application IDs so installing one does not replace another.

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
