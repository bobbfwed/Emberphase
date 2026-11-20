# Samsung Health companion

Emberphase Health supplies active minutes, active calories and their real daily
goals to the face. It consists of a phone app and a Wear OS complication-provider
app. The watch face itself remains a resource-only WFF APK. Samsung's installed
watch providers still supply steps; the bridge does not replace that source.

## Current status

The companion is installed and working on a Galaxy S24 Ultra (Android 17,
Samsung Health 7.1.0.053) paired with a Watch6 Classic SM-R950 (Wear OS 6).
On 2026-11-02 the developer enabled Samsung's read-testing mode and accepted
the Health permission screen. Initial sync read the two totals and goals through
the SDK and delivered them to the watch through Data Layer. After selecting the
two providers, a physical screenshot confirmed live MIN/CAL numbers, numeric
targets and filled tracks. The runtime reports GOAL_PROGRESS with SDK-supplied
targets for both providers. The developer also confirmed the display looks correct.

The phone/watch apps compile and their lint checks pass. Unit tests cover expiry,
midnight/DST, travel across date boundaries, unknown versus zero, over-goal values
and invalid numbers. Android registered the background sync job; observing a
complete scheduled interval, changed goals, permission revocation and midnight
rollover on physical devices remains pending. Do not interpret editor previews
as live health readings.

## Requirements and SDK access

Use an Android phone with Samsung Health 6.30.2 or newer, Google Play services,
and a paired Wear OS 6 watch. The phone app requires Android 10 or newer.

Samsung Health Data SDK access requires package/signature registration for
public distribution. The companion is currently a local developer integration,
not an approved public Samsung Health partner release. Developers testing their
own builds should follow Samsung's official [SDK process](https://developer.samsung.com/health/data/process.html)
and [developer testing instructions](https://developer.samsung.com/health/data/guide/developer-mode.html).
Developer mode is for testing an app you develop, not a setup requirement to
pass along to public app users.

Download **Samsung Health Data SDK 1.1.0** through your Samsung account. Its
proprietary AAR is not included in this repository or covered by the MIT license.
Import the downloaded archive, or its extracted AAR:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Import-SamsungHealthSdk.ps1 -ZipPath 'C:\Downloads\samsung-health-data-sdk-1.1.0.zip'
# Alternatively:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Import-SamsungHealthSdk.ps1 -AarPath 'C:\Downloads\sdk\libs\samsung-health-data-api-1.1.0.aar'
```

The import stays under ignored `.tools/samsung-health`. The watch face can be
built independently without this SDK. Phone builds fail with an import reminder
when it is absent.

## Build and install

Set `JAVA_HOME` and `ANDROID_HOME` as described in the project README. Connect
the phone with USB debugging and the watch with wireless debugging. Use their
separate serials from `adb devices -l`:

```powershell
.\gradlew.bat :health-common:testDebugUnitTest :health-phone:assembleDebug :health-watch:assembleDebug :health-phone:lintDebug :health-watch:lintDebug :watchface:verifyResourceOnlyDebug
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s PHONE_SERIAL install -r .\health-phone\build\outputs\apk\debug\health-phone-debug.apk
& "$env:ANDROID_HOME\platform-tools\adb.exe" -s WATCH_IP:DEBUG_PORT install -r .\health-watch\build\outputs\apk\debug\health-watch-debug.apk
```

Both companion APKs deliberately use `com.bobbfwed.emberphase.health` and the
same signing certificate. Data Layer requires this match. If you fork the
project and change this ID, update both companion modules and the watch-face
default provider components together. Sign the two release apps with the same
key and register the phone app's package and release SHA-256 with Samsung.

1. Open **Emberphase Health** on the phone and tap **Connect Samsung Health**.
2. Accept Samsung's read permission screen for activity summary, active-time
   goal, and active-calorie goal. The app requests no write permission.
3. Tap **Sync now**. Keep the devices paired and let Samsung Health finish
   syncing watch activity to the phone.
   On Samsung phones, also open **Settings → Apps → Emberphase Health → Battery**
   and select **Unrestricted** if automatic sync stalls. The tested phone's
   Optimized setting blocked the scheduled worker overnight. This setting applies
   to the phone companion; it does not change watch-face animation or watch power
   settings. Android can still delay work, and disconnected devices cannot sync.
4. Edit the face's Complications. Tap the number/dash above **MIN**, select
   **Emberphase · Active minutes**; do the same for **CAL** with
   **Emberphase · Active calories**. Save the face. Existing selections persist
   across face updates, so changing default providers does not replace them.

## Watch-only providers

The watch app also hosts fixed providers that need no phone, permission
or network:

* **Emberphase · Core tap** (0.1.9, current 0.1.10) lets Meniscus slosh its fluid. A tap on the
  core records the time and publishes it in a short timeline (3.5 seconds,
  rounded up to a whole second) that returns to idle on its own. Taps at
  15 percent battery or less, or while a slosh is running, are ignored.
* **Emberphase · Mechanical sweep** is unchanged for the mechanical face
  (six-second window). Both tap providers share `TapTiming`. The tritium face
  uses the same provider for its centre-tap sweep.
* **Emberphase · Power saving** publishes 1 while Android power saving or the
  watch's low-power mode is on, and only when that changes.
* **Emberphase · Low light** (0.1.14) publishes 1 while the screen brightness is
  low. See [Low-light signal](#low-light-signal).
* **Emberphase · Notifications** (0.1.11) publishes how many notifications are
  on the watch, for Meniscus's bubbles. Samsung reports the face's own
  `UNREAD_NOTIFICATION_COUNT` only as 0 or 1, and Wear OS marks everything read
  once the list is opened. A `NotificationListenerService` recounts on every
  post and removal, skipping ongoing, foreground-service and group-summary
  notifications, and asks the face to refresh only when the number changes. It
  never reads notification contents. It needs notification access, which the
  watch has no screen for; grant it over ADB:
  `adb shell cmd notification allow_listener com.bobbfwed.emberphase.health/com.bobbfwed.emberphase.health.watch.NotificationCountListener`.
  Without access the provider publishes no data. Forwarded phone
  notifications are not visible to it (see the engineering notes), so
  Meniscus also reads the unread flag and shows whichever is larger.

Every provider lists all the Emberphase faces (`com.bobbfwed.emberphase`, `.mechanical`,
`.apsis`, `.meniscus` and `.tritium`) in `SAFE_WATCH_FACES`, so one companion serves each
face and switching faces needs no reinstall.

## Low-light signal

Watch companion 0.1.14 adds **Emberphase · Low light**
(`com.bobbfwed.emberphase.health/com.bobbfwed.emberphase.health.watch.BrightnessDataSource`).
The tritium face reads it through a hidden slot to switch to its low-light dial.
It publishes a ranged value from 0 to 1 titled "Low light": 1 ("On") in low
light and 0 ("Off") otherwise. Editor previews show 0.

**What it reads.** Only the system setting `screen_brightness`. The value is
converted to a whole percentage (rounded) of the device's slider range, taken
from the framework's `config_screenBrightnessSettingMinimum` and
`config_screenBrightnessSettingMaximum` (0 and 255 on the tested Watch6
Classic; 1 to 255 is used if a device does not publish them).
It watches `screen_brightness`, `screen_brightness_mode` and Samsung's
`screen_auto_brightness_adj` for changes. It does not read the light sensor
and uses no timer, polling, alarm or foreground service.

**Thresholds.** Low light turns on at 15 percent or less and off at 20 percent
or more. Between the two it keeps its previous state, so a slider resting near
one threshold does not flicker the dial. An unreadable setting counts as off.
Both numbers are constants in `BrightnessLevel`. On the tested watch, raw 39 or
less is on (39/255 rounds to 15 percent) and raw 51 or more is off.

**Delivery.** The face is asked to refresh only when the 0/1 state changes, and
the delivered state is stored only after the face has received it. The
provider also declares `UPDATE_PERIOD_SECONDS` = 600. This is the one deliberate
periodic refresh in the watch companion: if a change is missed, the face heals
within about ten minutes. Each such refresh only reads the setting.
The companion also remembers the last state it asked about, so while the active
face has no low-light slot (and so never takes delivery) it sends one request
per state change instead of one per brightness write; a process start retries
once if the face may still hold an old state.

**Limits.** The change observers live only while the companion process is
alive. Android can stop the process; it restarts for the next provider request
(the ten-minute refresh at the latest), registers the observers again and
publishes the current state. Whether automatic brightness writes its result
into `screen_brightness` on every ambient-light change has not been confirmed on
the watch. On 2026-11-20 the setting read 39 in a dark room with automatic
brightness on, and the display's applied brightness was 39/255, which suggests
it does. If the dial does not follow the room light, check this first.

**Permissions.** None. Reading system settings needs no permission.

**Checking it.** Open **Emberphase Health** on the watch. The last line shows,
for example, `Brightness 39/255 (15%) · low light on`. Change the brightness,
return to the app and read the line again. Over ADB the same raw value is
`adb shell settings get system screen_brightness`.

## Data, cadence, and stopping

The phone reads today's ungrouped `TOTAL_ACTIVE_TIME` (whole minutes) and
`TOTAL_ACTIVE_CALORIES_BURNED` (kcal), plus each goal's `LAST` aggregate. It uses
Samsung's merged activity summary, not exercise duration or resting calories.
`LAST` can return a goal configured before the query's date range; the app does
not invent a goal when the SDK has no result. See Samsung's
[activity summary](https://developer.samsung.com/health/data/api-reference/-shd/com.samsung.android.sdk.health.data.request/-data-type/-activity-summary-type/-companion/index.html)
and [goal semantics](https://developer.samsung.com/health/data/api-reference/-shd/com.samsung.android.sdk.health.data.request/-data-type/-active-time-goal-type/-companion/-l-a-s-t.html).

Automatic phone sync is scheduled every 60 minutes with a 15-minute flex window,
and it waits while the phone battery is low. Android may batch or delay work
further. It does not promise exact-time refresh. An hourly run skips the watch
write when the displayed day, minutes, calories, and goals are unchanged and the
last push still has more than 75 minutes of life. Initial and manual syncs still
run immediately and request urgent Data Layer delivery. A fresh watch cache does
not ask the phone for another Samsung Health read when the face wakes. Stale-cache
requests are limited to one every 15 minutes. Wear OS requests each activity
provider about every 60 minutes as a recovery path when pushes stop; those
requests read the local cache. There is no foreground service, sensor sampling,
exact alarm, or new watch-face timer. Sleep, theater, and watch power saving
remain system display states. Ambient already omits seconds, the balance, moon,
weather, and activity.

Only dated totals and goals travel through Google's paired-device Data Layer.
The watch caches them in private storage, excluded from backup and device
transfer. No raw health records are stored or logged, and there is no Emberphase
backend. Unknown values remain unavailable. Snapshots expire at the earlier of
three hours and the source's local midnight; a different display date also rejects
them. A new day must receive new totals. The watch provider exposes the expiry
to Wear OS through the complication's validity range. Version 0.1.0 left expired
values visible on the tested Samsung renderer despite that range. Version 0.1.1
also sends an explicit `NO_DATA` timeline entry beginning at expiry (or an
earlier watch-local midnight), so the renderer has a scheduled replacement even
without another phone push. Expired totals become dashes and empty tracks;
they are not represented as a measured zero. See Android's
[complication timeline API](https://developer.android.com/reference/androidx/wear/watchface/complications/datasource/ComplicationDataTimeline).

Sync failures show only exception class names to help diagnose permission,
connection or SDK failures; exception messages and health records are not logged.

Use **Stop sharing and clear watch data** on the phone to cancel sync and delete
the shared data item. Failed deletions retry; an offline watch also expires its
cache. Revoking Samsung Health read access is detected on the next read and
stops sharing. It cannot retract information already displayed before the
revocation reaches the bridge. Uninstalling only the phone app is not the Stop
operation; stop sharing first or remove the watch app as well.

## Remaining device acceptance

Compare the SDK's merged totals with Samsung Health's app display; check that
zero progress stays zero, over-goal values remain visible, and changed goals
arrive on a subsequent sync. Check permission denial/revocation,
Stop sharing, reconnect after offline use, midnight expiry/new-day totals, and
normal/always-on transitions. Measure battery life with debugging disabled.
