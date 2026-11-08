# Physical-device acceptance

Status: pending watch availability. No watch connection or installation has been
attempted. Local build and simulation evidence is in
[implementation validation](implementation-validation.md).

Stage 5's offline readiness work is complete. The following checks require the
watch and remain unperformed. Target first: Galaxy Watch6 Classic SM-R950 on
Wear OS 6 / API 36, then a second size/device when available.

## Candidate handoff

Run `scripts/Prepare-DeviceCandidate.ps1` after building the face and watch
companion. It does not invoke ADB. It verifies the face's source XML, font,
license, decoded picker pixels, APK identities and versions, signatures, and
matching candidate signer fingerprints, then copies:

| File under `artifacts/device-ready/` | Purpose |
| --- | --- |
| `parallax-1.0.0-debug.apk` | Face: `com.bobbfwed.emberphase`, version code 34 |
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
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s WATCH_IP:DEBUG_PORT install -r .\artifacts\device-ready\parallax-1.0.0-debug.apk
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s WATCH_IP:DEBUG_PORT install -r .\artifacts\device-ready\emberphase-health-watch-0.1.9-debug.apk
```

## Acceptance matrix

Every row is pending a physical result.

| Check | Expected result | Status |
| --- | --- | --- |
| Picker and launch | Correct name/icon/preview; no blank or clipped face | Pending |
| Time geometry | All numeral pairs fit at a stable size; compare 00:00, 10:08, 12:00, 23:59 | Pending |
| Clock format | Device, explicit 12-hour, explicit 24-hour work; localized AM/PM does not cross the fold | Pending |
| Day Fold | Crease changes on minute boundaries, resets with local date, no continuous idle motion | Pending |
| Date/localization | Current weekday/day/month and longer localized text fit | Pending |
| Editor targets | A/B/C independently selectable; no overlap or accidental neighboring selection | Pending |
| Provider defaults | Samsung steps and optional MIN/KCAL providers are selectable; missing sources remain empty | Pending |
| Provider replacement | Weather/event/heart/other compatible sources replace the title as well as the value; no leftover metric name or goal bar on text-only data | Pending |
| Provider tap | Populated dock invokes its supplied action; no action when none exists | Pending |
| Health comparison | Values/goals match consented companion data and Samsung's displayed totals, allowing normal sync delays | Pending |
| Zero / over goal | Measured zero is zero; progress caps visually while actual over-goal total stays visible | Pending |
| No data / expiry | Denied, stale, offline-expired, midnight-expired data shows a dash with no progress, never sample values | Pending |
| Reconnect and goals | New sync and changed goals update correctly after delivery | Pending |
| Accent and toggles | All accents, fold/signature toggles survive editor save and ambient transitions | Pending |
| Low battery | At 20% or less the fold/caption disappear; battery warning, time and data remain | Pending |
| Ambient | Same time positions, selected outline/solid style, date/battery only; no bright circle, fold, docks, or seconds | Pending |
| Ambient coverage/offload | Measure actual nonblack-pixel coverage; remain below 15%, target below 10%; verify display offload where observable | Pending |
| Power saving | Check platform display transitions. No companion-driven power-save behavior is claimed in this candidate | Pending |
| Wrist legibility / size | Read time and values at actual size; inspect 360/450 profiles and a second device when available | Pending |
| Battery run | Debugging off; compare representative active/ambient usage over a recorded interval before making battery-life claims | Pending |

Do not change the date of a watch collecting live health data to force rollover;
use natural midnight or an isolated test environment. If system power-saving
integration is added after delivery verification, make it a separately validated
implementation round and commit.

## Results record

Candidate/source revision: pending on-device run. Device/firmware: pending.
Install result: not attempted. Live data: not verified. Native font/outline
legibility: not verified. Offload/ambient pixels: not measured on the watch.
Battery comparison: not performed. No physical pass is recorded yet.
