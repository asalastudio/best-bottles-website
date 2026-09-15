# Homepage hero water and lighting

## Current local revision

The transparent product overlays were rejected because the glass bodies looked like faint outlines against the rock. The default hero now uses one opaque, reference-guided editorial scene. The scene contains two Empire 50 mL bottles, a gold spray pump and a silver-collar black vintage bulb, with an accompanying gold cap. The existing headline and destinations remain.

- Asset: `public/assets/homepage/hero-empire-water-rebuilt.webp` (2688 × 1152, 424,158 bytes).
- Generated using GPT Image 2.5, Sunburst, max quality.
- Generation lineage and prompts: `hero-empire-water-rebuild.json`.
- First render was rejected for overly broad bodies; the second overshot the width correction; the final revision shortened the bodies to bring their visible proportions closer to the originals.
- Original catalog references were compared with composite previews of `15. GBEmp50SpryShnGl.psd` and `39. GBEmp50AnSpBlk.psd`.

## Presentation

- Dramatic champagne light on a dark wall, irregular obsidian rock and surrounding water.
- Glass edges, heavy bases, contact shadows and reflections rendered together.
- No separate transparent bottle images, mirrored DOM copies or artificial glow overlays.
- Desktop retains the 685px hero height. Below 1100px, copy sits above the scene so both bottles and all controls remain visible.
- CMS-configured slides retain their existing rendering path.

## Motion and review boundary

This correction is a still image. The previous Three.js shimmer layer was removed because it was a rectangular light overlay rather than accurate water motion. Water animation is not included in this revision.

The image is editorial, reference-guided artwork, not a dimensionally locked catalog plate or SKU photograph. It must not be marked user approved or substituted for product-detail imagery. No production release is implied.

## Validation

- Local homepage HTTP 200 at desktop, tablet and mobile viewports.
- Image loads at its expected native resolution with no ghost-product overlays or canvas.
- No browser page errors or horizontal overflow in the checked viewports.
- Desktop and mobile screenshots visually inspected for crop, readable copy, complete closures and glass clarity.
- Scoped ESLint and TypeScript validation completed separately from visual review.
