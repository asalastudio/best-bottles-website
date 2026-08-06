# Cylinder Beauty Hero Gallery Implementation Plan

**Goal:** Produce five consistent sandstone beauty heroes for the 9 mL 17-415 Cylinder and surface the matching glass hero beside the exact Paper Doll builder.

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
- [x] Wire the selected glass hero into unified Cylinder Beauty View.
- [x] Preserve exact component rendering in Paper Doll Build View and exact SKU media in Shopify.

## Production export gate

- [ ] Enable a clean native Google AI Studio/API image-generation source.
- [ ] Re-export the approved five-image set without a visible consumer-app mark.
- [ ] Deterministically finish each clean source at exactly 2080 × 2288 without stretching.
- [ ] Repeat empty-bottle, geometry, glass identity, shared-baseline, and five-up QA.
- [ ] Upload all five clean images to one `paperDollBeautyGallery.CYL-9ML` Sanity document.
- [ ] Set `storefrontReady` only after the complete gallery passes the release gate.
- [ ] Verify the live desktop and mobile PDP through every glass selection and both Beauty/Build views.

## Guardrails

- Never remove a visible provenance mark from a generated image.
- Never upload the current watermarked review comps to Sanity or `public/`.
- Never use these generic metal-roller/matte-silver heroes as Shopify variant images.
- Never infer bottle geometry or product compatibility from a generated render.
