# Cylinder Beauty Hero Gallery Design

**Date:** 2026-08-04  
**Status:** Approved for implementation planning  
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

- Seamless bone paper: `#EFE9DE`.
- Matte, warm-neutral, and nearly achromatic.
- No horizon line, sweep edge, gradient band, environmental context, or visible studio equipment.
- The background, exposure, white balance, and shadow color remain constant across all five images.

### Pedestal

- One turned cylindrical disc, approximately 140 mm diameter by 40 mm tall.
- Honed ultra-high-performance micro-concrete, integrally pigmented Warm Gray `#8D8880`.
- Near-poreless glassy-fine mineral matrix with no visible aggregate, pinholes, grain, veining, or trowel marks.
- Dead-matte dry finish and a precise 1.5 mm eased top arris.
- Pedestal scale, height, color, and finish remain constant across all five images.

### Product presentation

- Exactly one bottle and one matching matte-silver cap.
- Metal roller ball remains correctly seated and exposed.
- Cap stands upright to the bottle's right and remains visually subordinate.
- Bottle remains empty and unlabelled.
- No text, logo, props, plants, fabric, wood, water, or decorative objects.

### Camera and lighting

- Square 1:1 final composition.
- Straight-on, level camera approximately 15 degrees below the pedestal top plane.
- Product-photography perspective equivalent to a 100 mm macro lens at f/8.
- Large soft source at 45 degrees camera left and slightly behind.
- White bounce camera right and a restrained low rake across the pedestal.
- Soft directional shadow falls camera right.
- Bottle scale, baseline, cap lane, crop, and negative-space proportions remain consistent across the set.

## Controlled creative freedom

The renders may use subtle highlight and shadow adjustments needed to reveal each glass treatment. Clear glass may receive stronger edge definition; amber and cobalt may receive carefully controlled transmitted light; frosted glass may receive a broader soft highlight; swirl may receive a restrained raking highlight that reveals its pattern.

These adjustments must not change the background color, pedestal, camera position, bottle geometry, cap finish, component count, or overall gallery layout. The five images should read as one photographic session.

## Generation and review flow

1. Convert each authoritative PSD to a lossless PNG reference without altering its proportions.
2. Generate one image per glass body using the same approved prompt chassis.
3. Save generated candidates non-destructively in a versioned Cylinder beauty-gallery directory in the project.
4. Review each candidate for product geometry, glass identity, component count, cap finish, pedestal material, background consistency, and crop.
5. Compare all five images together as a contact sheet before approval.
6. Regenerate only failed members, changing one prompt variable at a time.
7. Integrate approved assets into the beauty gallery without changing Paper Doll product or configuration data.

## Failure handling

A candidate fails if it invents or removes a component, changes glass color or pattern, alters the roller type, changes the cap away from matte silver, introduces a label or liquid, changes the pedestal material or geometry, creates visible pores or rustic stone texture, or drifts materially from the shared crop and lighting.

Failed candidates are retained as review evidence but are not wired into the storefront. Product truth is never inferred from a generated result; the PSD and current `CYL-9ML` configuration contract remain authoritative.

## Verification

- Confirm the five PSD references resolve to the intended 9 mL 17-415 Cylinder bodies.
- Confirm the product-truth audit for `Cylinder + 9ml` reports no critical or high issues before integration.
- Verify all final files are square and share the same pixel dimensions.
- Review a five-up contact sheet for background, pedestal, scale, cap lane, and shadow consistency.
- Verify the gallery at desktop and mobile breakpoints.
- Verify selecting plastic roller, cap finishes, spray, and lotion options still uses Paper Doll layers rather than editorial beauty images.

## Non-goals

- Generating 145 beauty images for every exact configuration.
- Replacing Paper Doll layer assets.
- Creating SKU-specific Shopify product heroes or catalog-grid images.
- Publishing images to Shopify, Convex, Sanity, or Madison as part of this initial generation pass.
- Regenerating other bottle families.
