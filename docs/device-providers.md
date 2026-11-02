# Installed provider declarations

Inspected 2026-11-01 over authorized wireless ADB. Device identity: Galaxy Watch6
Classic SM-R950, Android API 36, firmware R950XXS2CZF5. Installed Samsung Health:
7.1.1.001. Samsung Weather: 1.1.30.62.

The service list was queried through Android Package Manager. Supported types
were read from the installed APK manifests, with ZIP CRC verification and
Android SDK `aapt2` decoding. Only ZIP directory metadata and manifest contents
were retrieved; no application code, health records, or weather records were
copied. Raw inspection artifacts stay in the ignored `artifacts` directory.

## Requested metrics

| Provider | Declared supported types | Finding |
| --- | --- | --- |
| Samsung Health Steps | `GOAL_PROGRESS, SHORT_TEXT, LONG_TEXT, RANGED_VALUE, ICON` | A compatible numeric steps/goal interface is declared. Actual values and target synchronization still need a live comparison. |
| Samsung Health Daily Activity | Normal declaration: `ICON`. Safe-watch-face declaration: `ICON, SHORT_TEXT, LONG_TEXT, SMALL_IMAGE` | No `GOAL_PROGRESS` or `RANGED_VALUE` declaration. Text or imagery must not be treated as three independently addressable activity values and goals. |
| Samsung Weather | `LONG_TEXT, SHORT_TEXT` | The complication exposes formatted text fields, not independent typed temperature/high/condition fields. Native WFF weather remains a separate interface to test. |

Both normal and safe-watch-face metadata for Steps include `GOAL_PROGRESS`.
All three services declare `UPDATE_PERIOD_SECONDS=0`; this does not prove
their refresh latency or actual runtime payloads.

Components, verified on this installation:

```text
com.samsung.android.wear.shealth/com.samsung.android.wear.shealth.complications.steps.StepsComplicationProviderService
com.samsung.android.wear.shealth/com.samsung.android.wear.shealth.complications.dailyactivity.DailyActivityComplicationProviderService
com.samsung.android.watch.weather/com.samsung.android.watch.weather.complication.WeatherComplicationService
```

No separately named active-time or activity-calorie complication service was
found in the installed Samsung Health provider list. This is evidence about
this installed version, not a claim about all Samsung firmware or every
possible configuration of the Daily Activity provider.

## Remaining verification

Select Samsung Health Steps on the face, request its supported numeric type,
and compare both value and goal to Samsung Health. Change the goal to test
synchronization. Inspect Daily Activity's chooser/configuration before deciding
whether a separate phone bridge and watch complication provider are necessary
for the three requested totals and goals. Do not parse formatted text or infer
numeric goals from images.

For weather, compare native WFF current temperature, daily high, condition,
units, and stale/unavailable behavior on the watch. The existence of Samsung's
Weather complication does not establish that the platform's `WEATHER.*` object
is populated, or establish the semantics of a particular text/title payload.

This inspection does not install an app, change the active face, change health
goals, or verify live data. The implementation's defaults remain unchanged.

Reproduce the manifest inspection after an app/firmware update:

```powershell
node .\scripts\Inspect-ProviderManifests.mjs WATCH_IP:CONNECTION_PORT
```

The helper reads APK fragments in 4 KiB blocks, validates the manifest's ZIP
checksum, and uses a manifest-only ZIP for local `aapt2` inspection. It fails
explicitly if the archive layout or manifest parser is unsupported. Node and
Android SDK build-tools 36.0.0 are development-only requirements.
