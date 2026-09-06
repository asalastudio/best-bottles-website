# Diva dropper checkout reconciliation

Jordan approved all 21 Diva hero images and then authorized correction of the clear/frosted dropper checkout identities before release.

## Completed data correction

Six existing Convex records represent the correct products: clear and frosted 46 mL Diva bottles, each with silver, gold and copper collars. Live legacy option responses 2802–2804 and 3287–3289 confirm the identities and five quantity tiers. Base prices are $2.40 clear and $2.90 frosted.

Shopify had only three corresponding variants. Its clear product carried frosted gold/copper SKUs, and its frosted silver variant was also incorrectly linked to clear silver in Convex.

- Preserved both Shopify product IDs, handles, publication states and all three existing variants.
- Corrected gold/copper SKUs on the clear product, retaining their variant IDs.
- Corrected the existing frosted silver price to $2.90.
- Added the missing clear silver and frosted gold/copper variants.
- Linked each existing Convex record and group to its exact Shopify identity. No products or variants were deleted.
- Attached the six exact legacy product photographs to the corresponding Shopify variants. Filled the three missing frosted images in Convex and set its primary SKU to the visually approved gold dropper.
- Verified sellability before updating the six Convex sellability flags. Record IDs, product facts, current stock state and legacy price ladders were preserved.

The companion JSON records the exact before/after variant IDs and verified media. Raw snapshots, legacy HTML, the preflight plan and every write response are retained in the active review checkout under `output/diva-checkout-reconciliation-2026-09-06/`.

## Saved-cart repair

A stored clear-silver cart entry could still carry Shopify variant `53343642485028`, which correctly represents frosted silver. The old checkout resolver tested availability but ignored the returned SKU. It would therefore send the customer to the wrong bottle.

The resolver now checks that a saved ID matches the requested Grace or website SKU. Missing or mismatched IDs are resolved again by the requested SKU. Correct direct IDs retain the existing path; correctly identified unavailable variants remain blocked. Unresolved identities cannot use the unrelated saved variant.

## Verification and release boundary

- 49 checkout/Shopify tests and TypeScript checking pass in the isolated branch.
- The deployed anonymous checkout resolver resolves all six products by both current IDs and SKU fallback with no missing or unavailable items.
- Actual Shopify checkout displays six distinct SKU lines with correct photos: three at $2.40, three at $2.90, subtotal $15.90. No contact/payment information was entered and no order was placed.
- All 21 approved Diva hero files remain unchanged; they retain their source and framing lock.

The Shopify/Convex correction is applied. The user subsequently authorized publishing all 21 approved Diva heroes. PR #104 now bundles the exact approved image files and registry entries with the saved-cart safeguard. Verify both on the PR preview before merge, then verify the production deployment. No Convex deployment is required.

## Recovery notes

The data repair uses sparse changes and preserves the six existing Convex records. The old clear-silver ID is intentionally reassigned only in Convex; the existing Shopify variant remains frosted silver. Do not restore that incorrect link. If any new issue arises, mark the affected exact SKU unavailable for checkout and reconcile against the retained before/after snapshots. Do not automatically delete the three newly created variants; they may have acquired customer references after this repair.
