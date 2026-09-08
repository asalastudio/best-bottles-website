# Mobile builder baseline inventory — September 8, 2026

Baseline: main e3632d24. Mobile breakpoint: max-width 1099px. Desktop is 1100px and up.

- Family URL parameter with Cylinder fallback; `from` parameter for analytics. Family change clears the draft. Size, neck and application filters plus clear filters. Multiple bodies with the same capacity retain neck/profile identity.
- Shared `BuilderSelection`, `deriveBuilder`, `reconcileSelection`, `selectBuilderBody`, `builderOrder`. Body identity, exact configuration resolution, availability, image mappings and server APIs remain unchanged.
- Existing desktop sequence: bottle and glass together, fitment (auto advances), appearance, review. New mobile presentation splits glass and requires explicit navigation.
- Glass is explicit, even Clear only. A single closure auto-selects via the existing reconciliation function. Multiple caps/finishes and disabled out-of-stock entries are data-driven. Existing branches include roller, sprayer, pump, vintage/tassel, cap/reducer and dropper where returned by the catalog.
- Preview: body, exposed mechanism, complete assembly; source-backed imagery and fallback text; matched overcap display/toggle; expandable mobile preview. Preserve uniform source geometry and fixed vintage-body registration.
- Quantity defaults to 12; integer 1–1,000,000, plus/minus and Use case quantity. Pricing is delegated to `builderOrder`, including existing cart quantity. Checkout minimum is $50 per cart, not per build. Published quote tiers are not checkout discounts and must not alter charged totals.
- POST `/api/bottle-builder/validate` rechecks exact family/SKU/selection; errors preserve draft; successful add uses shared `addItems`, resets builder and confirms with cart progress, Build Another and View Cart. Pending disables duplicate submission.
- Header navigation/menu, cart, catalog link, footer resources and Grace entry remain available. Reset clears draft/filters, never cart.

## Existing limitations outside this presentation scope

- No unfinished-build local/session restoration or SKU preselection is implemented in MatrixClient; only family/from deep links exist. Cart persistence remains in CartProvider. Do not invent new draft persistence semantics in this redesign.
- Catalog/data/media gaps remain owned by existing services; mockup counts, glass variants and prices are illustrative, not source data.
- Physical iOS Safari toolbar, native keyboard and VoiceOver require device-level testing beyond desktop browser emulation. Report those separately from automated results.

## Accepted visual clarification

Use the existing approved pencil drawings for Fitment options (user clarification during implementation). Finish choices and assembled previews continue using actual source-backed product images.
