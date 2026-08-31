# Cylinder Beauty Hero Gallery Implementation Plan

**Goal:** Produce five consistent sandstone beauty heroes for the 9 mL 17-415 Cylinder and surface the matching glass hero in a dedicated editorial canvas above the exact Paper Doll builder.

**Architecture:** Sanity owns an atomic glass-level beauty gallery; Shopify remains exact SKU and commerce truth; Paper Doll remains exact component truth.

## Completed

- [x] Convert the authoritative Clear, Amber, Cobalt Blue, Frosted, and Swirl PSDs to lossless generation references.
- [x] Lock the real bottle-to-cap proportion from the client phone photo.
- [x] Establish the approved natural sandstone, warm studio sweep, softbox lighting, crop, and shared baseline in Clear.
- [x] Generate all five Google Gemini review comps against the locked Clear master.
- [x] Correct Frosted so it reads as empty glass with no internal fill boundary.
- [x] Produce a five-up QA board and retain visible-mark review assets outside `public/`.
- [x] Add the strict `paperDollBeautyGallery` Sanity schema.
- [x] Add the 2080 × 2288, five-key, storefront-ready release validator and resolver.
- [x] Wire the selected glass hero into a dedicated, full-size 10:11 editorial canvas outside the configurator gallery.
- [x] Preserve exact component rendering in Paper Doll Build View and exact SKU media in Shopify.

## Production export gate

- [x] Enable a clean native Google Gemini API image-generation source.
- [x] Re-export the approved five-image set without a visible consumer-app mark.
- [x] Deterministically finish each clean source at exactly 2080 × 2288 without stretching.
- [x] Repeat empty-bottle, geometry, glass identity, shared-baseline, and five-up QA.
- [x] Upload all five clean images to one `paperDollBeautyGallery.CYL-9ML` Sanity document.
- [x] Set `storefrontReady` only after the complete gallery passes the release gate.
- [x] Verify every glass selection against its 2080 × 2288 Sanity source in the local PDP.

To republish from another workstation, point the script at the generated `final/` directory instead of relying on a user-specific filesystem path:

```bash
npm run cylinder:beauty:publish-sanity -- --asset-root /absolute/path/to/sandstone-v1/final --apply
```

## Guardrails

- Never remove a visible provenance mark from a generated image.
- Never upload the current watermarked review comps to Sanity or `public/`.
- Never use these generic metal-roller/matte-silver heroes as Shopify variant images.
- Never infer bottle geometry or product compatibility from a generated render.
