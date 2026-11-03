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

* `GOAL_PROGRESS`: render the supplied numeric value and target; clamp only the
  drawing to 0–100%, allowing the numeric total to exceed the target. Invalid or
  zero targets have no fill and display no target.
* `RANGED_VALUE`: render supplied text (or its numeric value when text is empty)
  and normalize the gauge using its minimum and maximum. The goal label remains
  `—`, except for the explicit Samsung Health Steps compatibility option. That
  option displays a positive range maximum when its minimum is zero; the watch's
  range maximum was compared with its Samsung Health Steps goal. Disable it for
  another steps provider whose range limit is not a personal goal. Minutes and
  calorie targets never use this exception.
* `SHORT_TEXT`: display the provider's text. Do not parse it for numbers or infer
  a goal. The gauge remains unfilled and the goal remains `—`.
* Empty/unavailable: `—`, unfilled track, no fabricated zero or mockup sample.

[WFF complication fields](https://developer.android.com/reference/wear-os/wff/complication/complication).
Each activity slot subscribes to one provider and renders its numeric total in
a compact box. WFF 4 `Reference` exports share the calculated progress angle and
numeric target with separate scene elements that draw the track and target.
The selection boxes around the three activity values do not overlap, and they
do not have to contain the tracks. Missing or text-only data uses reference
defaults (214 degrees for an empty track and zero for an unavailable target).
The empty export groups use their transformable angle attribute as a numeric
carrier and draw no artwork. This avoids extra complication subscriptions.
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
weather mode supplies the mockup's three weather fields together.

Sources: [WFF weather availability and staleness](https://developer.android.com/training/wearables/wff/weather),
[weather source fields](https://developer.android.com/reference/wear-os/wff/common/attributes/source-type),
[default provider policy](https://developer.android.com/reference/wear-os/wff/complication/default-provider-policy).

## Battery policy

The watch-face APK has no executable application code, networking permission, location polling, heart
rate sampling, alarms, or wake locks. Native clock hands and provider/system
updates drive the face. Mechanical seconds default on, with a native 130 ms
overshoot-and-return tick once per second. They can be disabled in the editor
and disappear at 15% battery or less. Date drums and the mechanical
disc use date fields rather than millisecond expressions. The moon calculation
uses UTC year, day-of-year, and AM/PM, so its time inputs change only twice daily.
It estimates the phase from a known new moon and the mean synodic month, with no
moon API or native moon-phase source. See [moon calculation](moon-phase.md) for
accuracy limits. Ambient mode displays orange hour/minute hands, the selected weekday,
month, and date, a battery slider with threshold lamps, and white hour markers
with 12/3/6/9. The ambient scene has no seconds, weather, moon, activity tracks,
or adjacent calendar entries. Samsung display offload was observed active.
Actual battery life must be measured on the watch.

The optional hidden balance uses `[SECOND] % 2` to alternate its angle between
-55 and +55 degrees. Native WFF animation interpolates each change for 180 ms
at 30 fps, then holds the settled position for the rest of the second. One
148-by-148 image moves behind the static dial's two apertures; no animated GIF
is packaged in the APK. There is no millisecond source, continuous animation,
or additional service. The balance has an independent editor toggle, is hidden
in ambient, and is omitted at 15% battery or below. Its movement uses WFF's
[Transform Animation](https://developer.android.com/reference/wear-os/wff/common/transform/animation).

The optional companion schedules phone-side work about every 30 minutes using
WorkManager (Android may delay it). Watch providers have no periodic polling:
Data Layer changes trigger updates. Opening/activating a provider can request a
phone refresh, throttled to once per five minutes. Explicit Sync now bypasses
that throttle. Cached totals expire after two hours or at local midnight.
