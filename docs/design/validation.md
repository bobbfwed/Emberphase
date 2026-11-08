# Design-round validation

Round: 2026-11-07. Scope: retire the previous visuals, preserve companions, and
create a concept board, specification, and implementation plan.

| Check | Result |
| --- | --- |
| Retired visual files | All 67 deleted tracked paths are absent from the working tree. |
| Companion source preservation | No changes under `health-common`, `health-phone`, or `health-watch`. |
| Existing pure-Java companion unit tests | 16 passed across `ActivitySnapshotTest`, `HealthPublishTest`, `PowerSaveDeliveryTest`, and `SweepTimingTest`. |
| Native build pause | Calling `Build-WatchFace.ps1` stops at the explicit design-approval guard, before downloads or build/install work. |
| PowerShell syntax | Updated native build script parses without errors. |
| Retained Android XML | Watch-face manifest, lint configuration, and remaining strings parse successfully. |
| Local documentation links | All 17 local links/image references resolve. |
| Concept image | Valid PNG, 1536 by 1024; visually reviewed for time, fold, three docks, and ambient treatment. |
| Proposed dock geometry | Three diameter-104 circular hit regions are disjoint, inside the radius-215 safe circle, and contain their 84-by-54 content bounds. |
| Whitespace | `git diff --check` passes. |

The four existing test classes were compiled and run directly with cached JUnit
4.13.2 and Hamcrest, using the installed Android Studio JBR and Java 17
source/target settings. The sandbox blocked the JBR's `--release 17` archive
access; using source/target settings avoided that environment restriction. This
is a pure-Java logic check, not an Android/Gradle build or API compatibility test.
Ignored test output lives under `artifacts/design-validation/`.

No replacement WFF face, production artwork, APK, device installation, or
publishing work has been completed. Face schema, APK, decoded memory, ambient
pixel coverage, physical rendering, and power measurements are deferred until
implementation is authorized.
