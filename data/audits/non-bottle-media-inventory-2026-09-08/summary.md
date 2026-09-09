# Non-bottle media inventory — 2026-09-08

Read-only audit of current Packaging, Accessory, and Component products against the live catalog media state, the master PSD library, and the current legacy BestBottles accessories listings.

## Current catalog scope

- 180 canonical non-bottle product records: 47 Packaging, 3 Accessories, and 130 Components.
- 116 have an exact plate or exact local fallback in the live media audit.
- 62 currently depend on a healthy remote image without a permanent exact plate.
- 2 have no dependable image in the live audit.
- 129 have an exact or legacy-filename-verified PSD in the master library.
- 51 have no exact PSD match. Of these, 49 have a verified exact legacy image suitable as a supervised generation reference.

## Legacy catalog comparison

- The current legacy accessories page exposes 29 gift bags, 13 gift-box listings, 14 reclosable/shipping items, 7 funnel/dropper items, and 21 representative cap/fitment listings.
- 10 exact legacy SKUs are absent from the current canonical non-bottle inventory.
- 4 of those missing SKUs have a healthy listing image whose filename matches the legacy SKU and can serve as a controlled generation reference.
- The remaining missing SKUs use a sibling size image or have a conflicting legacy URL and require source recovery or identity review before generation.

## High-priority identity findings

- `OBagChGreen4x6` is assigned the `OBagChGreen5x8` legacy image. Delivery is healthy, but the image identity is wrong for the 4x6 SKU.
- `RecloseableBags9x12` has no legacy image URL and is the current Packaging Supply recovery gap.
- `Plastic` / `Plastic Funnels` is a verified naming alias on the same legacy product page; it has a healthy exact legacy listing image but no master PSD.
- `CP13-415BlkSht` points to a legacy URL whose wording says White, while the legacy black short-cap listing uses `CP13-415BlkShShtMtl`. Treat this as an identity conflict, not a safe alias.
- `VBagBlue4x5` and `BoxBWndwSlvrChks` have exact listing images but legacy product URLs that collide with different color/design products. The images are usable as visual references only after retaining the exact SKU labels from the listing.

## Files

- `current_non_bottle_inventory.csv`: every current exact SKU with live media, PSD, legacy delivery, and recovery action.
- `legacy_listing_deltas.csv`: legacy-only SKUs and naming aliases.
- `summary_by_family.csv`: counts by category and family.
- `source_snapshot.json`: audit inputs and counts.
