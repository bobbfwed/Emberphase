# Watch6 device acceptance

Status: **pending physical watch connection**. Static schema/build/memory checks
do not validate Samsung's providers or measure battery life.

1. Confirm `SM-R950`, API 36, and the installed One UI/Samsung Health/Weather
   versions. Run `Inspect-WatchProviders.ps1` with the explicit watch serial.
2. Install the debug APK and select Emberphase. Check clipping and legibility at
   normal viewing distance. The 450-unit canvas should scale automatically.
3. Select each activity source using the anchors in the README. Record the
   provider label, component (when exposed), supported/returned type, units,
   current value, and any explicit goal in the table below.
4. Compare to Samsung Health **daily activity**, not an exercise session or
   total calories including resting energy. Check steps, active minutes, and
   activity kcal. Note watch-only versus phone-merged totals and sync delay.
5. Change each Samsung Health goal. A `GOAL_PROGRESS` target should follow. If a
   provider returns only text or a range, confirm the face leaves its goal `—`;
   do not claim automatic Samsung-goal synchronization.
6. Test zero progress, a reached/exceeded goal, missing provider permission,
   no provider/empty data, and a provider refresh after midnight. No stale
   fixture values should appear. Check all recessed fills are visible.
7. In native weather mode, compare current temperature, daily high, condition
   icon, day/night, and unit to the system weather source. Test location/weather
   unavailable and stale refreshes. `!` must only indicate the documented
   available-plus-error condition. In custom mode, verify the provider's own
   fields render without parsing or claiming nonexistent weather fields.
8. Test month-end/leap-day and time-zone/date changes. The wheel is a decorative
   twin-moon mechanism driven by WFF's coarse 0–28 moon position, not a precise
   astronomical calculation. Do not adjust the date of a watch collecting live
   health data solely to test rollover; use a test device or controlled preview.
9. Enable optional seconds, then test at 15% and below: seconds must disappear,
   with no flashing effects. Yellow lamp activates at 20%, red at 10%.
10. Check always-on: no weather, activity tracks, moon, calendar, seconds, or
    bright texture. Only dim hour/minute hands and sparse indices remain. Check
    ambient transitions, burn-in shifting, lock/unlock, wake, and relaunch.
11. Measure a representative full-day battery run against a stock face with
    equal AOD, brightness, connectivity, and activity settings. Turn off wireless
    debugging during battery comparisons. No measured-life claim is made yet.

| Metric | Provider / component | Returned type | Units | Value matches | Goal matches / follows changes |
| --- | --- | --- | --- | --- | --- |
| Steps | Pending | Pending | Pending | Pending | Pending |
| Active minutes | Pending | Pending | Pending | Pending | Pending |
| Activity calories | Pending | Pending | Pending | Pending | Pending |
| Current temp / high / condition | Pending | Native WFF or chosen complication | Pending | Pending | N/A |

If there is no individual provider with the required numeric values and goals,
stop at this supported boundary. Do not replace it with estimates or hidden
Samsung APIs. See `data-sources.md` for the separate bridge/provider option.
