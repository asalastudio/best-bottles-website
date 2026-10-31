# Catalog follow-up checkpoint

This package preserves the next localhost review state after the original October 31 checkpoint. It contains local candidates, verification, and an incomplete catalog audit. It does not authorize a merge or publish media.

## Implemented and checked

| Area | Local result | Verification |
| --- | --- | --- |
| 2 ml 8-425 clear and amber | New Sunburst images registered to 35 × 11.64 mm, with the supplied 8.96 mm neck reference. Approved 40.24% glass height and 91% baseline retained. | Four black/white cap SKUs; 32 desktop/mobile view and navigation checks. |
| Separate short amber 13-425 vial | Complete 22 × 16 mm body replaces the clipped strip. Original white cap retained. | Six desktop/mobile views; body and thumbnail inspected. |
| 5 ml Cylinder rollers | Removed obsolete glass-neck overlays from 36 roller rows. Approved clear/cobalt v19 bodies and roller inserts retained. | All 71 Cylinder configurations compared with builder data; six browser handoffs. |
| Tulip 5 ml sprayers | Thin Blender tube replaces broken cutout for all eight finishes. Head, collar, cartridge and tube move together. | 24 views; desktop/mobile spacing and stable bottle placement checked. |
| Exploded stage | Visible separation between detached units; fixed bottle scale and baseline. Mobile specifications sit below the stage, clear of the artwork. | Layout regression tests, mobile/desktop screenshots, zoom reset and catalog navigation. |

The new 2 ml artwork is generated 2D imagery registered to a measured envelope, not a dimensionally exact new Blender mesh. The raw image proportions required small display-width calibrations, recorded in `registration.json`. Cap dimensions and some neck seating remain visually inferred.

The short amber vial uses the native image-generation tool, guided by its exact legacy photograph and a dimensioned Blender candidate. It is not a Sunburst output: the requested Sunburst call failed because API credit was exhausted. Its legacy description says 1.5 ml while the capacity field says 2 ml. Commerce data was not changed.

The Tulip tube has a 1.1 mm outside diameter, 0.7 mm bore and 1.2 mm gentle tip bend. Its tip is 3.5 mm above the exterior base. Interior floor and pump-housing measurements are inferred, not supplier verified.

## Audit coverage and unresolved work

The cobalt/blue inventory contains 117 SKUs across 24 product groups. A representative product from each group was visually captured: 17 interactive groups and seven older galleries. This is not individual approval of every finish. The Boston Round 15 ml dropper cutouts still have visible fragments, and the 4 ml blue dropper still needs the approved body and a complete pipette. Several older kits do not expose an exploded view. See the per-SKU CSV/JSON in the review page and evidence.

The amber inventory snapshot contains 117 records, including one cream jar: 116 bottle SKUs across 19 bottle groups. This pass checks 13 amber SKU variants across four groups: 2 ml screw-cap vials, 4 ml screw-cap vials, the separate short amber vial, and Tulip fine-mist sprayers. Other amber products have not received a complete review in this pass. Earlier 9 ml Cylinder work remains preserved; this coverage count does not overwrite its prior approvals.

The original checkpoint remains unchanged. Its earlier 2 ml images are superseded by this package. The 4 ml four-color screw-cap family remains in the original checkpoint, with its recorded 64 product-page checks.

## Restore and review

Restore the original checkpoint first, then this follow-up from the repository root:

```sh
node docs/reviews/catalog-checkpoint-2026-10-31/restore.mjs --apply
node docs/reviews/catalog-followup-2026-10-31/restore.mjs
node docs/reviews/catalog-followup-2026-10-31/restore.mjs --apply
BUILDER_LOCAL_KITS="$PWD/public/local-kits/vial-2ml-source-2026-10-31/kits.json" npm run dev -- --port 3010
```

The dry run verifies checksums before any writes. Applying the package backs up conflicting local files. It restores only `public/local-kits/` and `public/reviews/`; it does not change databases or remote assets. The local kit loader refuses Vercel environments.

Open `http://localhost:3010/reviews/catalog-followup-2026-10-31/index.html` for the visual review and per-SKU cobalt findings. The corrected Tulip is at `/products/tulip-5ml-amber-13-415-finemist?cap=matte-gold`; select **Exploded**.

`manifest.json` covers 175 archived files, including 87 restorable files. Scripts and compact evidence are archived separately; TypeScript evidence uses `.ts.txt` so it is not compiled as application source. Personal source photographs and full Blender scenes remain local. `local-scene-inventory.json` records the two new working scenes and hashes; it is not a remote backup. Existing raw outputs and originals were preserved.

The earlier CI failure was fixed in `3fbbbf06`: two archived scripts used an absolute Mac import path. GitHub CI run `41242534996` passed Typecheck, Lint, unit tests, and production build on that commit. Validation for this follow-up is recorded separately in `verification.json`; no earlier CI result is treated as verification of a later commit.
