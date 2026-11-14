# WFF engineering notes

Platform lessons carried over from the previous face. They describe how Watch
Face Format and the tested watch behave, not any visual design. Target: Galaxy
Watch6 Classic SM-R950, Wear OS 6 / API 36, WFF version 4.

## Runtime and validator behavior

* **String literals in expressions must use double quotes** (`&quot;` inside
  XML attributes). Single quotes pass schema validation and JavaScript
  expression tests, but on the watch they shifted text and broke
  `DecimalFormat` patterns until rendering stopped.
* **Never put a literal percent sign in an editor label.** Samsung formats
  editor strings even with `formatted="false"`, so `%` crashed the editor with
  `FormatFlagsConversionMismatchException`. Spell out "percent".
* Google's WFF validator 1.7 can exit with code zero on schema failures. The
  build script also scans its report for `FAILED`, `SEVERE` and `NOT valid`.
* The memory-footprint tool enforces 10 MiB active and 4 MiB ambient decoded
  resources. One 148-by-148 RGBA image costs 87,616 bytes; prefer `PartDraw`
  vector shapes over large bitmaps.
* Native `Tick` on a second hand: 80 ms / strength 0.2 was imperceptible on the
  wrist; 130 to 180 ms / strength 0.5 is visible.
* A `Transform` with a child `Animation` animates when its evaluated value
  changes. That is the cheap way to get motion without millisecond sources.
* Samsung display offload was active in always-on mode. Keep ambient scenes
  sparse and avoid large lit areas.

## Learned building Meniscus (Wear OS 6 emulator, WFF runtime)

* **A gradient cannot take its colours from a colour setting.**
  `colors="[CONFIGURATION.fluid]"` passes the schema but renders the plain
  fill colour. Instead, draw white shapes and tint each with
  `tintColor="[CONFIGURATION.fluid.n]"`; stacked tinted layers with
  white-to-transparent gradients give a themed multi-colour gradient.
* **Configuration options take exactly one child.** Wrap several elements in
  a `Group` inside `ListOption` / `BooleanOption`.
* A `Template` needs at least one `Parameter`; put static text directly in the
  `Font` element.
* **Carrier groups work.** An empty `Group` whose `angle` is transformed and
  exported with `Reference` carries any number (including values near 86.4
  million) to the rest of the scene, and reads its `defaultValue` while its
  branch is not shown. References to carriers inside a `Condition`, a
  configuration option or a `Complication` all resolve.
* **Sensor subscriptions follow configuration branches, not conditions.** The
  runtime held the accelerometer (about 15 Hz) whenever an accelerometer
  expression sat in an active configuration branch, even inside a `Condition`
  that was false. Turning the configuration option off released it, and the
  runtime releases it in always-on. Gate sensors with editor options; a
  battery `Condition` only stops the motion.
* `ACCELEROMETER_ANGLE_X` is positive when 3 o'clock rolls down. On the
  emulator, values arrived a few seconds after `adb emu sensor set`.
* Battery changes from `dumpsys battery set level` reached the face after a
  delay of several seconds; do not judge from the first screenshot.
* A complication tap action on a fixed, non-customizable slot works: the
  runtime logs `Launch::onTap complication: COMPLICATION.<slot>`.
* `adb shell am broadcast -a com.google.android.wearable.app.DEBUG_SURFACE
  --es operation set-watchface --es watchFaceId <package>` activates a WFF face.
  Reactivate after reinstalling. Simulated charging shows a full-screen
  charging overlay: `dumpsys battery set ac 0`, `usb 0`, `status 3`.
* The companion's power-saving listener only runs while its process is alive;
  on a fresh emulator install open the companion once.
* Emulators from other sessions may be running. Address every `adb` command
  by serial and confirm it with `adb -s <serial> emu avd name`.

## Learned on the Galaxy Watch6 Classic with Meniscus

* **Samsung's WFF runtime (com.samsung.wear.watchface.runtime 4.0.00.16) can
  crash with `ConcurrentModificationException`** in its data flush at screen
  state changes (wake, sleep, always-on). Its weather provider logged the same
  exception while registering sources on a worker thread. After a few crashes
  Android delays restarting the runtime by 30 to 90 minutes, and the watch
  keeps showing the always-on image while awake. It never reproduced on the
  emulator or with the watch lying still; it did on the wrist. Keep weather
  sources few (Meniscus 0.1.0 had 63), avoid `Gyro`, and give every
  ambient `Variant` `duration="0"`. Check `adb logcat` for
  `FATAL EXCEPTION` in `com.samsung.wear.watchface.runtime`.
* `Variant` defaults to a 1-second transition; `duration="0"` makes
  always-on switch instantly.
* **`UNREAD_NOTIFICATION_COUNT` is only 0 or 1 on this watch** (77 runtime
  updates, never above 1, with four notifications present). For a real count
  use the companion's notification-listener provider. Wear OS has no
  notification-access screen; grant it with `adb shell cmd notification
  allow_listener <component>`.
* Treat `WEATHER.HOURS.n.CONDITION == 0` as "no forecast for that hour"
  instead of reading `HOURS.n.IS_AVAILABLE`.
* **System auto-rotate is on by default** on this firmware
  (`settings get system accelerometer_rotation` returned 1, the factory
  default), so the whole screen, watch face included, turned in 90° steps
  when the wrist was held sideways. It is a device setting, not something a
  face can request or block: `adb shell settings put system
  accelerometer_rotation 0`.

## Data sources on the SM-R950

* Native WFF `STEP_COUNT` / `STEP_GOAL` / `STEP_PERCENT` returned **zero** in a
  device probe. Use a steps complication provider instead.
* Samsung Health's Steps provider delivers `RANGED_VALUE`; its range maximum
  matched the user's Steps goal. Treat that as a goal only behind an explicit
  editor option, because other providers' maximums are not personal goals.
* Native WFF weather (`WEATHER.*`, WFF 2+) rendered live on the watch,
  including current temperature, daily high and condition. `IS_AVAILABLE`
  gates access; `IS_ERROR` can be true at the same time (stale data).
* The Emberphase Health companion supplies active minutes and active calories
  as `GOAL_PROGRESS` with real Samsung Health goals. Totals expire after three
  hours or at local midnight, then show as no data.
* Complication types to accept for activity: `GOAL_PROGRESS`, `RANGED_VALUE`,
  `SHORT_TEXT`, `EMPTY`. Never parse `SHORT_TEXT` for numbers or invent goals.

## Complication slots

* **Samsung maps retained provider selections by slot declaration order.**
  Once the face ships, only append new slots; never insert or reorder.
* Keep slot bounding boxes pairwise disjoint so each can be selected in the
  editor. Drawing may extend beyond the bounds when needed.
* WFF 4 `Reference` exports let one complication subscription feed drawing
  elsewhere in the scene, avoiding duplicate subscriptions.

## Companion-driven tricks

* A fixed companion provider can expose a tap action. The watch companion's
  tap provider records a timestamp and publishes a short complication timeline
  that returns to idle on its own: no alarms or polling. AndroidX stores
  timeline bounds as whole epoch seconds, so round the end up.
* The power-saving provider publishes only when Android power saving or the
  watch's low-power settings change. Use it to switch off decorative motion.
* Every companion provider lists the faces allowed to use it in
  `SAFE_WATCH_FACES`. Add the face's application ID there when it changes.
  Other branches build the same companion package: install the build whose
  lists cover every face on the watch, or a later install drops the others.

## Device workflow

* On Samsung phones, set the companion's battery mode to **Unrestricted**; the
  Optimized setting blocked the scheduled sync overnight.
* Wireless ADB pairing and connection ports differ; see the README.
