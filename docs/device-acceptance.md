# Device test checklist

Target: Samsung Galaxy Watch6 Classic SM-R950, Wear OS 6.

## Verified so far

2026-11-13, Windows, Android SDK 36 / build-tools 36.0.0, face 0.1.0, watch
companion 0.1.9.

| Check | Result |
| --- | --- |
| Layout checks (`scripts/test-watchface.mjs`) | Passed |
| Google WFF validator 1.7.0, format 4 | Passed |
| Google memory checker, 10 MiB active / 4 MiB ambient | Passed |
| SDK-native build, signature, no DEX | Passed |
| Gradle resource-only assertion and lint, face | Passed |
| Watch companion unit tests, build and lint | Passed |
| Install and activation, Wear OS 6.0 emulator (454 px round) | Passed |
| Hour contact, minute ring, satellite, minute number, moonlet | Rendered correctly on the emulator |
| Crescent gradient and all three themes | Rendered correctly on the emulator |
| Always-on scene | Rendered correctly on the emulator |
| Core weather, glyphs, forecast bars and precipitation dots | Rendered correctly on the emulator **with constant sample values**; the emulator has no weather source |
| Core unavailable-weather state and digital time | Rendered correctly on the emulator |
| Battery ring at 84% and red at 9%, moonlet hidden at 9% | Rendered correctly on the emulator |
| Rim slots with system battery (ranged) and day-and-date (short text) | Text, icons and progress lines rendered correctly in all four positions on the emulator |
| Foresight animation | Ran correctly on the emulator **with a looping test trigger**, including the hourly readout and the return to now |

Emulator captures: [normal](previews/emulator-normal.png),
[Foresight](previews/emulator-foresight.png) and
[always-on](previews/emulator-ambient.png). They use sample weather values and
test providers, and the icon at 6 o'clock is the emulator's battery-saver
indicator, not part of the face.

Nothing has been tested on the physical watch yet.

## To do on the watch

Install the face and watch companion 0.1.9, then add **Apsis**.

1. **Activation.** The face appears in the picker with its preview and
   activates without an error screen.
2. **Time.** Compare the contact mark, satellite and minute number with a
   reference clock at three different hours, including one where the
   satellite is near the contact mark. Judge minute legibility at a glance.
3. **Seconds.** The moonlet completes one orbit a minute and stays attached to
   the satellite across a minute change.
4. **Weather.** Current temperature, high, low and glyph match the Samsung
   weather app. Note whether hourly forecast bars appear at all, and whether
   bar 1 is the next hour (the meaning of the forecast index is undocumented).
5. **Rim slots.** Defaults resolve to Samsung Health steps, Emberphase minutes
   and calories, and sunrise / sunset. Check each for clipped or mirrored text,
   icon placement, and that the progress line matches the source app.
6. **Editor.** All four rim slots can be selected and highlight in the right
   place. Color, Core, Seconds moonlet and Forecast hour marks all apply.
   No label shows a formatting error.
7. **Foresight.** Tap the core. The contact point runs ahead eight hours and
   returns within about six seconds; the core reads out each hour. A tap in
   always-on only wakes the watch. A second tap mid-run is ignored.
8. **Always-on.** Only the circles, five-minute ticks, contact mark, satellite,
   minute number and date remain. Check for burn-in protection shifts clipping
   the rim.
9. **Low battery and power saving.** At 20% the battery ring is amber and at
   10% red. At 15% the moonlet disappears and Foresight stops responding.
   Turning power saving on hides the moonlet; turning it off restores it.
10. **Battery life.** Compare a day of wear with the previous face, with the
    moonlet on and off.
11. **Coexistence.** The earlier Emberphase faces, if installed, still receive
    companion data after the companion update.
