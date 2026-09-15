# Family + collection cards — locked recipe

Source of truth: Figma "08 — Material System" board (page 3:54, frame 4:12). Locked values:

- Background: Bone **#F5F3EF**, seamless wall + floor, no gradient, no wall shadows, no props.
- One neutral daylight from upper-left, one soft contact shadow, camera at bottle mid-height, straight on.
- One low material base occupying no more than the lower quarter; bottles on a straight baseline.
- Heights established once per shape/capacity; never non-uniform scaling; glass edges visible.
- Material signatures (board pairings): Cylinder → Curly Maple · Circle → Travertine Navona ·
  Empire → Sahara Noir · Boston Round → Figured Claro Walnut · Cream jar → Statuario ·
  pale stone: Elegant, Glass spray, Lotion pump · neutral pale stone: Round, Diva, Grace, Roll-on ·
  warm pale sandstone: Apothecary, Decorative · silver travertine: Atomizers · maple: Vials ·
  bone studio: Accessories & packaging.

Pipeline: `subjects.json` (ref card + material) → `generate.mjs` (gpt-image-2.5-sunburst edits,
current card = shape authority, `recipe.txt` = environment only; families 1024×1536, collections
1536×1024) → `finish.py` (crop to 4:5 / 4:3 centred on content, webp, review sheet + bg readings).

Outputs are copied to `public/assets/homepage/<name>-bone-v2.webp` (versioned to bust caches);
`FAMILY_ART` and the collection fallback in CollectionShopping point at them. PNG masters are
gitignored and parked in `.local-assets/card-masters/2026-09-13/`. Splash-On has no approved art
yet and still uses `source-splash-on-bottles`.

Set v1: 2026-09-13. Background readings across all 18 renders: #F1EFEB–#F5F3EF.
