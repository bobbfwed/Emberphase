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

The Apsis face has four customizable rim slots. Each accepts `GOAL_PROGRESS`,
`RANGED_VALUE`, `SHORT_TEXT`, and `EMPTY` complications. The lower-left slot
prefers the verified Samsung Health Steps provider's `GOAL_PROGRESS` type, with
the system `STEP_COUNT` provider as a fallback. The upper-left and lower-right
slots prefer the optional Emberphase Health companion's active-minutes and
active-calories `GOAL_PROGRESS` providers, falling back to empty when
unavailable. The upper-right slot defaults to the system sunrise / sunset
provider. Selected sources persist through updates; changing a default does not
force them to change. See [companion setup](health-companion.md).

* `GOAL_PROGRESS`: render the supplied numeric value; fill the progress line to
  value / target, clamped to 0–100%, so the numeric total can exceed the target.
  Invalid or zero targets have no fill.
* `RANGED_VALUE`: render supplied text (or its numeric value when text is empty)
  and fill the progress line using its minimum and maximum. A range maximum is
  not presented as a personal goal.
* `SHORT_TEXT`: display the provider's text. Do not parse it for numbers or infer
  a goal. No progress line is drawn.
* Empty/unavailable: `—`, no fabricated zero or sample value.

Each slot also shows the provider's title and monochromatic icon when supplied.
[WFF complication fields](https://developer.android.com/reference/wear-os/wff/complication/complication).
Each slot subscribes to one provider and draws everything inside its own arc
bounds, because the runtime clips a slot's content to its bounding shape. On
the tested runtime a `BoundingArc` band is measured inward from the given
diameter, not centred on it.
[Bounding areas and clipping](https://developer.android.com/reference/wear-os/wff/complication/bounding).
The two fixed slots (tap trigger and power saving) carry one number each to the
rest of the scene through a WFF 4 `Reference` on an empty group's angle.
See [WFF references](https://developer.android.com/reference/wear-os/wff/common/reference/reference).
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

The core and the forecast hour marks use native WFF weather, available since
WFF 2. These are system-fed, not a weather API polled by this face.

* Core: `WEATHER.TEMPERATURE`, `WEATHER.DAY_TEMPERATURE_HIGH`,
  `WEATHER.DAY_TEMPERATURE_LOW`, `WEATHER.CONDITION` and `WEATHER.IS_DAY`.
  Temperatures are in the watch's unit. All documented condition values 1–15
  have a vector glyph, with a night variant for clear skies; an unknown
  condition draws none. `IS_AVAILABLE` gates access and `IS_ERROR` marks
  available-but-stale data with `!`. When unavailable the core shows dashes.
* Forecast hour marks and Foresight: `WEATHER.HOURS.1` to `WEATHER.HOURS.8`
  fields `IS_AVAILABLE`, `TEMPERATURE`, `CONDITION` and `CONDITION_NAME`. The
  format documents hourly data for up to eight hours and no per-hour chance of
  precipitation, so the precipitation dot is derived from the condition. The
  meaning of index 0 is not documented, so the face starts at index 1. Bar
  length is the hour's temperature between today's low and high, clamped.

Hourly forecast availability on the Samsung firmware remains a device
acceptance check. An hour without data shows only its plain tick.

Sources: [WFF weather availability and staleness](https://developer.android.com/training/wearables/wff/weather),
[weather source fields](https://developer.android.com/reference/wear-os/wff/common/attributes/source-type),
[default provider policy](https://developer.android.com/reference/wear-os/wff/complication/default-provider-policy).

## Battery policy

The watch-face APK has no executable application code, networking permission,
location polling, heart rate sampling, alarms, or wake locks. Native clock
sources and provider/system updates drive the face.

Power saving is a fixed watch-companion value with no periodic refresh. The
companion reads Android power-save mode and the watch's low-power settings, and
publishes a change when one of those changes. Its slot must sit on the dial,
inside the circle, so the runtime keeps it active: a corner slot is clipped and
never activates.

The optional companion schedules phone-side work about every 60 minutes, with a
15-minute flex window, using WorkManager (Android may delay it further). That
periodic read also waits while the phone battery is low. Watch providers receive
Data Layer pushes and a 60-minute system refresh fallback that checks the local
cache. Raising the watch does not ask the phone for a new reading while that
cache is still fresh. A stale cache can request one at most every 15 minutes.
Explicit Sync bypasses that gap and the low-battery wait. Sleep, theater, and
power-saving modes are system states. The watch companion reports Android
power saving only when that mode changes. Cached totals expire after three
hours or at local midnight. An explicit unavailable-data timeline entry
replaces expired totals even without a subsequent push. See
[overnight sync setup](health-companion.md).

## Tap trigger

The watch companion's `SweepDataSource` is a fixed, watch-local complication
with no periodic updates. A tap supplies a timestamp for six seconds through a
short complication timeline, which then returns to idle. The timestamp is
milliseconds within the UTC day, plus one, so zero means idle; the provider
uses the reserved range 0–86,400,000, which a face checks before consuming the
value. A face derives a 0–1 progress value from it and may use a millisecond
source only inside that temporary branch. There are no phone health queries or
sensor subscriptions.
