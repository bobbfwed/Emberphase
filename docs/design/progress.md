# Implementation stages

Authorized 2026-11-07. Work proceeds sequentially, with a checked commit per stage.
No physical watch is available. No watch connection or installation will be attempted.

| Stage | Status | Evidence |
| --- | --- | --- |
| 1. Layout and native fold | Complete | WFF 4 schema passed; all 1,440 minute positions checked; local rendering inspected. Native lines only, no animation image set. |
| 2. Complication docks | Complete | WFF schema, numeric/empty/type/title-switch tests, and visual check passed. Watch companion build, unit tests, and lint passed. |
| 3. Ambient, power, editor | Pending | |
| 4. Build and previews | Pending | |
| 5. Device readiness | Pending | Physical-device acceptance remains pending watch availability. |

Stage 2 adds MIN/KCAL titles to the watch companion's existing GOAL_PROGRESS
payloads (watch companion 0.1.9). Its consent, health reads, sync, expiry, and tap
behavior are unchanged. Older providers with no title display GOAL or RANGE;
arbitrary user-selected providers never inherit a metric label from a default.
Samsung's default steps component uses the preserved inspected declarations;
rechecking current on-watch availability remains part of physical acceptance.
