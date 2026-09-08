# Bottle builder family readiness

Run this check for every family before exposing it in Build your bottle, and after catalog, component or kit changes. A family being visible is not proof that its full option set is available.

## Repeatable audit

```bash
npm run audit:builder-readiness -- --url PUBLIC_CONVEX_URL --legacy --out /tmp/builder-readiness
npm run audit:builder-readiness -- --family Cylinder --threads 13-415,17-415,18-415 --legacy --check --out /tmp/cylinder-readiness
```

The default threads are 13-415, 17-415 and 18-415; pass other exact threads for future families. An omitted URL uses the local environment. Check the report's endpoint and timestamp before interpreting results. Do not confuse local/preview and production datasets.

The audit paginates the product inventory instead of limiting discovery to the customer family picker. It checks the actual matrix resolver, exact component restoration, all image kits (including commercially blocked assemblies), and duplicate selection identities. It saves `readiness.json`, `assemblies.csv`, and hashed legacy HTML. It follows the source URLs and their actual variant-selector links. An empty product page, failed fetch, conflicting specification or missing SKU remains an unresolved source item.

`--reuse-source` explicitly reprocesses the saved HTML in the output directory and records the prior snapshot time; omit it for a fresh source check. `--check` exits 2 for discovered blockers or unverified sources; query failures and truncated matrix results exit 1. Exit 0 is a technical check of the scanned scope, not release approval or a complete independent legacy-category census.

## Required family evidence

1. **Source inventory:** enumerate exact currently sold legacy assemblies and every selectable variant from category listings, product pages and selector responses. Reconcile this independent inventory with the audit. Investigate source-only and catalog-only records. Preserve exact website SKU, URL, capacity, glass, neck and original finish names; distinguish short/regular, shiny/matte, roller material and glass versus cap color.
2. **Exact relationships:** record the source-backed assembly-to-component match. Resolve only exact retired aliases to verified active records. Matching threads alone cannot introduce a fitment. Missing component lists and ambiguous finish matches must be repaired explicitly, not filled from another bottle.
3. **Commerce:** verify the complete assembly's SKU, Shopify variant, availability, quantities and prices. Keep independent loose-component sale status separate in the audit. The builder purchases the complete assembly; an included component need not also be published for separate purchase. Exact component identity, retirement and stock checks still apply. Source-reviewed missing links are scoped to exact assembly and component identities, with explicit provenance; existing matrix links take precedence. Reducer assemblies marked unpublished remain blocked even if a loose component is available.
4. **Media:** inspect the correct bare bottle, exposed selected mechanism, each cap/finish, and included overcap. Validate kit identity, geometry, anchors and reconstruction. A cap-split assembly can depend on a validated bare preview from another exact assembly of the same bottle; a blocked sibling can therefore hide otherwise usable roller imagery. Never fix that by borrowing artwork from a different glass, mold, neck or SKU.
5. **Coverage:** Count fitment types separately from their cap/finish choices. Metal Roller is one mechanism; Plastic Roller is one mechanism. Nine compatible caps mean nine choices within that mechanism, not nine rollers. compare expected versus returned fitments and finishes for each family + physical bottle + capacity + glass + neck. Account for every intentionally unavailable option with a reason. Test the longest names and full option counts on mobile; do not hardcode counts from mockups.
6. **Purchase proof:** run the existing read-only `/api/bottle-builder/validate` preflight for every newly enabled exact assembly, checking returned SKU, configuration and quantity. Test representative cart requests without duplicate components or per-build enforcement of the cart-wide $50 checkout minimum.
7. **Interaction proof:** test Bottle → Glass → Fitment → Finish → Review, Back/Edit/reset, restoring valid selections, expanded-preview dismissal, unavailable options, and failure recovery on mobile and desktop. Report browser emulation separately from physical iPhone checks.

## Release record

Keep a dated per-SKU ledger of source identity, compatibility, assembly commerce, standalone commerce, kit status, visibility, and preflight result. Resolve the intended source scope or explicitly hold named SKUs before release. A finished kit batch, green frontend build, or Ready deployment alone cannot certify complete catalog coverage. Keep publication and kit/hero changes in their own authorized work; this audit performs no production writes.
