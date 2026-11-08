# Preserved data contracts

This document records reusable data behavior for the redesign. Former layout and
rendering instructions have been removed. The new face's assignment, rendering,
and acceptance work are specified in [the design plan](design/implementation-plan.md).

## Existing providers

| Data | Existing source | Contract / limitations |
| --- | --- | --- |
| Steps | Installed Samsung Health steps complication; system step-count fallback | Use typed values and real supplied targets. System totals may differ from phone-merged Samsung totals. |
| Active minutes | `com.bobbfwed.emberphase.health.watch.MinutesDataSource` in companion package `com.bobbfwed.emberphase.health` | Whole active minutes and a supplied daily goal; requires companion setup and consent. |
| Active calories | `com.bobbfwed.emberphase.health.watch.CaloriesDataSource` in the same package | Activity kcal and supplied daily goal; excludes resting energy. |
| Power saving | Existing watch companion `PowerSaveDataSource` | Event-driven ranged value 0/1; no periodic polling. A future face must subscribe and verify delivery if it uses it. |
| Weather | System-fed WFF `WEATHER.*` or a user-chosen weather complication | Native fields and a complication's formatted text are separate interfaces. Never split formatted strings into assumed numeric fields. |

See [recorded Samsung provider declarations and device observations](device-providers.md)
for the exact inspected components and firmware. Those observations describe the
previous installation and are not acceptance results for PARALLAX.

## Typed values and missing data

* `GOAL_PROGRESS`: keep the actual value and provider target; cap only the drawn
  fill. Totals can exceed goals. Invalid or missing targets mean no goal fill.
* `RANGED_VALUE`: normalize using the provided minimum and maximum. A range
  maximum is not automatically a personal goal.
* `SHORT_TEXT`: display provider text and title without parsing numeric meaning.
* Empty, expired, denied, and unsupported values remain unavailable, represented
  as a dash or an explicitly empty slot. Never substitute mockup samples or zero.

An earlier Samsung-specific compatibility option interpreted a zero-based range
maximum as the steps target after a one-setting device comparison. Do not carry
that assumption into the new design automatically; verify the chosen provider
and any compatibility option first.

## Companion freshness

The existing phone companion reads dated activity totals and goals with consent
and sends them over paired-device Data Layer. Cache validity ends at the earlier
of three hours and source-local midnight; display-date mismatch is also rejected.
The watch schedules an explicit no-data timeline replacement on expiry. A new
face should reuse these providers and expiry semantics without changing the
health pipeline. See [companion behavior and setup](health-companion.md).

The face itself remains resource-only. No direct Samsung database access, raw
health records, backend, new health permission request, or estimated health
scores are needed for the proposed design.

## Platform references

* [WFF system data sources](https://developer.android.com/reference/wear-os/wff/common/attributes/source-type)
* [WFF complication rendering](https://developer.android.com/training/wearables/wff/complications)
* [Complication data fields](https://developer.android.com/reference/wear-os/wff/complication/complication)
* [Samsung activity summary](https://developer.samsung.com/health/data/api-reference/-shd/com.samsung.android.sdk.health.data.request/-data-type/-activity-summary-type/index.html)

Only Google's sources were rechecked for this design round. Samsung behavior is
preserved repository evidence, with its original verification limits.
