# Implementation stages

Authorized 2026-11-07. Work proceeds sequentially, with a checked commit per stage.
The watch became available on 2026-11-07. Installation and physical rendering
smoke checks are recorded in device-acceptance.md; extended checks remain open.

| Stage | Status | Evidence |
| --- | --- | --- |
| 1. Layout and native fold | Complete | WFF 4 schema passed; all 1,440 minute positions checked; local rendering inspected. Native lines only, no animation image set. |
| 2. Complication docks | Complete | WFF schema, numeric/empty/type/title-switch tests, and visual check passed. Watch companion build, unit tests, and lint passed. |
| 3. Ambient, power, editor | Complete | Schema and time/visibility tests passed. Browser ambient coverage: 3.085% sample, 3.525% outline stress, 4.590% thin-solid stress. Hardware results pending. |
| 4. Build and previews | Complete | Native/Gradle APKs, schema, signature, resource-only, memory limits, lint, model/browser/resource checks, and 12 state previews passed. See implementation-validation.md. |
| 5. Device readiness | Installed; extended acceptance open | Face/code 39 and watch companion 0.1.9 installed and activated; active/ambient screenshots, live Steps/MIN progress, no-data fallback verified. Offload/battery follow-up remains. |

Stage 2 adds MIN/KCAL titles to the watch companion's existing GOAL_PROGRESS
payloads (watch companion 0.1.9). Its consent, health reads, sync, expiry, and tap
behavior are unchanged. Older providers with no title display GOAL or RANGE;
arbitrary user-selected providers never inherit a metric label from a default.
Samsung's default steps component uses the preserved inspected declarations;
rechecking current on-watch availability remains part of physical acceptance.

Power behavior uses the native watch battery threshold (fold off at 20% or less)
and sparse ambient rendering. An internal power-saving companion subscription is
deliberately not enabled without runtime delivery verification on the watch.
The face introduces no continuous motion, timers, or services. An always-on
outline/solid option is available for final hardware legibility checks.

Stage 4 widened both time boxes to 156 units after measuring every valid digit
pair in the bundled font. Numerals now keep a constant font size across the day.
The final preview coverage is 2.937% sample, 3.452% outline stress, and 4.556%
thin-solid stress. The portable gallery is `docs/previews/index.html`.

The five implementation commits correspond to stages 1–5. Final preflight also
removed the parent complication tint so progress and label colors remain under
their own styling; provider icons retain their explicit monochrome tint.
The title bridge and both candidate package identities/signatures are preserved.
The installation round fixed native rich-text whitespace, expression string
quoting, Boolean configuration comparisons, and progress clamping. The native
ambient capture measures 3.150% lit pixels. Hardware offload was not accepted;
longer battery and the remaining acceptance matrix are still open.
