# Cylinder catalog heroes

The catalog grid and focused family/application finders now use the approved studio photographs for 52 populated Cylinder groups. The 53rd production group, the empty retired 5.5 mL capped route, receives no invented image or assembly.

## Product identity and scope

- Each image is registered to an exact website SKU and group. It is used only if that exact SKU is present in the current result.
- Production uses `cylinder-30ml-clear-18-415`; development uses `cylinder-30ml-clear-18-415-finemist` for the same `GBSpry1ozGl` assembly. Both existing routes are supported without redirects or database changes.
- The revised 114 mL plastic bottle image is selected. The 227 mL and natural 454 mL plastic images retain their approved versions.
- The natural 454 mL bottle's hero title, alt text and card color say Natural, consistent with its source. Its existing route remains unchanged. This presentation correction does not rewrite the database or catalog filter facets.
- Existing PDP images, plates, kits, purchasing behavior, record IDs and Shopify links are preserved. These assets apply to grid cards; the catalog table/list retains its existing thumbnails.

## Rendering and interaction

- A consistent 10:11 portrait frame is used on mobile and desktop, with proportional containment so the bottle and closure remain visible.
- Each photographed bottle has its own ground-contact anchor, aligned to 90% of the frame. Studio heroes do not zoom on hover, so their baseline stays fixed.
- The five 100 mL variants share a shoulder-to-ground body height of 58% of the frame. Fresh exact-SKU legacy specifications confirm the same 154 ±2 mm bare-bottle height and 35 ±0.5 mm diameter. The lotion-pump, spray and tassel images were regenerated against their source plates to repair visible body-proportion drift before registration.
- The plastic assemblies are displayed in the ratio 124:159:194, using the verified heights with cap for 114, 227 and 454 mL. This makes 114 visibly smaller than 227 without inferring height from capacity or stretching the bottle.
- Uniform CSS scale and translation preserve each selected photograph's proportions. Sampled background gradients and edge feathering extend the studio background where the frame needs more space.
- The size correction is scoped to these comparison groups. Other capacities retain their approved merchandising scale; the entire catalog is not presented at one physical millimeter-to-pixel scale.
- Original approved PNG bytes are retained under content-addressed filenames. Next Image provides responsive optimization and lazy loading.
- The hero stays visible until a customer explicitly previews a swatch. Touch/click, pointer and keyboard previews show the original variant photograph with its exact SKU metadata.
- Leaving the card restores the hero. A failed hero falls back to existing catalog media, then to the existing placeholder if that also fails.
- Other families retain their existing frame ratios.

## Evidence

`cylinder-catalog-hero-lineage-2026-09-04.json` records all 52 website SKUs, source plate hashes, master source references, legacy URLs and output hashes. It also retains eight exact-SKU measurement extracts freshly retrieved with Firecrawl, capture dates and response hashes. The runtime registry is `src/lib/products/cylinder-catalog-heroes.json`.

The refreshed production/development source inventory was captured at 2026-09-05 03:41 UTC. Jordan subsequently approved the visual direction and requested mobile/desktop UI integration.

## Verification

- 129 focused tests passed across nine files, including all 52 image hashes/dimensions, exact SKU matching, the verified preview route, shared baselines, 100 mL body sizing, plastic height ratios, interaction and image-failure behavior.
- Targeted ESLint passed.
- Production build and TypeScript passed.
- Browser checks passed for all 52 heroes in both the catalog grid and focused family finder at 390 px mobile and 1440 px desktop, plus the finder at 768 px tablet. No horizontal overflow, broken hero images or uncaught page errors were observed. Rendered transforms placed every registered ground anchor at 90% of its frame and retained uniform scaling.
- All 52 original image requests returned 200 with matching SHA-256 hashes. All 104 optimized image requests (640 and 828 px) returned 200, decoded successfully and had the requested widths.
- Touch swatch preview showed the source SKU image and navigation opened the expected existing PDP. Unit checks additionally cover keyboard/pointer restoration and the two-stage failed-image fallback.
- Desktop screenshots were visually reviewed for the five 100 mL variants and the plastic size progression; mobile screenshots were reviewed for containment, sizing and card layout. These are local production-build checks, not a claim that the changes have been deployed to production.

Existing environment notices about the absent local OpenAI key and deprecated static directory do not prevent this frontend build. Grace model calls and unrelated legacy Shopify image failures are outside this image-registration change.

## Rollback

Revert this frontend commit and redeploy. No Convex mutation, function deployment, Shopify write or media storage migration is required for either release or rollback.

These generated photographs are approved merchandising images, not a source of dimensional or physical-fit measurements.
