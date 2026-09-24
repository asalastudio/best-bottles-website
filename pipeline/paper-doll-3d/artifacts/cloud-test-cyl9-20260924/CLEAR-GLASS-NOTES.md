# Cylinder 9 ml — first CLEAR GLASS still (cloud VM)

Date: 2026-09-24  
Geometry: catalog body `Cyl-round-17-415-70x20` (straight 70×Ø20, 17-415)  
**Not** the wavy `clear.jpg` photo-cutout rebuild.

## PSD / silhouette

PSD library (`~/Projects/Clients/…/Best-Bottles-Original-Photoshop-Sources`)
is **not on this VM**. The only file in `silhouettes/` is the earlier
inward-scan of `clear.jpg` — unused. Geometry is the shipped catalog GLB.

`hollow_body.py` on `public/models/bodies/Cyl-round-17-415-70x20.glb`
aborted: exterior gate **1315 µm** (limit 1 µm). Hero still therefore uses
the official hollowed sibling
`public/models/bodies-thickness/Cyl-round-17-415-70x20.glb` (same body_id,
measured 69.20 × Ø19.98 mm). A solid-body still is kept as
`clear-glass/cyl9_clear_glass_solid.png` — it reads as a glass rod, which
is the documented ceiling when the mesh is solid.

## Material (vs Jordan's two refs)

From `scripts/tune_glass.py` `TUNE["BB_MAT_GLASS_CLEAR"]` and the skill:

| Setting | Value | Why |
|---|---|---|
| View transform | **Filmic** (AgX off) | AgX washes; three.js is not AgX |
| Thin Wall | **OFF** | Volume is ignored if on |
| Base Color | white `(1,1,1)` | Colour lives in volume |
| Volume Absorption colour | `(0.92, 0.97, 0.95)` | What survives; near-clear, slight cool |
| Density | **6.0 / m** | Tiny bottle: 20 mm path → ~89% through |
| IOR | 1.52 soda-lime | Do not drift |
| Roughness | 0.0 | 0.03 already reads as acrylic |
| Transmission | 1.0 | |

Photo 2 (cream studio) is the **plate language**: colorless glass, thick
base, vertical softbox, readable 17-415. Photo 1 (green drape) is the
refraction / wall / environmental-bounce check — not used as the set
(green bounce would dye a clear SKU).

Clear is not invisible: live-site transmission on the 9 ml clear photo is
~0.64–0.68 (HANDOFF / `public/references/9ml/README.md`). Density 6 keeps
that “there is glass” without tinting amber/green.

## Lighting

- Cream cyclorama `#EFE9DE` (documented photoreal bone; matches photo 2)
- Soft dome world (gradient, strength 1.15) — no hard panels
- One tall RECTANGLE area key, 42 W, 0.42 × 1.25 m, off to the left —
  photo 2 verticals without a small source that images inside the glass
- Filmic, look None, exposure −0.05
- Cycles CPU, 128 samples, denoising, transmission bounces 24

## Commands

```bash
BLENDER=~/blender-official/blender-5.2.0-linux-x64/blender
ART=pipeline/paper-doll-3d/artifacts/cloud-test-cyl9-20260924

$BLENDER --background --python $ART/render_cyl9_clear_glass.py -- \
  --glb public/models/bodies-thickness/Cyl-round-17-415-70x20.glb \
  --out $ART/clear-glass --mode both --samples 128 --res-x 1200 --res-y 1600
```

Blender 5.2.0 LTS was still present from the prior install (Berkeley tarball).

## Outputs

| File | What |
|---|---|
| `clear-glass/cyl9_clear_glass.png` | Hero Cycles plate |
| `clear-glass/cyl9_clay.png` | Same camera, clay |
| `clear-glass/cyl9_clay_vs_glass.png` | Pair |
| `clear-glass/cyl9_clear_glass_solid.png` | Solid shipped GLB (acrylic-rod ceiling) |

Do **not** merge into `public/models/` or publish as a catalog plate.
