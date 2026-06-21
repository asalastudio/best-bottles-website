# Product Copy Import Instructions

## Pilot File

- Import source: `copy/sanity-import.json`
- Review source: `copy/CYLINDER-9ML-PILOT-REVIEW.md`
- Scope: five Cylinder 9ml 17-415 roll-on product groups and 25 selected variants.

## Suggested Engineering Flow

1. Review `copy/EXCEPTIONS.md` before import.
2. Load `copy/sanity-import.json` in a staging script.
3. Upsert `productGroups` by `slug` or `sourceProductGroupId`.
4. Upsert `products` by `spec.websiteSku` or `sourceProductId`.
5. Preserve existing Convex numeric fields as canonical; treat this JSON as copy and SEO content only.
6. Spot-check each PDP in staging for FAQ rendering, SEO field lengths, and variant copy placement.

## Stop Point

Do not scale generation beyond this pilot until stakeholder feedback is incorporated into the templates.
