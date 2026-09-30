# Boston Round dropper pipette: 3D tube spec (2026-09-29)

**For:** the Blender session. **Requested by:** Jordan, 29 Sep 2026 ("write the tube spec").
**Drawing:** `boston-dropper-pipette-2026-09-29.png`, beside this file (to scale, 10 px = 1 mm).

## What this is for

The Boston Round droppers are being rebuilt as separate register layers:

- **Bulb and collar:** stay photographed. They're Best Bottles' own photos, the six finishes already match the photographed caps and roll-ons, and the collar images are done.
- **Glass pipette:** 3D. The photographed tubes are painted white by the retoucher. The amber and cobalt photos don't show the tube at all. The one loose-dropper photo uses a single stand-in length for every size. So the tube is the one part that needs a model.

The renders feed two views on the product page and in Build Your Bottle:

1. **CAP ON, clear glass:** the tube seen inside the clear bottle, drawn in front of the glass image.
2. **EXPLODED, every glass:** the whole dropper lifted out of the bottle as one piece, with the tube in the air under the collar.

## Geometry

Model the tube as a revolved profile around a vertical axis. It's a plain glass tube with no markings, no graduations and no ribs.

| | Value | Source |
|---|---|---|
| Outside diameter, straight section | **7.0 mm** | high-res loose dropper photo, scaled by the 23.4 mm collar |
| Wall | **0.9 mm** (bore 5.2 mm) on the straight section; thinning with the taper to about 0.55 mm at the tip | the dark wall bands in the same photo |
| Straight section ends | **14.5 mm** from the tip end | photo profile |
| Top end | open, square cut; hidden inside the bulb | not visible in any view |
| Tip end | open, fire-polished (edge radius about 0.3 mm), bore about 1.2 mm | photo |

**Taper profile** (distance from the tip end → outside diameter, mm). Interpolate smoothly; the shoulder between 14.5 and 11 mm is a soft S-curve, not a cone.

| from tip | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 12.8 | 14 | 14.5 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OD | 2.4 | 3.1 | 3.3 | 3.5 | 3.8 | 4.0 | 4.1 | 4.3 | 4.4 | 4.6 | 4.8 | 5.1 | 5.7 | 6.5 | 6.95 | 7.0 |

**Three lengths.** The overall length comes from the part numbers, and the seating comes from the bottle photos. When the dropper is screwed on, the tip sits this far under the glass rim:

| Bottle | Neck | Tube length | Tip under the rim | Top above the rim (inside the bulb) | Part numbers |
|---|---|---|---|---|---|
| 15 mL | 18-400 | **66 mm** | 62.2 mm | 3.8 mm | CMP-DRP-*-18400-66 |
| 30 mL | 20-400 | **76 mm** | 70.2 mm | 5.8 mm | CMP-DRP-*-20400-76 |
| 60 mL | 20-400 | **90 mm** | 85.2 mm | 4.8 mm | CMP-DRP-*-20400-90 |

The collar's bottom edge is 10 mm under the rim on both necks (9.6–10.6 mm measured), so the visible tube runs from there down to the tip.

## Material

Clear, colourless soda-lime glass: IOR 1.5, roughness 0, full transmission, no tint. The register's clear glass has no colour cast by rule, so don't add a green edge tint.

## Renders

- **Engine and film:** Cycles. Film > Transparent **and** Transparent Glass (roughness threshold 0.1), so the tube shows whatever is behind it: the page background, amber, or cobalt.
- **Camera:** orthographic, straight on (front view, no tilt), tube vertical and centred.
- **Scale:** **30 px per mm**. Canvas 400 px wide, with the axis at x = 200. The tube's top end sits at y = 60 px, so the tip is at 60 + length × 30.
- **Output:** PNG, RGBA, 16-bit, straight (unpremultiplied) alpha, sRGB, view transform **Standard** (not Filmic or AgX, so white stays white).
- **Lighting:** glass reads from its edges, so use a dark studio with two tall softbox strips, one left and one right, slightly behind the tube, plus a soft top light. The target is thin dark edge lines with bright vertical highlights on both walls, like the reference images below. No floor and no shadow.

**Files:** one per length, three in all, plus a sidecar each:

```
pipette-66-air.png   pipette-66-air.json
pipette-76-air.png   pipette-76-air.json
pipette-90-air.png   pipette-90-air.json
```

`pipette-<length>-air.json`:

```json
{ "lengthMm": 76, "pxPerMm": 30, "axisX": 200, "topY": 60, "tipY": 2340, "tipUnderRimMm": 70.2, "renderer": "Cycles", "blendFile": "<path>" }
```

**Deliver to:**
`/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/quizzical-engelbart-4f51f4/output/register-components/20-400/blender/`

Keep the .blend file with the renders.

## References to match

- **Clear glass look:** the new Boston clear glass: `output/register-bodies/final-hero/boston-round-30ml-20-400/clear.png` in the worktree above. Match its edge darkness and highlight width.
- **Tube shape:** the loose dropper photo: `BB-PSD-Files-Master/1.  20-400 (1 oz & 2 oz) the 15ml 18-400 Boston Round/2. 20-400 High Res Caps/Droppers/8. 20-400Drp1ozBlckBulb.psd`, layer "Layer 3". Its length is a stand-in; ignore it.

## Acceptance

Before handing over, check that:

- Each tube measures its length × 30 px from top to tip, and 210 px (7.0 mm) across the straight section.
- Composited over #F5F3EF, #7A4A12 (amber) and #1A2FB0 (cobalt), the background shows through the tube and there's no white fill.
- The edges are crisp at 100%, with no fireflies or noise.

After delivery I seat the renders under the photographed collars at each size's tip depth. I build the CAP ON (clear) and EXPLODED layers, then review them with Jordan before anything goes live.

## Open items (not for Blender)

- **Catalogue:** `CMP-DRP-BLK-18400-90MM` (15 mL black-bulb dropper) says 90 mm. A 90 mm tube can't fit a 15 mL Boston (70 mm from rim to foot), and its five siblings say 66 mm. It's probably a data error; confirm with Jordan.
- **Apparent width inside the bottle:** in the clear bottle photos the tube looks 6.3–6.6 mm wide in the 30 mL and 7.7–8.6 mm in the 60 mL, because the round glass magnifies it sideways. The CAP ON layer may need a small horizontal scale per size; that happens in compositing, not in Blender.
