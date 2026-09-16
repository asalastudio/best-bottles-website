# Sunburst release 5 — Cylinder family, photoreal, sized from millimetres

Approved by Jordan 2026-09-16. 45 of the 52 registered Cylinder heroes.

## What changed from earlier releases

Earlier Cylinder heroes were Photoshop composites placed on bone. These are
photographs rendered by `gpt-image-2.5-sunburst` from a geometry-only base, at
the size locked for each body on 2026-09-07.

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
3. **Sized on the locked shoulder line.** On 2026-09-07 Jordan locked every
   Cylinder hero's glass-shoulder height per physical body
   (`docs/reviews/cylinder-family-final-manifest-2026-09-07.json`, foot on the
   91 % baseline): 3.3 ml 26.5 %, 4 ml 31.5 %, 5 ml 36.5 %, 9 ml 43.5 %,
   Tall 9 ml 62.5 %, 28 ml 50.5 %, 30 ml 46 %, 50 ml 56 %, 100 ml 67.5 % of the
   1716 canvas. Those numbers are the plan; nothing here re-derives them. Each
   render is scaled about its foot so its glass shoulder lands on its body's
   locked line. The shoulder position comes from the lock itself: the lock
   records where the shoulder and the contact base sit in each SKU's source
   assembly, and the render is that same assembly with its geometry held by the
   gate, so shoulder-to-foot is the same fraction of the render's standing
   height. No width or edge is read off clear glass anywhere. Every SKU of a
   body lands on one line (all 9 ml at y = 816, all 5 ml at y = 936). The
   100 ml figure is the lock's own clearance-limited one; nothing else is
   capped.
4. **Bone.** The rendered paper is flattened to #F5F3EF and its grain pulled
   onto exact bone with a soft ramp, so the corner pixels meet the registry's
   2/255 rule and the rendered shadow keeps its gradient.

## The two sample vials

`GBSpry3mlClBlk` and `GBSpry4mlClBlk` are built from the merged composites the
lock itself measured (`17. Additional Bottles/<sku>..psd`), because their
layered masters carry a mirror reflection under the glass that reads as part of
the body layer. Their gate reads the foot and the translucent overcap at 40
levels against the base's own placement bounds; the 70-level mask cannot see
thin clear glass.

## Colour

Sunburst renders matte silver 12 to 57 levels darker than the master and lets matte
gold go pale. The prompt therefore locks colour to the input (matte gold stays pale
champagne, matte silver stays neutral silver, clear glass colourless, neutral white
balance), and every hero's fitment is measured against the base's own pixels above
the glass shoulder. Seventeen matte-silver and pale-gold heroes were re-rendered with
that clause, which halved the drift; the opaque fitment (head, collar, pump, cap
beside) was then brought to the master's colour with one per-channel gain, the
glass left to the model. After that every metal fitment sits within 4 levels and
2 of hue of its master.

## The 25 ml

The six 25 ml SKUs are built from the 30 ml masters the lock itself aliased for them
(`1. Cylindrical 25ml /1. Cylindrical 30ml PSD`), sized on the lock's 46.5 % line.
Their glass height is 83 mm. The two atomizers drift 6 px past the gate on soft parts
(the mesh bulb's crown, the tassel's fringe) and were accepted on inspection.

## Not in this release

7 registered Cylinder SKUs keep their earlier images because the lock built them
from legacy product photographs and no PSD master exists: the four short-cap bare
bottles (`GBCyl5GlMattSht`, `GBCylBlu5SlMattSht`, `GBTallCyl9GlMattSht`,
`GBTallCylFrst9GlMattSht`) and the three plastic flip-tops (`PbClear4ozFlpWh`,
`PbClear8ozFlpWh`, `PbNat16ozFlpWh`).

`approved-lock.json` records each file's sha256, its locked shoulder height and
the PSD it was built from.
