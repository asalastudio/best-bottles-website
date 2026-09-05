# Legacy reconciliation and asset recovery

Apply to every family, not only Cylinder. Legacy is the current selling catalog;
master artwork supplies editable sources. These sources together define the
intended cutover products. A stale export or a scraper's omission does not narrow
that scope.

## Retrieve direct evidence

Prefer the installed Firecrawl connector or CLI for product pages, category pages,
raw HTML and option responses. Use Agent Reach's web reader/Jina route when useful
or when Firecrawl is unavailable. Read the available tool/skill documentation;
do not invent tool names or CLI flags. For fresh claims, force a current fetch
where supported (Firecrawl `maxAge: 0`) and retain retrieval/cache metadata.

1. Start with exact product URLs and family category pages. Discover all selectable
   variants and gallery views, not just the default card. Follow the page's real
   links, option IDs and linked asset URLs. SKU-to-URL guessing is not evidence.
2. Preserve raw HTML when reader output omits selectors, lazy images or tables.
   Check `data-original` and equivalent lazy-image attributes. For dynamic options,
   retrieve the observed option endpoint or use browser inspection to identify it.
3. If the endpoint does not expose useful data, try the other reader or browser
   evidence. Distinguish extraction failure, unavailable page, absent field, and
   contradictory source content. Report failed access without claiming absence.
4. Bind each image or specification to the exact returned SKU. A legacy slug,
   image basename and website SKU can legitimately differ. Conversely, a generic
   cap thumbnail returned by a scraper is not the product's assembled image.
5. Download directly linked original assets into the isolated family source folder.
   Keep GIF/PNG/JPEG originals and all useful views. Check HTTP status and decode
   actual bytes: extension and Content-Type may disagree. Record dimensions, frame
   count, SHA-256, source URL, exact SKU, view and retrieval time. Do not label a
   static GIF animated or upscale low-resolution art and call it a high-res source.
6. Visually compare master candidates to direct legacy images before creating a
   source crosswalk. Inspect available PSD layers, not just flattened previews.
   If a website image exists, classify remaining difficulty as retrieval, matching,
   extraction, quality or integration work. If legacy truly lacks the image, record
   `legacy_image_absent` with the pages/options checked; keep the product in scope.

For current availability, a priced/selectable legacy assembly belongs in the
comparison; determine its actual sale/stock state from the page's evidence.
Do not submit orders. Do not assume an index entry or HTTP 200 alone proves sale.

## Field comparison rules

| Field | Preserve and compare |
|---|---|
| Identity and status | Exact website SKU, variant selection, current sale status, family, type, shape; retain database IDs and storefront references |
| Bottle | Capacity with raw units, bottle color, neck/thread or non-threaded interface, body shape |
| Components | Type, profile, finish, texture, color, roller material and included parts; separate bottle attributes |
| Copy | Legacy name/description/features and source-supported uses; approved clearer display text may differ without adding claims |
| Dimensions | Value, unit, tolerance, measured object, with/without-cap state and measurement-image evidence |
| Weight | Empty bottle, assembled item, component, shipping or case weight, with units and stated basis |
| Commerce | Currency, each/pack/case basis, every offered quantity tier, tier total versus unit price, pack/case count, sale/stock state |
| Media and routes | All source views, exact product/option URLs, current route, Shopify product/variant/media references |

Do not treat bottle-plus-cap height as cap height or case weight as bottle weight.
Do not copy dimensions across similar capacities or components without exact
support. Never invent density, weight, tolerances, certifications or marketing
claims to fill gaps. Store missing fields as unknown; use not-applicable only
when the product's nature supports it.

Keep stated legacy capacities and unit conversions distinct. Labels can use a
nominal ounce size; a rounded conversion is not a replacement for an explicit mL
specification. Conflicting description/specification/measurement image values
remain a documented conflict. Prefer direct exact-SKU measurement evidence over
generic copy when it resolves the discrepancy, and retain the decision basis.

Price normalization may calculate an equivalent unit price only from an explicit
pack total and quantity; label it derived, retain the raw price and do not replace
an explicitly different stated unit price. Do not use old screenshots as current
price authority. Refresh the relevant live tiers before a release price change.

Allowed presentation changes include capitalization, punctuation, readable unit
formatting and approved customer-friendly names. Preserve distinct purchasable
variants and every factual qualifier. A naming rule cannot turn a matte cap shiny,
a ribbed cap smooth, or a short cap regular.

## Evidence and deliverables

Keep a family scope table and a correction/recovery ledger. One row per SKU/issue
is sufficient; avoid forcing unrelated missing enrichment to block valid identity.
Useful columns:

```text
websiteSku,environment,recordId,fieldOrView,currentValue,legacyRawValue,
proposedValue,unitOrBasis,status,sourceUrl,optionId,retrievedAt,evidenceFile,
sourceSha256,decisionBasis,displayRule,requiredAction
```

Useful states: `verified`, `approved_display_difference`, `confirmed_exception`,
`legacy_only_record`, `database_only_review`, `source_matching_pending`,
`legacy_asset_recovered`, `legacy_image_absent`, `legacy_field_absent`,
`conflicting_evidence`, `retrieval_unresolved`, `kit_layer_review`,
`render_validation_pending`, `validated_local`, `verified_hosted`.

Report coverage against all current legacy SKUs in the requested family, with
Convex-only extras and unresolved scope separately. Count products separately
from image views, generated derivatives and component parts. Never subtract a
source-recovered item from production gaps until integration is actually verified.

For each finished batch deliver a source manifest, field comparison/correction
ledger, plate/kit readiness table, visual review, validation results and remaining
exceptions. Catalog and media changes must respect the task's existing approval
scope; source retrieval does not automatically authorize production writes.
