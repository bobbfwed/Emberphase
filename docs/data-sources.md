# Activity and weather verification

Documentation checked 2026-11-01 before implementing data displays. Target:
Galaxy Watch6 Classic SM-R950, Wear OS 6 / API 36. The watch was subsequently
connected and its installed provider declarations verified; see
[device findings](device-providers.md). Actual payloads, goal synchronization,
and native weather availability remain unverified.

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
`EMPTY` complications. The step inset defaults to the system `STEP_COUNT`
provider's `RANGED_VALUE` type. The other two start empty, ready for the user to
select a suitable installed activity provider.

* `GOAL_PROGRESS`: render the supplied numeric value and target; clamp only the
  drawing to 0–100%, allowing the numeric total to exceed the target. Invalid or
  zero targets have no fill and display no target.
* `RANGED_VALUE`: render supplied text (or its numeric value when text is empty)
  and normalize the gauge using its minimum and maximum. The goal label remains
  `—`: a range maximum is not a verified Samsung Health goal.
* `SHORT_TEXT`: display the provider's text. Do not parse it for numbers or infer
  a goal. The gauge remains unfilled and the goal remains `—`.
* Empty/unavailable: `—`, unfilled track, no fabricated zero or mockup sample.

[WFF complication fields](https://developer.android.com/reference/wear-os/wff/complication/complication).
The recessed track and numeric total are in the same slot context. The slot
bounds cover both because WFF crops rendering at the bounds. These rectangular
regions overlap; the editor has unique selection anchors at the steps number,
the cyan runner left of the gauges, and the bottom of the green gauge. This
avoids subscribing twice to each provider just to reproduce a detached gauge.
[Bounding areas and clipping](https://developer.android.com/reference/wear-os/wff/complication/bounding).
There is no cross-slot data sharing, private Samsung API, guessed component name, background
service, health permission request, or sensor polling in this APK.

The installed Steps provider declares `GOAL_PROGRESS`; Daily Activity does not
declare numeric progress types. No separately named active-time or calorie
provider was found. These declarations do **not** prove live Samsung Health
integration or goal synchronization. Before assigning defaults, compare
the watch's chooser/payloads with Samsung Health while changing each goal. If
Samsung only offers an image or combined daily-activity complication, WFF cannot
extract the three numbers from it. A separate consent-based phone bridge and
Wear OS complication-provider app would be needed for exact Samsung totals and
goals; neither is silently added here.

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
weather mode supplies the mockup's three weather fields together.

Sources: [WFF weather availability and staleness](https://developer.android.com/training/wearables/wff/weather),
[weather source fields](https://developer.android.com/reference/wear-os/wff/common/attributes/source-type),
[default provider policy](https://developer.android.com/reference/wear-os/wff/complication/default-provider-policy).

## Battery policy

No executable application code, networking permission, location polling, heart
rate sampling, alarms, or wake locks. Native clock hands and provider/system
updates drive the face. Mechanical seconds default on, with a native 80 ms
overshoot-and-return tick once per second. They can be disabled in the editor
and disappear at 15% battery or less. Date drums and the mechanical
disc use date/moon sources rather than millisecond expressions. The native moon
position is coarse (0–28); the decorative two-moon disc is not an astronomical
ephemeris. Ambient mode displays dimmed hour/minute hands and sparse white
indices only. Actual battery life must be measured on the watch.
