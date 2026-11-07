# Platform constraints

These are the engineering limits for the Emberphase watch face. They do not
specify a visual design. The previous scene, artwork, mockups, and preview
generators were removed on purpose and must not be recovered from Git as a
design reference.

## Face package

* Package `com.bobbfwed.emberphase`. Resource-only Watch Face Format 4. No DEX,
  no networking, no location, no sensors, no alarms, and no wake locks.
* `minSdk` and `targetSdk` 36. Wear OS 6. The tested device is a Galaxy Watch6
  Classic SM-R950 (round, 480×480) paired with a Galaxy S24 Ultra.
* The scene is a 450-unit square scaled to the round display. Center is
  (225, 225). The physical rotating bezel is not readable by WFF. Keep primary
  content inside the circular clip, with margin from the bezel edge.
* Google's WFF memory budgets used by this repo are 10 MiB active and 4 MiB
  ambient. Validator 1.7.0 can exit zero on schema failure; the build must
  also inspect the report text.
* WFF expression strings use double quotes, written `&quot;` in XML. Samsung
  formats editor labels even when `formatted="false"`, so a `%` in a label
  crashes the editor. Spell the word "percent".
* When battery life and motion conflict, choose battery life. Ambient mode
  must stay sparse for AMOLED burn-in and Samsung display offload. Measure
  lit area on a preview before calling an ambient design acceptable. There is
  no millisecond clock in ordinary timekeeping. Do not run a continuous
  animation.

## Data the face can show without inventing values

| Data | Source | Notes |
| --- | --- | --- |
| Time and date | WFF clock fields | Native. No network. |
| Battery percent | WFF battery source | Native. |
| Current weather, daily high, condition, unit, availability, error | WFF `WEATHER.*` | System-fed. Works on the tested watch. Unavailable and stale are separate states. |
| Steps and step goal | Complication, not `STEP_COUNT` | On this watch, native `STEP_COUNT` / `STEP_GOAL` returned 0 while Samsung Health Steps returned a live `RANGED_VALUE` whose maximum matched the Samsung Health goal (6,000 at the time of the check). Samsung Health Steps declares `GOAL_PROGRESS`, `SHORT_TEXT`, `LONG_TEXT`, `RANGED_VALUE`, and `ICON`. An existing face can keep a ranged selection after a default-policy change. |
| Active minutes and goal | `com.bobbfwed.emberphase.health` / `.watch.MinutesDataSource` | `GOAL_PROGRESS` and `SHORT_TEXT`. Phone companion reads Samsung Health. Unknown stays unavailable. Do not show a fabricated 0. |
| Active calories and goal | same package / `.watch.CaloriesDataSource` | Active kcal, not total or resting calories. Same rules as minutes. |
| Power saving | same package / `.watch.PowerSaveDataSource` | `RANGED_VALUE`, no periodic refresh. Publishes 0 or 1 when Android power saving or the watch low-power settings change. The slot must lie on the circular face. A clipped corner slot never activates and leaves the value at 0. |
| Tap timestamp | same package / `.watch.SweepDataSource` | `RANGED_VALUE`, no periodic refresh. A tap can publish a short-lived timestamp. This is a channel, not a required animation. |

Samsung Health Daily Activity does not expose three separate numeric fields.
Samsung Weather's complication is formatted text, not typed temperature fields.
Do not parse a provider's formatted string into numbers or invent a goal.
`GOAL_PROGRESS` may exceed its target; clamp only the drawn fraction.
`RANGED_VALUE` normalizes with its own minimum and maximum. `SHORT_TEXT` is
text only. Empty data stays empty.

Companion facts that the new scene must not break:

* Phone and watch companions share `com.bobbfwed.emberphase.health` and the
  same signing certificate. Data Layer path `/emberphase/activity/v1`.
* Phone sync is about every 60 minutes with a 15-minute flex, and it waits
  while the phone battery is low. Unchanged totals are not rewritten while the
  last push has more than 75 minutes of life.
* Watch cache expires at the earlier of three hours and local midnight. The
  provider also schedules an explicit `NO_DATA` timeline entry at expiry.
* The face cannot call the Samsung Health SDK. Health totals arrive only
  through complication providers.

Full contracts: [data-sources.md](data-sources.md),
[device-providers.md](device-providers.md),
[health-companion.md](health-companion.md).
