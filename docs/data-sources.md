# Activity and weather verification

Documentation checked 2026-11-01. Target:
Galaxy Watch6 Classic SM-R950, Wear OS 6 / API 36. The watch was subsequently
connected and its installed provider declarations verified. Live steps and native
weather were subsequently observed on-device; explicit goal-progress delivery
and goal synchronization remain unverified. See the dated follow-up in
[device findings](device-providers.md).

## What Samsung Health exposes

| Display | Samsung Health Data SDK interface on the paired phone | Units / goal |
| --- | --- | --- |
| Steps | `DataTypes.STEPS` aggregates | Count; `DataTypes.STEPS_GOAL.LAST` gives the user's Samsung Health goal |
| Active minutes | `DataTypes.ACTIVITY_SUMMARY.TOTAL_ACTIVE_TIME` | `Duration`, converted to minutes; `DataTypes.ACTIVE_TIME_GOAL.LAST` is also a `Duration` |
| Activity calories | `DataTypes.ACTIVITY_SUMMARY.TOTAL_ACTIVE_CALORIES_BURNED` | kcal; `DataTypes.ACTIVE_CALORIES_BURNED_GOAL.LAST` is the goal in kcal |

Active calories are distinct from total calories burned (which includes resting
energy). Samsung's activity summary de-duplicates overlapping device activity.
Do not substitute exercise-session duration, Google Fit move minutes, Fitbit
active zone minutes, or a pedometer-derived calorie estimate for Samsung active
time/calories.

Sources: [Samsung activity summary](https://developer.samsung.com/health/data/api-reference/-shd/com.samsung.android.sdk.health.data.request/-data-type/-activity-summary-type/index.html),
[summary operations and units](https://developer.samsung.com/health/data/api-reference/-shd/com.samsung.android.sdk.health.data.request/-data-type/-activity-summary-type/-companion/index.html),
[step goal](https://developer.samsung.com/health/data/api-reference/-shd/com.samsung.android.sdk.health.data.request/-data-type/-steps-goal-type/index.html),
[active-time goal](https://developer.samsung.com/health/data/api-reference/-shd/com.samsung.android.sdk.health.data.request/-data-type/-active-time-goal-type/-companion/index.html),
[calorie goal](https://developer.samsung.com/health/data/api-reference/-shd/com.samsung.android.sdk.health.data.request/-data-type/-active-calories-burned-goal-type/-companion/index.html).

The Data SDK is an Android **phone** integration, with Samsung Health installed,
data consent, and Samsung app verification / development-mode requirements.
It is not an API callable from a resource-only watch face.
[Samsung SDK FAQ](https://developer.samsung.com/health/data/faq.html).

## What a resource-only face can consume

WFF has `STEP_COUNT`, `STEP_GOAL`, and `STEP_PERCENT`, sourced by Wear OS, but
they returned zero in a device probe on the SM-R950; use a steps complication
provider. WFF has no native active-time or calorie sources. A Wear OS step count
or goal must not be described as Samsung Health's phone-merged value without a
device comparison. [WFF sources](https://developer.android.com/reference/wear-os/wff/common/attributes/source-type).

Rules for activity complications:

* `GOAL_PROGRESS`: render the supplied value and target; clamp only the drawing
  to 0–100%, allowing the numeric total to exceed the target. Invalid or zero
  targets show no fill and no target.
* `RANGED_VALUE`: render supplied text (or the value when text is empty) and
  normalize using minimum and maximum. Do not present the maximum as a personal
  goal, except behind an explicit Samsung Health Steps option: its range maximum
  matched the Steps goal on the tested watch.
* `SHORT_TEXT`: display the text. Do not parse it for numbers or infer a goal.
* Empty/unavailable: a dash, no fill, never a fabricated zero or sample value.

The installed Samsung Steps provider declares `GOAL_PROGRESS`; Samsung Daily
Activity declares only image/text types, so WFF cannot extract three numbers
from it. The separate consent-based Emberphase Health phone bridge and watch
provider app supply active minutes, active calories and their goals as
`GOAL_PROGRESS`. They are separate APKs; the face remains resource-only, with no
private Samsung API, background service, permission request or sensor polling.

## Weather

Native WFF weather is available since WFF 2 and is system-fed, not polled by
the face: current `WEATHER.TEMPERATURE`, `CONDITION` (enum 0–15),
`CONDITION_NAME`, `IS_DAY`, `DAY_TEMPERATURE_LOW/HIGH`,
`CHANCE_OF_PRECIPITATION`, `UV_INDEX`, `TEMPERATURE_UNIT`, `LAST_UPDATED`,
plus hourly forecasts `WEATHER.HOURS.{n}.IS_AVAILABLE / CONDITION / IS_DAY /
TEMPERATURE / UV_INDEX` and daily forecasts `WEATHER.DAYS.{n}.*`.
`IS_AVAILABLE` gates access; `IS_ERROR` marks available-but-stale data. Handle
every condition value. Current weather rendered live on the SM-R950; how many
hourly forecast entries Samsung's firmware supplies has not been checked.

Samsung Weather's own complication exposes only formatted text, not separate
typed fields. Sources: [WFF weather](https://developer.android.com/training/wearables/wff/weather),
[default provider policy](https://developer.android.com/reference/wear-os/wff/complication/default-provider-policy).

## Companion battery policy

The optional companion schedules phone-side work about every 60 minutes, with a
15-minute flex window, using WorkManager (Android may delay it further). That
periodic read also waits while the phone battery is low. Watch providers receive
Data Layer pushes and a 60-minute system refresh fallback that checks the local
cache. A stale cache can request a phone read at most every 15 minutes; explicit
Sync bypasses that gap. Cached totals expire after three hours or at local
midnight, and an explicit unavailable-data timeline entry replaces them.

The watch companion's power-saving provider reports Android power saving only
when that mode changes. Its tap provider supplies a timestamp for a short,
self-ending complication timeline after a tap, with no alarms or polling.
