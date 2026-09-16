# Sunburst release 5 — Cylinder family, photoreal, sized from millimetres

Approved by Jordan 2026-09-16. 39 of the 52 registered Cylinder heroes.

## What changed from earlier releases

Earlier Cylinder heroes were Photoshop composites placed on bone. These are
photographs rendered by `gpt-image-2.5-sunburst` from a geometry-only base, and
their size comes from measurement rather than from a neighbouring image.

## How each hero was made

1. **Geometry base, no AI.** The SKU's PSD master is opened and composited by
   geometry, because the layers carry no usable names. The glass body is the
   layer that stands on the floor. Parts centred over the body, or chained to
   one by touching bounding boxes (an atomizer's hose, bulb and tassel), stay
   fitted. A cap standing on the same baseline stays beside the bottle.
   Flat-white retouching patches are dropped; the glass body is never trimmed.
   No shadow is drawn.
2. **Rendered.** The prompt states the input is a flat cut-out and not a
   photograph, locks silhouette, proportions, position and scale, then asks for
   a real photograph on bone with a real contact shadow. The glass clause
   (clear, frosted, amber, cobalt, swirl) and the components clause are read off
   the SKU. 2080 × 2288 at `high`, then down to 1560 × 1716.
3. **Sized.** The standing assembly — glass plus fitment, without the loose
   cap — is scaled about its foot to match the product's measured
   `heightWithoutCap` in Convex, through the size curve fitted to Jordan's
   approved targets (`share = 1.785 × mm^0.768`). The level is anchored so the
   approved frosted 9 ml roller (`GBCylFrst9MtlRollBlkDot`) does not move.
   Scaling the glass alone double-counts the fitment: every sprayer and pump
   came out ~11 % too tall and the 28 ml roll-on 33 % too small.
4. **Bone.** The rendered paper is flattened to #F5F3EF and its grain pulled
   onto exact bone with a soft ramp, so the corner pixels meet the registry's
   2/255 rule and the rendered shadow keeps its gradient.

## Held at the frame limit

`heldAtFrameLimit` marks the five 100 ml bottles whose fitment would rise past
the top of the canvas at full size; they are fitted to the frame instead.

## Not in this release

13 registered Cylinder SKUs keep their earlier images: 9 have no source PSD
(`GBCyl5GlMattSht`, `GBCylBlu5SlMattSht`, `GBTallCyl9GlMattSht`,
`GBTallCylFrst9GlMattSht`, `GBcyl25SpryMtGl`, `LBCyl25LtnMtGl`,
`PbClear4ozFlpWh`, `PbClear8ozFlpWh`, `PbNat16ozFlpWh`), and 4 have neither a
height nor a diameter recorded in Convex, so there is nothing to size them from
(`GBcyl25AnSpIvyGl`, `GBcyl25AnSpTslIvyGl`, `GBCyl25DrpGl`, `GBCyl25RdcrShnGl`).
The 25 ml size is the real gap: six of its SKUs are in this list.

`approved-lock.json` records each file's sha256, its measured standing height
and the PSD it was built from.
