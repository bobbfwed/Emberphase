# Mechanical-window concepts

Three visual options for a small timekeeping mechanism glimpsed through the
unused dial area beside the hands' pivot. Each sheet shows two static positions:
the left opening exposes the moving metal on even seconds, the right on odd
seconds. The openings remain fixed and dark; the mechanism moves behind them.

| Concept | Character | Preview |
| --- | --- | --- |
| 01 — Hidden balance rim | Curved recesses revealing a short toothed metal arc; the most recognizable mechanical detail. | [Two timing states](01-hidden-balance-rim.png) |
| 02 — Escapement ports | Tiny horizontal service ports with a steel pallet shoe briefly entering view. | [Two timing states](02-escapement-ports.png) |
| 03 — Counterweight slots | Narrow curved slits revealing only the edge of a hidden balance weight; the least exposed machinery. | [Two timing states](03-counterweight-slots.png) |

These are concept mockups for choosing the opening shape and exposed component.
Generated images can vary the existing typography, proportions and placement
slightly; those incidental differences are not proposed changes to the face.
The example data is illustrative. Concept **01 — Hidden balance rim** was
selected and implemented in version 0.4.8. See the
[full-face animation](../../docs/previews/balance-motion.gif) and
[enlarged detail](../../docs/previews/balance-detail.gif) generated from the
production artwork and motion settings. Clock hands are held still in these
previews to make the new movement easier to see.

## Motion to review after choosing a concept

- Alternate the visible side once per second, completing a left/right cycle in
  two seconds. Keep a short mechanical movement followed by a settled position.
- Suggest a shared balance/escapement hidden underneath the dial, without a
  swinging pendulum rod or a large exposed mechanism around the spindle.
- Use dim steel and warm metal reflections, with a dark recessed lip. Preserve
  room around the calendar, weather, activity values and battery gauge.
- For the battery-conscious implementation, use the existing once-per-second
  cadence; keep the mechanism still/hidden in always-on mode and at low battery.
  Exact movement and implementation should follow the selected visual concept.

Created with the built-in image generation tool. Full prompts are saved in
[PROMPTS.md](PROMPTS.md). The implemented assets are generated separately by
the repository's PowerShell artwork scripts.
