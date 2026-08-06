# Cylinder Beauty Hero Gallery Design

**Date:** 2026-08-04  
**Status:** UI architecture implemented; clean production exports pending  
**Scope:** Best Bottles 9 mL Cylinder, 17-415 platform (`CYL-9ML`)

## Objective

Create a concise five-image editorial beauty gallery for the Cylinder family. The gallery introduces the five glass bodies with a single, consistent roll-on presentation. It does not duplicate the interactive Paper Doll configurator, which remains responsible for showing exact roller, cap, sprayer, and lotion-pump selections.

## Asset model

The beauty gallery contains exactly five images:

1. Clear
2. Amber
3. Cobalt Blue
4. Frosted
5. Swirl

Each image shows one 9 mL 17-415 bottle with the metal roller ball exposed and its matte-silver cap removed and standing upright to the bottle's right. No separate beauty image is generated for the plastic roller, alternative cap finishes, sprayers, or lotion pumps.

The builder owns the complete configuration truth. Its current contract contains five bodies, two roller layers, ten cap layers, six sprayer layers, and three pump layers, producing 145 exact visual configurations. Beauty assets and builder assets therefore have separate responsibilities:

- **Beauty gallery:** editorial desire, material identity, and glass-color introduction.
- **Paper Doll builder:** exact selectable components and configuration fidelity.

## Authoritative product references

Each generation uses one client PSD as its sole product reference:

- Clear: `GBCyl9MtlRollMattSl.psd`
- Amber: `GBCylAmb9MtlRollMattSl.psd`
- Cobalt Blue: `GBCylBlu9MtlRollMattSl.psd`
- Frosted: `GBCylFrst9MtlRollMattSl.psd`
- Swirl: `GBCylSwrl9MtlRollMattSl.psd`

The PSD establishes bottle geometry, glass treatment, neck and thread structure, roller fitment, cap form, and relative bottle-to-cap proportions. Generation may improve lighting, material rendering, and composition but must not redesign the product.

## Fixed visual system

### Background

- Warm ivory studio sweep with the approved soft tonal falloff.
- Matte, warm-neutral, and nearly achromatic.
- No hard horizon line, environmental context, or visible studio equipment.
- Background, exposure, white balance, and shadow color remain constant across all five images.

### Pedestal

- One low, irregular slab of natural warm sandstone.
- Flat usable top with authentic quarried fracture at the perimeter.
- Fine sandy mineral grain, restrained tonal variation, dry matte finish, and no artificial cylindrical machining.
- No marble veining, glossy sealant, generic concrete, stacked platform, decorative rubble, or additional stones.
- Slab footprint, top line, scale, color, and finish remain constant across all five images.

### Product presentation

- Exactly one bottle and one matching matte-silver cap.
- Metal roller ball remains correctly seated and exposed.
- Cap stands upright to the bottle's right and remains visually subordinate.
- Bottle remains empty and unlabelled.
- No text, logo, props, plants, fabric, wood, water, or decorative objects.

### Canvas, camera, and lighting

- Canonical final canvas: exactly 2080 × 2288 px, a 10:11 portrait ratio matching the `CYL-9ML` Paper Doll canvas.
- The 2080 × 2288 master is the only production hero asset. Square previews are direction-setting references or derived crops, never source masters.
- Straight-on, level camera with a shallow view of the sandstone top plane.
- Product-photography perspective equivalent to a 100 mm macro lens at f/8.
- Large studio softbox at camera left and slightly above.
- White bounce camera right and a restrained low rake across the sandstone.
- Soft directional shadow falls camera right.
- Bottle scale, baseline, cap lane, crop, and negative-space proportions remain consistent across the set.
- Keep bottle, cap, and pedestal inside a centered crop-safe area so the Clear master can be used in the more square family-page media panel without clipping the roller, glass base, cap, or pedestal arris.

## Controlled creative freedom

The renders may use subtle highlight and shadow adjustments needed to reveal each glass treatment. Clear glass may receive stronger edge definition; amber and cobalt may receive carefully controlled transmitted light; frosted glass may receive a broad uniform highlight without an internal fill boundary; swirl may receive a restrained raking highlight that reveals its molded pattern.

These adjustments must not change the background color, sandstone slab, camera position, bottle geometry, cap finish, component count, or overall gallery layout. The five images should read as one photographic session.

## Content architecture

- **Shopify:** continues to own exact sellable SKU media, variant identity, price, and availability. The generic metal-roller/matte-silver beauty images must not become Shopify variant images because they would misrepresent other component selections.
- **Sanity:** owns one atomic `paperDollBeautyGallery` document for `CYL-9ML`, containing exactly one clean 2080 × 2288 hero for each glass key (`CLR`, `AMB`, `BLU`, `FRS`, `SWL`).
- **Paper Doll:** remains the exact visual source for the selected roller, cap, sprayer, or pump in Build View.
- **Release gate:** the storefront rejects a gallery unless all five keys are present exactly once, every image is 2080 × 2288, the reference is metal roller plus matte silver, and `storefrontReady` is true.
- Watermarked review comps never enter public assets or Sanity production documents.

## Generation and review flow

1. Convert each authoritative PSD to a lossless PNG reference without altering its proportions.
2. Generate one image per glass body using the same approved prompt chassis and explicit 10:11 portrait composition.
3. Export each approved candidate natively and recanvas deterministically to exactly 2080 × 2288 without stretching the product.
4. Keep watermarked candidates as review evidence; upload only clean production masters to the versioned Sanity gallery.
5. Review each candidate for product geometry, glass identity, component count, cap finish, pedestal material, background consistency, crop, and shared baseline coordinates.
6. Compare all five 2080 × 2288 masters together as a contact sheet before approval.
7. Regenerate only failed members, changing one prompt variable at a time.
8. Publish the complete Sanity gallery and enable `storefrontReady` without changing Shopify variant media or Paper Doll product/configuration data.

## Failure handling

A candidate fails if it invents or removes a component, changes glass color or pattern, alters the roller type, changes the cap away from matte silver, introduces a label or liquid, changes the sandstone material or slab geometry, or drifts materially from the shared crop and lighting.

Failed candidates are retained as review evidence but are not wired into the storefront. Product truth is never inferred from a generated result; the PSD and current `CYL-9ML` configuration contract remain authoritative.

## Verification

- Confirm the five PSD references resolve to the intended 9 mL 17-415 Cylinder bodies.
- Confirm the product-truth audit for `Cylinder + 9ml` reports no critical or high issues before integration.
- Verify all final files are exactly 2080 × 2288 px and contain no non-uniform stretching.
- Review a five-up contact sheet for background, pedestal, scale, cap lane, and shadow consistency.
- Verify the gallery at desktop and mobile breakpoints.
- Verify selecting plastic roller, cap finishes, spray, and lotion options still uses Paper Doll layers rather than editorial beauty images.

## Non-goals

- Generating 145 beauty images for every exact configuration.
- Replacing Paper Doll layer assets.
- Creating SKU-specific Shopify product heroes or catalog-grid images.
- Publishing generic beauty imagery as Shopify variant media.
- Regenerating other bottle families.
