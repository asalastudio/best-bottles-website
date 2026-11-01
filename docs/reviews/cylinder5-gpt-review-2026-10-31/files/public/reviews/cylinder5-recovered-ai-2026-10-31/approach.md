# 5 ml paper-doll approach

Recommendation: a fixed-view 2D configurator, with measured Blender geometry supplying the reference shape, camera and component fit. The browser can use image layers; it does not need to run Blender or render a 3D scene.

## What is recovered

The two historical GPT bare-body masters are recovered and their file hashes match the earlier archive. The cobalt is the preferred appearance reference in Jordan's current feedback. The earlier clear needs a new appearance pass. Neither older image should silently replace the measured v19 body. Separate September 22 Sunburst catalog exports show complete capped assemblies, not reusable bare-body layers.

## Pilot before another catalog batch

1. Preserve the confirmed body height 53.23 mm, diameter 17.45 mm and external thread diameter 12.60 mm. Compare the whole silhouette, shoulder, rim and base against the measured model and photographs. Internal dimensions that were inferred remain labeled as assumptions.
2. Use the measured front projection as the geometry guide for a clear material edit, with the existing cobalt as an appearance reference. An image prompt is not a dimensional constraint. Reject outline or anchor drift rather than stretching a successful-looking image into place.
3. Register each approved body to the same axis, rim/closure seat, shoulder and baseline. Apply the approved catalog curve/family exception once to the entire assembly. Preserve one camera, canvas, lighting direction and color management.
4. Prove one plain cap, one roller and one sprayer, in clear and cobalt, through cap-on, sidecar and exploded states. Verify roller housing seating, cap clearance, tube reach, shadows and framing at desktop and mobile sizes. The body must stay stationary during swaps.
5. Only after that visual approval, reuse the body across the existing component finishes and in both the PDP and bottle builder.

## Layer rules

- Body appearance: an approved raster master with an intentional alpha/mask treatment and fixed backdrop. Transparency alone does not describe the optics of glass.
- Roller: seated visible housing and ball for assembled states, full insert for exploded state. The hidden stem must not be painted over the neck.
- Sprayer: external pump/collar, internal mechanism and tube are distinct parts. For the assembled fixed view, prepare the internal appearance through the matching glass; for exploded view, use the unobstructed component.
- Glass reflections/transmission: use matching render passes or a reviewed combined body/interior plate for difficult clear-glass cases. GPT glass plus a Blender tube pass is still a visual approximation unless checked against a physically rendered full assembly. Do not claim CSS opacity or multiply blending computes refraction.
- Overcap: an empty overcap master with no baked-in pump. Check the assembled overlap separately.
- Color variants share geometry and anchors, but need their own approved optical appearance. Cobalt can attenuate internal hardware much more than clear glass.

The current stage already provides body/neck axes, closure seats, baseline, per-part bounds, depth order and view-specific layers. Those are useful foundations. It does not yet provide a full physically based glass compositing pipeline; that is proposed work.

Fixed-view swaps and exploded translations work with 2D layers. True turntable rotation requires additional registered views or a real-time 3D model. A CSS rotation of a flat image is not a new camera view.

References: [Blender render passes](https://docs.blender.org/manual/en/4.4/render/layers/passes.html), [CSS image masks](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-image). The implementation recommendation is an engineering judgment based on the current stage and these capabilities.

Status: recommendation and recovered references only. No new image generation, product-body replacement, production upload or publication in this step.
