# Image Generation Canonical Variant Contract

Last updated: 2026-05-14

This is the data gate for AiOS/Madison PDP image generation and Shopify media
upload. It exists so Grace, catalog, PDPs, Shopify, Convex, and the image
pipeline all use the same product truth.

Do not start family-scale image generation from the master sheet, Grace output,
or ad hoc exports. Generate only from a canonical variant manifest that follows
this contract.

## Decision

One canonical row represents one sellable Shopify variant that needs one flattened
PDP image.

The canonical row is the source for:

- image prompt variables
- approved output filename
- Shopify product and variant assignment
- Convex image URL patching
- PDP variant tile labels
- Grace product grounding

Grace is a consumer of this data, not the authority for it.

## Required Identity Fields

Every row must have these fields before generation:

```csv
generationBatchId,dataLockStatus,familyCanonical,familyCode,productGroupKey,productSlug,productTitle,capacityMl,glassColorCanonical,glassColorCode,neckThreadSize,applicatorCanonical,applicatorCode,primaryOptionName,primaryOptionValue,primaryOptionCode,secondaryOptionName,secondaryOptionValue,secondaryOptionCode,graceSku,websiteSku,shopifyProductId,shopifyVariantId,convexProductId,convexProductGroupId,imageRole,outputFilename,outputWidth,outputHeight,sourceReferencePath,status,blockerNotes
```

Optional fields may be added after these, but the required fields should not be
renamed without updating the upload and validation scripts.

## Lock States

Use `dataLockStatus` to make intent explicit:

| Status | Meaning | Allowed action |
| --- | --- | --- |
| `draft` | Row is being cleaned or reviewed. | No generation. |
| `locked` | Product, variant, color, applicator, SKU, and Shopify IDs are verified. | Generate images. |
| `reference_only` | Existing flattened PNG is being used only to prove mapping/file integrity. | No upload. |
| `approved` | Generated image passed visual QA and filename/hash checks. | Dry-run Shopify upload. |
| `published` | Shopify media and Convex image URL were updated. | Production use. |
| `blocked` | Row has a known ambiguity. | No generation or upload. |

For family batches, every row must be `locked` before generation begins. For a
smoke test, one product group may be locked independently.

## Canonical Naming Rules

Use title-case display labels for user-facing values and short uppercase codes
for filenames and SKUs.

### Family

Five-family launch scope:

| Canonical family | Code |
| --- | --- |
| Empire | `EMP` |
| Cylinder | `CYL` |
| Elegant | `ELG` |
| Circle | `CIR` |
| Diva | `DIV` |

### Glass Color

Use normalized color names. Known aliases must collapse before generation:

| Alias or source value | Canonical value | Code |
| --- | --- | --- |
| Blue | Cobalt Blue | `COB` |
| Cobalt | Cobalt Blue | `COB` |
| Cobalt Blue | Cobalt Blue | `COB` |
| Clear | Clear | `CLR` |
| Amber | Amber | `AMB` |
| Frosted | Frosted | `FRO` |
| Swirl | Swirl | `SWR` |
| White | White | `WHT` |

If a Swirl SKU, slug, or product title says Swirl, the row must not be treated
as Clear even if an older sheet says `Color = Clear`.

### Applicator And Components

`applicatorCanonical` should describe the sellable configuration, not generic
hardware. Examples:

- `Vintage Bulb Sprayer with Tassel`
- `Fine Mist Sprayer`
- `Roll-On Metal Ball`
- `Roll-On Plastic Ball`
- `Lotion Pump`
- `Reducer and Cap`

Use option fields for component variations that appear as customer choices, such
as tassel color, cap color, trim color, pump color, or ball type.

If a product has no secondary option, set:

```txt
secondaryOptionName=none
secondaryOptionValue=none
secondaryOptionCode=NONE
```

Do not leave option fields blank in locked rows.

## SKU And Filename Rules

The `graceSku` is the canonical normalized SKU used by Grace, image tooling,
and current Shopify variant SKU matching when Shopify has been normalized.
The `websiteSku` is the storefront/legacy code used in Convex, older Madison
outputs, and filename compatibility.

The Shopify variant ID is the authority for media assignment. During validation,
the live Shopify SKU may match either `graceSku` or `websiteSku`, but it must
not match neither.

Approved output files must use both:

```txt
{graceSku}__{websiteSku}__{imageRole}__v{NNN}.png
```

Example:

```txt
GB-EMP-CLR-50ML-AST-RED__GBEmp50AnSpTslRed__pdp-main__v001.png
```

Filenames are data, not decoration. If the filename does not match the canonical
row, the image is blocked.

## Generation Gate

Before AiOS/Madison generates a batch, validate:

1. Every row has `dataLockStatus=locked`.
2. Every row has `shopifyProductId` and `shopifyVariantId`.
3. Every row has a unique `graceSku`.
4. Every row has a unique `websiteSku`.
5. Every row has a unique `outputFilename`.
6. No row has blank required fields.
7. No row uses `Blue` instead of `Cobalt Blue`.
8. No Swirl SKU/title/slug is marked as Clear.
9. `outputWidth=2080` and `outputHeight=2288`.
10. `imageRole=pdp-main` unless a different role is intentionally documented.
11. Same-capacity rows in the same family have an approved geometry anchor or reference set that locks bottle height, width, vertical axis, bottom baseline, shoulder shape, base shape, neck position, and product scale.

If any check fails, keep the row `blocked` and do not generate it.

## Visual QA Gate

Before a generated image can move from `locked` to `approved`, validate:

1. Same-capacity sibling variants share the same bottle height, width, product scale, vertical axis, and bottom baseline.
2. The bottle silhouette, shoulder, base, neck, and glass proportions match the family reference unless the manifest intentionally documents a different physical SKU.
3. Only the requested glass color, closure/applicator, finish, cap state, or supported accessory changed.
4. The background is smooth and continuous, with no artificial horizontal lines, seams, table edges, horizon lines, divider lines, backdrop folds, transparent bands, or compositing artifacts.
5. No fake line crosses behind or through the bottle, cap, sprayer, pump, roller, or closure.
6. The product uses only a subtle natural contact shadow; hard shadows, ghosted outlines, and cut-and-paste edges are blockers.

If any visual QA check fails, return the row to `locked` with blocker notes and regenerate. Do not push the image to Shopify.

## Upload Gate

Before Shopify upload, validate:

1. Every row has `dataLockStatus=approved`.
2. Every referenced PNG exists.
3. Every PNG is `2080x2288`.
4. Every PNG hash is recorded in the upload manifest.
5. Every row still resolves to the expected Shopify product and variant.
6. Dry-run report has no missing variants, duplicate filenames, or ID mismatch.

Only after this gate should the uploader run in apply mode.

## Smoke Test Rule

The Empire tassel smoke test may proceed as the first locked product group:

```txt
empire-50ml-clear-18-415-antiquespray-tassel
```

There are two smoke-test levels:

```txt
reference mapping smoke test:
canonical row -> existing flattened reference PNG -> Shopify product/variant ID check
```

```txt
production media smoke test:
canonical row -> final AI-generated PNG -> Shopify media -> variant assignment -> Convex imageUrl -> PDP tile
```

Only the production media smoke test proves the full loop:

```txt
canonical row -> flattened PNG -> Shopify media -> variant assignment -> Convex imageUrl -> PDP tile
```

Do not treat a passing smoke test as permission to generate all five families.
Each family still needs its own locked canonical manifest.

## Cleanup-Agent Handoff

The cleanup agent should return one canonical CSV per family with this contract's
required fields. For each family, include:

- count of product groups
- count of variants
- list of blocked rows and why
- list of alias corrections applied
- proof that every locked row has Shopify product and variant IDs
- proof that no Swirl/Clear or Blue/Cobalt mismatch remains

Once a family CSV is locked, this thread can generate images from it without
re-deciding product truth.
