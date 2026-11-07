# Activity and weather verification

Documentation checked 2026-11-01 before implementing data displays. Target:
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

## What this resource-only face can consume

WFF has `STEP_COUNT`, `STEP_GOAL`, and `STEP_PERCENT`, sourced by Wear OS. It
does not document native active-time or calorie sources. A Wear OS step count or
goal must not be described as Samsung Health's phone-merged value without a
device comparison. [WFF sources](https://developer.android.com/reference/wear-os/wff/common/attributes/source-type).

Each activity inset accepts `GOAL_PROGRESS`, `RANGED_VALUE`, `SHORT_TEXT`, and
`EMPTY` complications. The step inset prefers the verified Samsung Health Steps
provider's `GOAL_PROGRESS` type, with the system `STEP_COUNT` provider's
`RANGED_VALUE` type as a fallback. Existing selected sources/types can persist
through updates; changing the default does not force them to change. The other
two prefer the optional Emberphase Health companion's individual `GOAL_PROGRESS`
providers, falling back to empty when unavailable. See [companion setup](health-companion.md).

* `GOAL_PROGRESS`: show the supplied numeric value and target. Clamp only the
  drawn fraction to 0–100%. The numeric total may exceed the target. Invalid or
  zero targets have no fraction and display no target.
* `RANGED_VALUE`: show the supplied text, or its numeric value when text is
  empty, and normalize any fraction with the payload minimum and maximum. Do
  not treat an arbitrary range maximum as a personal goal. The one observed
  exception is Samsung Health Steps on this watch: a ranged payload with
  minimum zero had a maximum equal to the Samsung Health step goal. Any new
  scene that offers that compatibility must keep it optional and off for other
  providers. Minutes and calorie targets never use it.
* `SHORT_TEXT`: show the provider's text. Do not parse it or infer a goal.
* Empty or unavailable: an explicit empty mark. Do not invent a zero.

[WFF complication fields](https://developer.android.com/reference/wear-os/wff/complication/complication).
Each user slot subscribes to one provider. Tap targets must not overlap. A
`Reference` can carry a computed fraction to a separate drawing element, so the
tap box does not have to contain the drawing. Missing or text-only data must
not look like a measured zero.
[Bounding areas and clipping](https://developer.android.com/reference/wear-os/wff/complication/bounding).
See also [WFF references](https://developer.android.com/reference/wear-os/wff/common/reference/reference).
There is no sharing between different providers, private Samsung API, guessed component name, background
service, health permission request, or sensor polling in this APK.

The installed Steps provider declares `GOAL_PROGRESS`; Daily Activity does not
declare numeric progress types. No separately named active-time or calorie
provider was found. These declarations do **not** prove live Samsung Health
integration or goal synchronization. Before assigning defaults, compare
the watch's chooser/payloads with Samsung Health while changing each goal. If
Samsung only offers an image or combined daily-activity complication, WFF cannot
extract the three numbers from it. The optional, separate consent-based phone
bridge and Wear OS complication-provider app implement the SDK path for active
minutes/calories and their goals. They are separate APKs; the face remains resource-only.

## Weather

The default left inset uses native WFF weather, available since WFF 2:
`WEATHER.TEMPERATURE`, `WEATHER.DAY_TEMPERATURE_HIGH`, `WEATHER.CONDITION`,
`WEATHER.CONDITION_NAME`, and `WEATHER.TEMPERATURE_UNIT`. These are system-fed,
not a weather API polled by this face. All documented condition values 0–15 have
icons, with an unknown fallback and night variants for clear/partly cloudy.
`IS_AVAILABLE` gates access; `IS_ERROR` marks available-but-stale data. When
unavailable, show dashes and an unknown icon. Actual weather availability on the
Samsung firmware remains a device acceptance check.

The editor's **Left inset** setting switches to **Custom complication**. Then
assign its source through the normal complication chooser. This avoids guessing
Samsung Weather's service component. It renders provider text/title/icon for
`SHORT_TEXT`, `LONG_TEXT`, and `RANGED_VALUE`, plus image types. Those generic
fields do not promise a separately addressable daily high or condition enum;
the face does not split or reinterpret a provider's formatted string. Native
weather can supply current temperature, daily high, and condition together.

Sources: [WFF weather availability and staleness](https://developer.android.com/training/wearables/wff/weather),
[weather source fields](https://developer.android.com/reference/wear-os/wff/common/attributes/source-type),
[default provider policy](https://developer.android.com/reference/wear-os/wff/complication/default-provider-policy).

## Power and refresh policy

The watch-face APK has no executable code, networking permission, location
polling, heart-rate sampling, alarms, or wake locks. Clock fields and
provider updates drive the face. There is no ordinary millisecond source and
no continuous animation. When a motion costs battery, drop the motion.

Power saving is a fixed watch-companion value with no periodic refresh. The
companion reads Android power-save mode and the watch low-power settings, and
publishes when one of those changes. Its complication slot must sit inside the
round face. A clipped corner slot never activates, so the face keeps reading 0.
The face adds no timer for sleep or theater mode. Samsung display offload has
been observed. Ambient must be a separate, sparse scene. Actual battery life
has to be measured on the watch.

The phone companion schedules work about every 60 minutes, with a 15-minute
flex window, and waits while the phone battery is low. Android may delay it
further. Watch providers receive Data Layer pushes and a 60-minute system
refresh that reads the local cache. Raising the watch does not ask the phone
for a new reading while that cache is fresh. A stale cache can request one at
most every 15 minutes. Explicit Sync bypasses that gap and the low-battery
wait. Cached totals expire after three hours or at local midnight. An explicit
unavailable timeline entry replaces expired totals even without a later push.
See [overnight sync setup](health-companion.md).

`SweepDataSource` is a fixed, watch-local complication with no periodic
updates. A tap can publish a short-lived timestamp. It does not define an
animation, and a new scene does not have to use it. It adds no phone health
query and no sensor subscription. Layout and rendering rules for the new face
are in [platform constraints](platform-constraints.md).
