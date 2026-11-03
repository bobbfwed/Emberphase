# Center-tap mechanical sweep

Face 0.5.0 and watch companion 0.1.2 add a three-second sweep when the orange
center hub is tapped while the face is awake. A touch in always-on mode may
only wake the screen; tap the hub again after the normal face appears.

The sequence brings the hands to 12, turns the hour/minute hands through full
rotations in opposite directions, then eases them onto the current time.
The weekday/month/date drums traverse complete rings and return to the live
calendar. The moon rotates, the balance rocks, and the battery/activity bands
travel through their ranges before settling. The optional second hand joins
the sweep only when enabled. Numeric health readings, goals and weather remain
live; the sweep never writes or invents health data.

The sequence is disabled at 15% battery or below and hidden in always-on mode.
Repeated taps during a sweep are ignored. It does not play on wake, unlock,
reboot, or return from an app. An interrupted sweep is not queued for replay.

## Setup

Install both the face and the updated watch companion. The existing phone app
does not need updating for this feature. The sweep requires no Samsung Health
permissions, phone connection, or network access; it is entirely local to the
watch. Without the companion, the face still works and the hub has no sweep.

The hub uses a fixed complication provider, so no editor selection is needed.
The four existing customizable slots retain their original declaration order.
Samsung maps retained selections by that order; the new hub slot is appended.
Do not insert new slots before the existing ones.

## Implementation and battery policy

`SweepDataSource` publishes an idle ranged value with a broadcast tap action.
The private `SweepReceiver` records the tap time and requests one provider
update. A three-second complication timeline then supplies the timestamp and
returns to idle. It does not publish animation frames or schedule background
polling, alarms, health reads or a foreground service.

The timestamp is encoded as milliseconds within the UTC day, plus one, so zero
means idle. Float quantization is at most four milliseconds; the WFF expression
handles UTC midnight wrap. An expired request or backwards clock change cannot
restart a session. The provider uses the reserved range 0–86,400,000, which the
face checks before consuming the value.

WFF references coordinate all the motion. The millisecond clock source exists
only in the tap-controlled branch; ordinary hands remain native clocks. Motion
is divided into 360 ms to reach 12, 1,890 ms for the rotations, and 750 ms for
settling, with eased movement. The artwork is reused, with no movie resources
in the APK and no increase in the decoded-image memory estimate. Provider
delivery and actual rendering cadence can affect the first visible frame.

## Preview and checks

Open [the standalone preview](previews/mechanical-sweep.html) in a browser and
tap its hub or Replay button. It uses the production WFF expressions and artwork,
the current time/date, and sample weather/activity. Browser text rendering and
frame cadence can differ from the watch.

Regenerate and test it with:

```powershell
node scripts\New-SweepPreview.mjs
node scripts\test-sweep.mjs
.\gradlew.bat :health-watch:testDebugUnitTest :health-watch:assembleDebug :health-watch:lintDebug
```

On 2026-11-03, the physical Watch6 accepted the fixed provider and a center tap
reached the receiver. A mid-animation screenshot showed the opposing hands,
cycling drums, moving moon/battery and swept activity tracks. Subsequent
ambient rendering was unchanged, and a later awake capture confirmed the normal
live time, date and activity readings. An eight-second local recording is retained
under ignored artifacts. The preview and expression tests check the complete
sequence and exact endpoint relationships; frame-by-frame device timing and
battery-life measurements remain outstanding.
