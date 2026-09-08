# Builder compatibility and kit readiness audit

Date: September 8, 2026. Read-only. Branch: `codex/builder-picker-interactions`, base `de2f80b6`.

This report captures the initial read-only audit. Subsequent local implementation is documented in [SKU reconciliation](sku-reconciliation.md) and [loading verification](loading-verification.md).

## Finding

The missing fitments are real, but incomplete kits are only one cause. The live builder and the local checkout connect to different catalog deployments and return different product eligibility and kit results. All 436 Cylinder and 220 Circle live catalog rows were checked through the current resolver, alongside 443 Cylinder and 209 Circle local rows. No catalog records, compatibility guards, media, kits, Shopify settings, or application code were changed. The parallel kit/plate work remains untouched.

## Confirmed causes

1. **50 / 100 ml Cylinder spray and lotion pumps:** the live matrix lists the matching 18-415 components, but those components are marked `shopifySellable: false`. Sample exact records `Spry18-415MtGl` and `Ltn18-415MtGl` record `STATUS_DRAFT+NOT_PUBLISHED`, checked September 3, 2026. The builder requires both an eligible assembly and eligible matching loose component. The sampled 50 ml assemblies `GBCyl50SpryMtGl` and `LBCyl50LtnMtGl` are themselves sellable and already have full kits. Therefore these particular omissions are not missing-kit failures. Local resolver results include six spray finishes and five lotion finishes for each capacity. Do not assume local eligibility overrides production.

2. **50 / 100 ml Cylinder reducers:** eleven assemblies per capacity get past the component match but are rejected in production because the assembly itself is marked unsellable. Sample `GBCyl50RdcrShnGl` and `GBCyl100RdcrShnGl` record the same draft/unpublished reason. Their published kit metadata is `capSplit` with `body` and `fitment` slots, without a separate cap/overcap slot. Local eligibility passes but this kit structure is still rejected by the builder. These need both commercial-state review and kit completion/contract verification. Short shiny-black variants have an additional component-match problem.

3. **9 ml tall Cylinder, 13-415 rollers:** nine metal and nine plastic finishes in each of Clear and Frosted are eligible catalog candidates but fail media resolution in production. Sample `GBTallCyl9MtlRollBlkDot` has `capSplit` body/cap only. Plastic samples have body/roller/cap but still fail the current media resolver. Kit completeness and a qualifying identical bare-body preview are relevant, so the raw presence of images does not guarantee eligibility. Local results restore the roller types; verify production again after the kit release.

4. **Small 13-415 sprays:** production marks listed spray components unsellable, also hiding all eight spray assemblies on Circle 15 ml and the corresponding Cylinder 5 / 9 ml options. Example `CP13-415SpryBlkSh` records draft/unpublished.

5. **Other gaps remain separate:** Circle 30 ml regular cap rows do not resolve a matching cap; several Circle vintage/tassel options fail media or duplicate-choice checks. The 50 ml Cylinder roll-on rows have a **16 mm neck**, not the selected 18-415 neck, and have no listed resolved components. Do not add those roll-ons to the 18-415 body. Some source rows also have labeling/neck inconsistencies that need exact-SKU reconciliation.

## Live choices by bottle and glass

These are selectable configuration types, not physical compatibility claims for every loose component. Counts and names reflect the audit snapshot.

| Bottle | Neck | Glass | Live fitments |
|---|---|---|---|
| 5 ml Cylinder | 13-415 | Clear | Metal Roller, Plastic Roller, Screw Cap |
| 5 ml Cylinder | 13-415 | Cobalt Blue | Screw Cap |
| 9 ml Cylinder | 13-415 | Clear | Screw Cap |
| 9 ml Cylinder | 13-415 | Frosted | Screw Cap |
| 9 ml Cylinder | 17-415 | Amber | Fine Mist Sprayer, Lotion Pump, Metal Roller, Plastic Roller |
| 9 ml Cylinder | 17-415 | Clear | Fine Mist Sprayer, Lotion Pump, Metal Roller, Plastic Roller |
| 9 ml Cylinder | 17-415 | Cobalt Blue | Fine Mist Sprayer, Lotion Pump, Metal Roller, Plastic Roller |
| 9 ml Cylinder | 17-415 | Frosted | Fine Mist Sprayer, Lotion Pump, Metal Roller, Plastic Roller |
| 9 ml Cylinder | 17-415 | Swirl | Fine Mist Sprayer, Lotion Pump, Metal Roller, Plastic Roller |
| 50 ml Cylinder | 18-415 | Clear | Vintage Bulb Sprayer, Vintage Bulb Sprayer with Tassel |
| 100 ml Cylinder | 18-415 | Clear | Vintage Bulb Sprayer, Vintage Bulb Sprayer with Tassel |
| 15 ml Circle | 13-415 | Clear | Metal Roller, Plastic Roller, Screw Cap |
| 30 ml Circle | 15-415 | Clear | Perfume Sprayer |
| 50 ml Circle | 18-415 | Clear | Dropper, Vintage Bulb Sprayer, Vintage Bulb Sprayer with Tassel |
| 50 ml Circle | 18-415 | Frosted | Vintage Bulb Sprayer |
| 100 ml Circle | 18-415 | Clear | Vintage Bulb Sprayer, Vintage Bulb Sprayer with Tassel |
| 100 ml Circle | 18-415 | Frosted | Reducer, Vintage Bulb Sprayer, Vintage Bulb Sprayer with Tassel |

## Resolver totals

| Environment | Family | Catalog rows | Selectable configurations | Candidate rows rejected by media | Ambiguous configurations excluded |
|---|---|---:|---:|---:|---:|
| live | Cylinder | 436 | 202 | 66 | 0 |
| live | Circle | 220 | 52 | 46 | 6 |
| local | Cylinder | 443 | 301 | 35 | 4 |
| local | Circle | 209 | 129 | 39 | 4 |

The CSV preserves the existing resolver diagnostic names. `compatibility_unresolved` includes component eligibility and finish matching, and must not be interpreted as proof that a component physically does not fit. `media_unavailable` can include identity/completeness failures rather than absent files. The deliberately excluded Cylinder 5.5 ml imported identity is one such case. Kits were queried for eligible candidates; blank kit columns on earlier-rejected rows mean not queried, not proven absent. Exact sample kits were queried separately even for earlier failures. The disabled vintage finish display is not counted as selectable.

## Kit branch handoff

Use `assembly-audit.csv` filtered to candidate=true and issue=media_unavailable for the exact SKU queue. Keep family, capacity, glass and neck identity intact. For each kit, verify completeness, part-slot meanings, bare-body preview eligibility and exact mechanism/cap coverage. The existing resolver also validates conflicts, canvas/anchor bounds, PSD/Madison derivation and family identity. Do not fix these by merely relabeling a partial kit as full.

## Catalog follow-up after kits are ready

Review the production draft/unpublished reasons against current Shopify/source truth. Decide whether loose components are intentionally unpublished while their complete bottle assemblies remain purchasable. That is a separate commerce eligibility policy decision; this audit does not recommend globally publishing components or removing retirement/sellability checks. Reconcile exact aliases and cap-style ambiguities separately. After the approved changes, re-run every restored finish through exact-assembly preflight and verify mobile and desktop selection.

## Evidence and limitations

Four read-only production preflight requests (50 and 100 ml matte-gold spray and lotion assemblies, quantity 12) all returned HTTP 409. This confirms the omission also affects current exact-assembly validation, not just a cached option grid. See `production-preflight.json`.

- Production Cylinder server-rendered response reproduced the reported vintage-only choices for 50 and 100 ml. Production API resolver output matched that response.
- `exact-record-evidence.json` contains exact sampled production SKU flags, source links, check timestamps and kit states. These are stored catalog flags, not a fresh Shopify Admin inventory audit.
- The existing read-only product-truth command checked all 443 local Cylinder rows; its 51 medium findings are unrelated legacy/media reconciliation flags, not 51 missing fitments.
- Exact legacy source reconciliation for `GBCyl50RdcrShnGl` matched one product with no identity issues. [Source reducer assembly](https://www.bestbottles.com/product/cylinder-design-50-ml-glass-bottle-reducer-shiny-gold-cap).
- The legacy source also identifies the [50 ml matte-gold spray assembly](https://www.bestbottles.com/product/cylinder-design-50-ml-glass-bottle-matte-gold-spray-pump-and-cap) with an 18-415 neck. Not every legacy finish page was freshly inspected; no exhaustive physical-fit certification is claimed.
- The local HTTP preflight attempt could not connect because the local dev server had stopped. Local results in this report are direct read-only resolver checks, not a current local browser/cart completion claim.
- No production deployment, purchase, Shopify cart creation, or data mutation was performed. Pending kit work means this is a gap audit, not repair completion.
