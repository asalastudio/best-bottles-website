# Buyer Client Portal catalog quantity pricing

Branch `codex/portal-catalog-tiers` is based only on PR355 `30d0283b40824575effba472159aa429bdca3222` (which depends on PR352). It does not include or modify the separate cart UX, PR348 recovery, PR351 buyer-auth pricing adapter or order-truth work.

The portal catalog previously showed a group's minimum starting price next to an unrelated quantity stepper. It never supplied the exact SKU's ladder to the buyer. It also claimed account tier pricing although it had only public catalog data.

The new expandable “Pack of” menu uses the same catalog tier model and quantity rules as public catalog cards. Selecting a break selects its first quantity; typed quantities pick the applicable tier. Unit price and Add total come from the same `resolveQuotedUnitPrice` used by server-side portal draft repricing. Only the exact ordered SKU's pricing is attached; missing primary-SKU previews cannot borrow a cheaper sibling's ladder. The server still receives SKU/quantity only and resolves the price independently. Desktop/mobile controls share quantity state. Invalid quantities remain visible with an error instead of being silently changed.

This is published volume pricing, not authenticated Shopify company-location pricing. The UI says account pricing and checkout availability are confirmed separately. It neither changes payment policy nor activates native checkout, overrides stock, changes tier data or treats pending accounts as approved. Order submission guards are unchanged. A separately approved native buyer context remains required for native checkout parity.

The fallback account state now offers refresh, contact Best Bottles and return-to-saved-orders actions instead of implementation-specific seeding instructions. PR355's matched frontend/Convex release remains necessary for verified pending-profile creation and the address form. This copy change alone does not resolve a missing backend deployment.

Regression fixtures verify each side of every Elegant tier boundary and 60 × $0.84 = $50.40 across public catalog selection, portal display and server draft resolution; exact SKU/sibling isolation; invalid quantity input; no browser price injection; rendered menu selection and total. No live writes/orders were used. Browser visual/interaction QA remains a release gate if no authorized browser runtime is available.

Rollback is a code revert of the portal catalog commit after confirming PR355 remains intact. No data migration or price rollback is needed.

Precision correction: portal display and `setDraftLineItems` now share `draftLineTotal`/`draftOrderTotal`. The contract preserves raw published unit precision through multiplication and order summation, matching the existing saved-draft arithmetic; currency formatting is presentation only. For example, $0.845 ×60 produces $50.70, not $51.00. Unit labels retain fractional cents. Regression tests persist actual Convex draft lines and read their totals back, covering tier boundaries and a multi-line $51.6999 raw total displayed as $51.70. No stored-price migration, payment rounding policy or Shopify order-price behavior is changed. In `convex/portal.ts`, only the draft-line total expression and its helper import changed; order upsert/read sections remain untouched.
