# PARALLAX implementation plan

Status: authorized 2026-11-07. Follow [stage progress](progress.md) for checked
implementation commits. Physical-watch acceptance awaits watch availability.

## 1. Prove the layout and fold in WFF

After approval, restore a fresh `watchface.xml`, picker metadata, icon, and editor
strings in the existing WFF 4 resource-only module. Keep the current package ID,
API 36 baseline, and existing companion identities. Use a new version code above
33 when an installable replacement is ready. PARALLAX remains a working display
name until approved; no application ID migration is planned.

First make a static 450-unit scene with time, date, battery, and three dock
positions. Recreate all artwork from the new specification. Add the fold using
native line groups and WFF transforms driven by local hour/minute fields. Treat
the two ruled surfaces as economical geometric groups around a moving crease;
avoid shader, mesh, or frame-by-frame animation dependencies.

The first technical gate is whether native transforms can maintain the fold's
silhouette at every minute, with the fold above the time numerals and clear of
complication text. If they cannot, test a small
set of discrete line-art fold poses, with a minute-updated position marker, and
measure decoded memory before choosing that fallback. Report any visible
difference from the approved concept. Do not commit a large animated image set
or silently promise arbitrary mesh deformation in WFF.

Deliverable: fresh active layout and minutely changing fold, schema validated.

## 2. Implement three independent complication docks

Define stable, new slot IDs (proposed 101–103) and real provider-specific
`DefaultProviderPolicy` entries. Verify the installed steps component and
supported payload before setting its default. Minutes/calories use the retained
companion providers with EMPTY fallback. Do not reuse historical selections as
proof the new slot configuration works.

Implement SHORT_TEXT, RANGED_VALUE, GOAL_PROGRESS, MONOCHROMATIC_IMAGE, and EMPTY
per dock. Preserve provider text, titles, units, and tap actions. Normalize
ranges, cap visual progress only, reject invalid goals, and show unavailable data
honestly. Do not parse arbitrary provider text into numbers.

If power-saving integration is enabled, reserve a fourth, non-customizable
internal slot for the existing event-driven provider. It must be connected in a
way the Wear OS runtime actually subscribes to; do not assume a fully hidden slot
remains active. Its selection bounds must not intercept the three user docks.
With or without that integration, three slots remain user customizable. Do not
connect the legacy mechanical-sweep provider to the new face.

Deliverable: configurable docks, tested selection geometry, missing-data states,
and normal provider tap actions. No health companion changes are expected.

## 3. Ambient, power, and editor behavior

Create a sparse ambient variant with time/date/battery in the approved positions.
Remove the presentation board's white boundary circle. Measure lit-pixel coverage
at representative and worst-case digit combinations, including `88:88` as a
stress glyph set. Target under 10%; remain within the platform's 15% ceiling.
Verify on-screen outline legibility before choosing it over thin solid type.

Add accent, fold visibility, time format, and signature settings. Check 12-hour
AM/PM placement, translated dates, leading zeros, 00:00 / 12:00 / 23:59, and
unavailable battery values. Apply the 20% fold cutoff. Reuse the companion's power
signal only if runtime delivery is verified. Handle a missing companion without
inventing its state. Ambient is always sparse regardless of that signal.

Deliverable: predictable active/ambient, threshold, editor, and missing-source
behavior with no continuous animation.

## 4. Build validation and previews

Write fresh visual asset/preview generation only for the approved design. Restore
the native build's generation stage if needed; it currently deliberately stops
when the new face definition is absent. Audit all resource references and verify
the WFF schema, APK resource-only status, signing, lint, and memory footprint.
Use Google's pinned validation tools already supported in `scripts/Get-WffTools.ps1`.

Add meaningful checks for day-fold endpoints and monotonic travel through a
normal clock day, civil-time DST/time-zone behavior, disjoint dock hit regions,
complication text clearance, typed progress, no-data behavior, and ambient visibility. Keep
the current companion tests. Recreate active/ambient, empty-data, alternate-data,
low-battery, and 12-hour previews; label synthetic readings as samples.

Deliverable: validated candidate APK, reproducible preview artifacts, and recorded
results. A concept PNG is not a runtime acceptance result.

## 5. Physical-device acceptance

Use the Watch6 Classic/API 36 target recorded in the repository, plus another
size or emulator profile when available. Inspect at actual wrist-reading size.
Verify all time glyph pairs fit; dates, units, and long provider text stay inside
bounds; docks are separately selectable; a provider swap changes labels; and tap
actions open the intended provider.

Compare live health values/goals with the existing companion, then check no
companion, denied permission, expiry, midnight, over-goal values, reconnect, power
saving, and active-to-ambient transitions. Existing companion tests and previous
device results do not replace this validation. Measure battery use with debugging
off over a representative interval before making efficiency claims.

Deliverable: acceptance record and any small-screen adjustments needed to retain
legibility and usable selection targets. Commit each completed implementation
round after its relevant checks, as required by `AGENTS.md`.

## Scope boundaries

This proposal requires no new data service, Samsung permissions, sensor polling,
server, location access, or moon calculation. Existing health bridge code,
application IDs, Data Layer paths, signing relationships, and expiry rules are
retained. Its unused mechanical-sweep service remains for compatibility; it
should not drive this design. Companion UI branding and removal of that service
can be considered separately after the face works.

## Verified platform references

Reviewed 2026-11-07. These support feasibility, not a completed implementation.

* [System data sources](https://developer.android.com/reference/wear-os/wff/common/attributes/source-type): local time/date and battery data.
* [Complication slots](https://developer.android.com/reference/wear-os/wff/complication/complication-slot): native configurable areas, at most eight slots total. Proposed allocation is three user docks plus at most one internal power signal.
* [Complication rendering](https://developer.android.com/training/wearables/wff/complications): supported provider payloads and presentation responsibilities.
* [Ambient requirements](https://developer.android.com/training/wearables/wff/ambient): sparse ambient content, variants, and the illuminated-pixel ceiling.

## Current-round validation

See [validation record](validation.md) for checks performed on the cleanup and
design deliverables. Face schema, APK, memory, device rendering, and power tests
belong to the implementation rounds above and have not been run for PARALLAX.
