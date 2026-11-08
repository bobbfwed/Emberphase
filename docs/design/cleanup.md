# Clean visual starting point

Completed 2026-11-07, before generating the PARALLAX concept board.

Removed 67 tracked files belonging to the previous visual design:

* All previous mockup images and mechanical-window reference notes/prompts in
  `Mockup Images/`.
* Every image and interactive/animated preview in `docs/previews/`.
* Every watch-face raster asset in
  `watchface/src/main/res/drawable-nodpi/`, including its picker preview.
* The prior `watchface.xml` layout and `watch_face_info.xml` picker metadata.
* Prior dial, preview, balance-motion, and sweep-preview generators.
* Prior visual/expression tests and the sweep preview's layout model.
* Moon-aperture, mechanical-sweep, prior-face validation, and prior-face device
  acceptance documents.

Also removed obsolete visual/editor labels and the manifest's old artwork icon
reference. Replaced the project README and data-contract document so they no
longer describe or link to the retired face. Updated companion documentation
where it assumed the retired layout or obsolete face build instructions.
The native build script now explains the design pause before any downloads,
signing, or installation work, and no longer calls the retired preview generator.

Retained the Gradle/Android scaffolding, platform setup and inspection tools,
phone/watch health companions, shared model and tests, companion icon, health
setup documentation, and provider findings. The companion icon and mechanical
sweep provider are retained application resources/code, not visual references for
the new face. No companion source or application identity changed.

No prior visual image was opened for design reference. File paths and text were
inspected only to identify what to remove and preserve. The proposal was
generated without reference images after removal. Git history is unchanged and
still permits recovery of the old design; its working-tree files are gone.

The watch-face module is intentionally incomplete until approval. The build guard
is a clear stop, not a replacement face implementation. The new concept artwork
lives only under `docs/design/`, outside Android production resources.
