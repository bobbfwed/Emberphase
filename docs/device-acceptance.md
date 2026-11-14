# Meniscus device acceptance

Target: Galaxy Watch6 Classic SM-R950, Wear OS 6. Install the face
(`artifacts/meniscus-debug.apk`) and the updated watch companion
(`health-watch-debug.apk`, 0.1.10). The phone companion does not change.

Record each result with the date, face and companion versions, and a
screenshot where it helps. Items marked **calibrate** may need a constant
changed in `scripts/meniscus/geometry.mjs`, then a regenerate and reinstall.

## Install and select

1. Both APKs install; the face appears under **Add watch face** as Meniscus,
   alongside the mechanical Emberphase face.
2. The picker preview and the app icon look right.
3. The editor shows: Fluid colour, Core fluid shows, Gravity tilt, Glass
   parallax, Seconds spark, Samsung Health steps target, four pods and the
   event bar. Labels have no formatting errors.

## Core

4. The time reads correctly in 12- and 24-hour modes; the digits are crisp.
5. With the battery fluid, the level matches the battery percentage and the
   level tag reads `BATT nn%`.
6. Above the waterline the digits are light; below it they are dark on the
   fluid, offset slightly (refraction break). No digit fragments show
   outside the core.
7. **Calibrate:** roll the wrist toward 3 o'clock. The fluid should pile up
   toward the lower side, staying level with the ground. If it tilts the
   wrong way, flip `TILT_SIGN`. Check the motion is smooth, not jittery.
8. Tilt stops (surface level with the watch) with Gravity tilt off, in power
   saving, and at 20 percent battery or less.
9. Tap the core: the fluid swings and settles within about 3 seconds. Rapid
   repeated taps do not restart it. No slosh in power saving or at 20 percent
   or less.
10. Each fluid colour applies to the fluid, pod arcs and seconds spark. Below
    20 percent with the battery fluid, the fluid turns ember-red.
11. Core fluid options: Day remaining falls through the day; each pod option
    follows that pod's goal progress (and reads `GOAL`).

## Chronocast ring

12. With weather available, the current hour's sector starts at the hour
    cursor and the next 11 hours follow clockwise. Record how many hourly
    forecast entries the firmware supplies (missing hours show a plain
    grey track).
13. Day and night colours on the outer band change at sunrise and sunset.
14. Temperature labels at +3, +6 and +9 hours match the forecast.
15. Rain shows cyan streaks, snow white dots, storm violet.
16. With weather unavailable (airplane mode, then wait for expiry) the ring
    shows the grey track and the weather line shows `WEATHER --°`.

## Pods, event bar, bubbles, date

17. Steps (Samsung Health), active minutes and active calories show values,
    targets and progress arcs. Reaching a goal lights that pod's conduit.
18. The Samsung steps target option shows `/goal` for a ranged steps provider;
    turning it off shows the provider's title instead.
19. Heart rate, a monochrome-image provider and a small-image provider render
    in a pod. An empty pod shows only its housing.
20. Each pod and the event bar can be selected on its own in the editor; the
    core cannot (it is the fixed core-tap slot).
21. The event bar shows the next calendar event.
22. Unread notifications appear as bubbles with a count (`6+` above six);
    reading them all removes the bubbles. New bubbles rise into place.
23. The weekday and date are correct and fit.

## Always-on and power

24. Always-on shows the outline digits split at the waterline, the hour
    cursor, ring dots, date and the core outline only. No fill, pods, weather
    or seconds.
25. Seconds spark ticks once per second and disappears with its setting off,
    in power saving, and at 20 percent or less.
26. Memory: the build's footprint check passes; note any renderer warnings in
    `adb logcat`.
27. Battery: compare a few hours of normal wear against the mechanical face,
    with tilt on and off. If tilt costs noticeably more, make it default off.
