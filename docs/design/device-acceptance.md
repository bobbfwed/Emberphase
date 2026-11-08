# Physical-device acceptance

Status: installed and activated on the Watch6 Classic on 2026-11-07. Active and
ambient rendering were inspected; extended acceptance remains open. Local build and simulation evidence is in
[implementation validation](implementation-validation.md).

Device: Galaxy Watch6 Classic SM-R950, API 36, firmware R950XXS2CZF5, 432x432.
Both packages were updated in place, preserving the verified Android debug signer.
The face uses version code 39 to update the watch's existing 0.6.4/code-38 face.

## Candidate handoff

Run `scripts/Prepare-DeviceCandidate.ps1` after building the face and watch
companion. It does not invoke ADB. It verifies the face's source XML, font,
license, decoded picker pixels, APK identities and versions, signatures, and
matching candidate signer fingerprints, then copies:

| File under `artifacts/device-ready/` | Purpose |
| --- | --- |
| `parallax-1.0.1-debug.apk` | Face: `com.bobbfwed.emberphase`, version code 40; fold-over-numerals layering update |
| `emberphase-health-watch-0.1.9-debug.apk` | Optional watch companion: `com.bobbfwed.emberphase.health`, code 2010; adds MIN/KCAL titles |
| `candidate.json` | Source revision, face-source hash, package/version, size, SHA-256, certificate fingerprint, and pending physical status |
| `device-acceptance.md` | This runbook |

The existing phone companion is unchanged; retain its matching package/signing
identity and current consent. Do not reinstall or reconfigure it merely to test
the face. A title-less older watch provider still works, with GOAL/RANGE labels.

## When the watch is available

1. Record watch model, firmware/API, screen size, installed companion versions,
   and selected provider names. Pair authorized wireless ADB using the pairing
   address/code, then connect using the separate debugging address. Select the
   intended device explicitly for every install command.
2. Check the candidate JSON and SHA-256 hashes. Confirm the debug signer matches
   the existing installation. If Android reports a signature mismatch, stop and
   resolve signing; do not uninstall the existing health apps as a workaround.
3. Install the face candidate and optional watch companion update with `install
   -r`, preserving application IDs and data. Select PARALLAX in the watch-face
   picker. Recheck slot selections; stable new IDs 101–103 intentionally replace
   the previous face's selection layout.
4. Run the checks below and save physical screenshots separately from the sample
   previews. Record actual observations; do not treat a picker/editor preview as
   evidence of live data.

Commands to use only after the watch is available (replace all placeholders):

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" pair WATCH_IP:PAIRING_PORT
& "$env:ANDROID_HOME\platform-tools\adb.exe" connect WATCH_IP:DEBUG_PORT
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s WATCH_IP:DEBUG_PORT install -r .\artifacts\device-ready\parallax-1.0.1-debug.apk
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s WATCH_IP:DEBUG_PORT install -r .\artifacts\device-ready\emberphase-health-watch-0.1.9-debug.apk
```

## Acceptance matrix

The installation smoke check covers the observed current time and selected
providers. Rows marked pending still require a dedicated test.

| Check | Expected result | Status |
| --- | --- | --- |
| Picker and launch | Correct name/icon/preview; no blank or clipped face | Installed and activated; face renders |
| Time geometry | All numeral pairs fit at a stable size; compare 00:00, 10:08, 12:00, 23:59 | Pending |
| Clock format | Device, explicit 12-hour, explicit 24-hour work; localized AM/PM does not cross the fold | Device 12-hour/PM observed; other modes pending |
| Day Fold | Crease changes on minute boundaries, resets with local date, no continuous idle motion | Visible with correct current day percentage; rollover pending |
| Date/localization | Current weekday/day/month and longer localized text fit | Current en-US date fits; other locales pending |
| Editor targets | A/B/C independently selectable; no overlap or accidental neighboring selection | Pending |
| Provider defaults | Samsung steps and optional MIN/KCAL providers are selectable; missing sources remain empty | Existing selections retained: A no-data, B Samsung Steps, C companion MIN; full defaults/CAL check pending |
| Provider replacement | Weather/event/heart/other compatible sources replace the title as well as the value; no leftover metric name or goal bar on text-only data | Pending |
| Provider tap | Populated dock invokes its supplied action; no action when none exists | Pending |
| Health comparison | Values/goals match consented companion data and Samsung's displayed totals, allowing normal sync delays | Pending |
| Zero / over goal | Measured zero is zero; progress caps visually while actual over-goal total stays visible | Live Steps/MIN bars render; zero/over-goal cases pending |
| No data / expiry | Denied, stale, offline-expired, midnight-expired data shows a dash with no progress, never sample values | Current no-data dock shows dash; expiry/revocation pending |
| Reconnect and goals | New sync and changed goals update correctly after delivery | Pending |
| Accent and toggles | All accents, fold/signature toggles survive editor save and ambient transitions | Pending |
| Low battery | At 20% or less the fold/caption disappear; battery warning, time and data remain | Pending |
| Ambient | Same time positions, selected outline/solid style, date/battery only; no bright circle, fold, docks, or seconds | Outline mode verified; no fold/docks/rail/signature; native runtime reports ambient=true, shouldAnimate=false |
| Ambient coverage/offload | Measure actual nonblack-pixel coverage; remain below 15%, target below 10%; verify display offload where observable | Captured 3.150% nonblack circular pixels, including system notification indicator. Offload not accepted: renderer reports a timeDataSource node is not offloadable; follow-up required |
| Power saving | Check platform display transitions. No companion-driven power-save behavior is claimed in this candidate | Pending |
| Wrist legibility / size | Read time and values at actual size; inspect 360/450 profiles and a second device when available | Pending |
| Battery run | Debugging off; compare representative active/ambient usage over a recorded interval before making battery-life claims | Pending |

Do not change the date of a watch collecting live health data to force rollover;
use natural midnight or an isolated test environment. If system power-saving
integration is added after delivery verification, make it a separately validated
implementation round and commit.

## Results record

Install result: face 1.0.0/code 39 and watch companion 0.1.9/code 2010 installed
successfully in place and PARALLAX activated. The previous installed APK was saved
locally under ignored `artifacts/device-install/previous-face-0.6.4.apk`.

Initial physical inspection exposed rich-text indentation becoming literal
whitespace/ellipsis, WFF's double-quoted string requirements, string-valued Boolean
configuration options, and unsupported min/max expressions. These were corrected
and regression-checked; progress now uses native clamp. Static configuration color
bindings and a scene-level no-data fallback were also verified on the watch.

Actual screenshots and renderer dumps remain under ignored
`artifacts/device-install/`; live health readings are not committed. The current
selected Steps and MIN payloads render and fill their tracks. No independent
Samsung-app total comparison or permission/expiry test was performed during this
install request. Native active and outline-ambient legibility were inspected.
Offload remains an open issue; battery comparison has not been performed.

Wireless debugging disconnected after the successful native rendering checks.
The runtime fixes are installed and captured; the subsequently regenerated picker
preview was packaged and validated locally but that refreshed package was not
reapplied after the connection closed. Reinstall the current candidate when
connected if the picker preview needs refreshing.

## Layering update 1.0.1 / code 40

The fold is now drawn after the time numerals and AM/PM label. The two black
time-clearance rectangles are removed, so the line graphics remain continuous
over the numbering in both the native face and generated previews. Ambient and
low-battery visibility rules are unchanged. Schema, memory, signing,
resource-only packaging, existing scene checks, browser checks, and the 10:08
preview passed. After wireless debugging reconnected, version 1.0.1/code 40 was
installed in place and activated successfully on the same verified Watch6 Classic.
The native screenshot confirms uninterrupted fold lines above the time numerals.
The updated picker preview is also included in the installed package. Evidence
is retained locally in `artifacts/device-install/layering-1.0.1-face.png`.
