---
name: bestbottles-hero-hover
description: Generate and verify Best Bottles catalog photo hero pairs with matched cap-off and filled capped hover states, using the approved Cylinder reference set and batches of ten products.
---

# Best Bottles photo hero pairs

## Approved reference
Jordan approved four pairs on 2026-09-05: GBCyl9MtlRollMattGl, GBTallCyl9MtlRollGlMatt, GBCyl50SpryMtGl, GBCyl100SpryMtGl. In the Best Bottles repository, `public/preview/cylinder-hover/` contains the eight approved PNGs and interactive review page. `docs/reviews/cylinder-hover-approved-2026-09-05.json` records their SHA-256 hashes. Treat these as the visual reference; preserve them rather than regenerating approved work. User approval is visual acceptance, not proof of perfect pixel geometry or exact background color.

## Source and framing
- Work in batches of ten products (up to twenty images), with a manifest of exact SKU, group, source plate/kit, measurements and output paths.
- Verify current live legacy Best Bottles product identity and dimensions against Convex. Legacy is product truth except intentionally simplified naming. Use master artwork and existing exact-SKU plates/kits for geometry; recover missing evidence/assets from the legacy site with available Firecrawl/Agent Reach tools. Never infer hardware from capacity or thread alone.
- Deliver 2080 x 2288 pixels. Render Madison bone #F5F3EF natively in the scene, with soft natural studio lighting and a subtle feathered contact shadow toward two o'clock. No background replacement, masking, or pasted color rectangles after generation.
- Shared bottle contact baseline at 91% from top; centerline x=1040. Target zero baseline drift. Preserve bottle aspect ratio and body width, including between cap-on and cap-off states.
- Use a natural compressed height progression, not literal capacity ratios. Trial cap-off assembly heights approximately 60% regular 9 mL, 70% tall 9 mL, 75% 50 mL, 85% 100 mL. These are trial targets, not universal size rules. Derive new sizes from verified bare-body dimensions and actual exposed hardware. Same body across applicators must retain its size; don't independently normalize every assembly to equal height.
- Reference measured bare dimensions: regular 9 mL 70 x 20 mm; tall 9 mL 106 x 18 mm; 50 mL 117 x 32 mm; 100 mL 154 x 35 mm. Reverify for new SKUs. Bare height includes neck; capped height is not exposed-pump height.

## Generate pairs
1. Prepare exact-SKU source layouts at target positions before generating. Keep detached caps/tassels within canvas without shrinking the bottle to fit combined bounds.
2. Use image generation/editing tools to render the empty cap-off hero with cap beside it. Preserve the approved photographic glass, authentic cap finish and source hardware.
3. Edit that hero into the hover image using exact assembled artwork as cap-seating reference. Bottle body, baseline, camera and background stay fixed. Remove side cap; seat cap fully; fill with transparent light tan perfume all the way into neck, no partial-fill line across body. Preserve realistic refraction; avoid opaque yellow filling.
4. Inspect for exposed threads under a closed cap, changed body dimensions, cap-color drift, unrealistic roller/pump geometry and background shifts. Correct only failing images. Generation can ignore pixel instructions: measure outputs rather than declaring prompt compliance.
5. Export exact dimensions; if resampling is necessary disclose it, retain originals, and do not alter background. Save prompts, source lineage and selected output hashes.

## Review and UI
- Compare pairs by overlay and hover, plus all products side by side against a baseline guide. Aim under 2% scale deviation, reject over 3%; baseline drift over 2% fails, but visible hover jumping merits correction even below that threshold.
- Default empty cap-off; desktop fine-pointer hover crossfades to filled capped state. Mobile stays default. Honor reduced motion. Failed or unloaded hover images must leave default visible. Preserve product links and SKU identity.
- Test actual desktop hover and touch behavior, file dimensions, loading and visual alignment separately. Passing interaction tests does not establish geometry accuracy.
- Keep trial/review publication distinct from catalog integration, commit, deployment and Convex writes. Do not imply a review page is live catalog publication. Preserve unrelated work.

## Approved precise correction method (2026-09-05)
Jordan explicitly authorized whole-image scale, positioning, and color grading after generation, provided quality is retained. This supersedes the earlier generation-only restriction for framing/color corrections. Use one Lanczos resample from the original, measured body anchors, a shared91% baseline and50% bottle centerline. Correct generator body drift with measured full-frame horizontal/vertical scale as needed; keep hardware identity intact. Extend existing frame-edge pixels if positioning exposes a margin; never use object cutout masks or pasted background rectangles. Apply a global luminance-dependent highlight grade to#F5F3EF, retaining dark product details and natural contact shadows.

Batch-one reference: `docs/reviews/cylinder-hover-batch-01.lock.json` locks twenty approved PNGs. Do not regenerate or overwrite these or the four trial pairs. Continue with ten new products per batch, excluding all approved SKUs. Preserve originals, per-image anchors, transforms, grading coefficients, hashes, and approval record. Verify background-only patches after materializing crop buffers (Sharp stats otherwise measures original input), post-export edge baselines, desktop/touch behavior, reduced motion, and failed-hover fallback. Batch one measured baselines within1px and background patch means within0.5RGB/channel. Natural shadows are not expected to be flat bone.
