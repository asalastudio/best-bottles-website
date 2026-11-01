# Tulip, Sleek and Round dip tube repair

The selected sprayers had hidden or fragmented dip tubes. The PDP renderer passed fractional relative layer priorities into CSS z-index, which accepts integers only. Its sorted layers now receive positive integer stacking values. This preserves behind-glass ordering such as Swirl while allowing clear tube overlays to paint in their intended position.

Local kits for 28 SKUs replace broken tube cutouts with continuous hollow Blender-rendered tubes and translucent cartridges: Tulip 5 ml amber (8), Sleek 8 ml clear (8), Round 78 ml clear (6), and Round 78 ml frosted (6). The tube shares the sprayer component identity and movement. Existing glass, head, cap, component geometry, scale and anchors are unchanged. Builder uses the same assets and already draws SVG layers in sorted order.

Tulip reuses the existing native tube render. New working scenes produce the Sleek and Round tubes. OD/bore is 1.1/0.7 mm for Tulip/Sleek and 1.5/1.0 mm for Round. These dimensions, the cartridge, floor thickness and clearance are visualization estimates. The tube layer is composited onto existing glass imagery; through-glass refraction is approximated, not ray-traced through a complete bottle scene. Owner visual approval remains pending.

## Checks

- 52 focused tests; TypeScript; targeted lint; clean diff formatting.
- 168 PDP states: all 28 SKUs, three views, desktop and mobile. Complete image bounds, one tube, integer stacking, connected movement, above-base placement, no horizontal page overflow and stable cap-on/off glass frame.
- 28 builder kit parity checks; four actual product-page handoffs.
- Eight shared-stage regressions for 9 ml clear/Swirl and 5 ml clear/cobalt rollers.
- Every seated variant inspected on a contact sheet; representative exploded, mobile and builder screenshots inspected.

These checks do not constitute full-catalog approval. No backend records, live media, production domain or deployment were changed.

## Restore

Restore the original catalog checkpoint and catalog follow-up packages first, then this package:

```sh
node docs/reviews/dip-tube-followup-2026-10-31/restore.mjs
node docs/reviews/dip-tube-followup-2026-10-31/restore.mjs --apply
npm run dev -- --port 3010
```

The dry run verifies all hashes. Applying it backs up conflicting files before replacement. The local override loader refuses Vercel. Review/media files are excluded from deployment uploads.

Open `/reviews/dip-tube-followup-2026-10-31/index.html` on localhost for the before/after comparisons, all 28 product links, per-SKU CSV and screenshots. The meeting audit adds evidence to four affected product groups without setting reviewer decisions.

`evidence/` contains the scripts and checks. The working render script reuses the existing local studio export helper; its original absolute source paths are recorded in the script. Full native Blender scenes remain in the local working output and labeled Drive backup, not this Git package. Originals remain intact.
