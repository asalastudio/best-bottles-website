# PDP and Build Your Bottle component cleanup — first repair batch

## Scope and release state

The full cleanup covers **Cylinder, Circle, Round and Empire**, on both PDPs and
Build Your Bottle. This branch prepares the first confirmed repairs. It does not
claim that every missing kit or compatibility issue is resolved.

Based on main `bd16eeb5` (approved four-family heroes, PR #228), with PR #226's
assembled-PDP cleanup and shared compatibility rules incorporated as `2e7ae82c`.
The approved hero registries and image files are unchanged. Keep
`NEXT_PUBLIC_CATALOG_HERO_PILOT=families-2026-09-22` in the deployment environment.

**No live catalog mutation, backend deployment, merge or website deployment has
been performed for this cleanup batch.** The live hero restoration is separate.

## Prepared corrections

- PDP cap-off view grounds removable caps beside their actual bottle body.
  Exploded view retains its separate component offsets.
- Nine exact Circle tassel kits have their glass and integrated sprayer roles
  corrected. Glass determines the axis, seat and baseline. Exploded view keeps
  the bulb, hose and tassel together; assembled positions and image bytes remain
  unchanged.
- Builder places its fixed reference glass behind external hardware, so the
  bare neck cannot draw over the selected sprayer collar. Other relative
  source-layer orders are preserved.
- An internal, dry-run-by-default migration moves 26 legacy-confirmed tassel
  SKUs into four tassel groups, creating two missing groups. It retains product
  IDs, Shopify variant links, prices, source media and the existing plain-bulb
  routes. Group counts, price ranges and cached primary SKUs are reconciled.
- PR #226 hides the lower assembled-PDP stack on desktop and mobile, and shares
  the applicator compatibility resolver across PDP, Matrix/Builder and Grace.
  Builder configuration controls and component-only PDP sections remain.

`convex/repairs/fourFamilyComponents.json` contains the exact reviewed source
hashes and before/after metadata. `audit-corrections.json` preserves the legacy
URLs and source-master candidates that support each correction. Recipes reject
changed source images, anchors, catalog identity, membership or duplicate rows.
Applying twice is a no-op. The transaction validates every item before writing.

## Evidence

- Fresh production read: 29 exact products, eight existing/proposed group
  lookups and nine served kits. All nine audited plate and part hashes matched.
  The raw `production-before.json` is local and excluded from Git.
- Native 1000 × 1100 kit comparisons: all nine assembled composites are
  pixel-identical before/after. Error against the indexed plate is 1.82–3.38
  per channel out of 255, under the 6/255 gate. Alpha and edge gates pass.
  These are existing PDP component-kit canvases; the approved hero exports
  remain 2080 × 2288.
- Transactional tests use the 72 actual affected-group variants to verify all
  26 moves, nine role repairs, two new groups, source guards, no SKU loss,
  unchanged commerce fields/plates, and idempotence.
- Local browser preview uses the existing `BUILDER_LOCAL_KITS` overlay. No
  production query-time override is added. It verifies the eight frosted 100 mL
  Circle tassel finishes and the clear 50 mL Matte Silver tassel, plus sampled
  desktop/mobile PDPs in each family and a component-only PDP.

Generated review sheet and screenshots are in
`output/four-family-component-cleanup/`. The native metrics are also preserved
in `native-kit-checks.json`. Final browser/build status is in `validation.md`.

## Local reproduction

Run from this worktree. The snapshot command is read-only and refuses to
overwrite an existing `production-before.json`.

```sh
node scripts/repairs/snapshot-four-family-components.mjs
node --import tsx scripts/repairs/stage-four-family-components.ts
python3 scripts/repairs/review-four-family-kits.py --asset-cache ../four-family-pdp-components-2026-09-22/output/four-family-pdp-audit/assets
BUILDER_LOCAL_KITS="$PWD/data/repairs/four-family-components-2026-09-22/local-kits.json" npm run dev -- --port 3056
node scripts/repairs/verify-four-family-components.mjs
```

Local review: <http://localhost:3056/matrix?family=Circle>. The local overlay
must not be configured on a published deployment.

## Publication sequence and rollback

1. Review the local batch, then reconcile the complete backend tree with the
   intended shared environment before deploying. This branch incorporates
   PR #226; coordinate the two PRs rather than treating them as independent
   releases.
2. Confirm the production catalog URL is `precise-raccoon-123.convex.cloud`.
   Do not import the development catalog. Preserve a raw export of the scoped
   `productKits`, `products` and `productGroups` rows before the live run.
3. After the backend code is approved/deployed, run the internal
   `repairFourFamilyComponents:run` with `{"dryRun":true}`. Save its receipt,
   inspect the exact nine kits, 26 products and two new groups. Deployment
   alone does not run the repair.
4. The write call is the same function with `{"dryRun":false}`. Save its full
   receipt, including replaced fields and assigned group IDs. Re-run dry-run
   and expect no pending changes.
5. Verify served kits, exact-SKU PDP selectors, Builder previews and cart
   identities. Review the two new tassel group cards: no plain-bulb hero is
   copied into them. They need their own exact-SKU catalog-media verification.
6. If rollback is needed, restore only the receipt's changed fields against
   their recorded after-values, using the raw export for absent optional
   fields. Do not overwrite subsequent edits. Keep product IDs and Shopify
   links intact. Newly created group rows can remain empty until their route
   disposition is reviewed; do not delete groups with newly attached variants.

## Remaining full-audit work

The separate production audit covers 925 variants. Its unresolved rows are
preserved in `remaining-audit-items.csv` with an explicit snapshot date.

- 36 Cylinder reducer kits: all suspect `fitment` layers were visually reviewed
  in this session and are removable caps. Their exact records still need a
  fresh guarded repair batch and cap-off verification.
- 44 Circle/Round body-plus-diptube kits: the tube image often contains a
  covered pump or sprayer. Use exact paired master sources; do not rename an
  entire covered assembly as an exposed mechanism.
- 102 production SKUs have no served kit in the full audit. Source recovery
  and part extraction remain; retain exact plate fallback meanwhile.
- Partial Cylinder kits, the Round 128 mL Matte Gold pump registration, and
  unresolved Builder compatibility/finished-SKU choices require further work.
  Keep sellability guards and distinguish the small sprays and jumbo bodies.

This batch is reviewable progress, not clearance to publish the entire
four-family component cleanup.
