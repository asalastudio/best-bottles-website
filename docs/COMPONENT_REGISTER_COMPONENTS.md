# Component register — cutting a neck's components (18-415 first)

The Phase 3 pilot (`docs/COMPONENT_REGISTER_PHASE_3_PILOT.md`) cut and measured the 17-415 Cylinder 9 mL
by hand-written rules. This lane generalises the same method to any neck finish, starting with 18-415:
22 glass bodies, 48 current components, 1,263 sold assemblies.

## Two steps

**1. Own parts.** `scripts/register/build_register.py` resolves which component each 18-415 SKU is made
of from the website SKU itself: the type token (`AnSpTsl`, `AnSp`, `Spry`, `Ltn`, `Drp`, `Rdcr`) and the
finish code after it (`GBDiva46AnSpTslMtSl` → `AnSpTsl18-415MtS`). Convex's `capColor` is not used for
this neck: it leaks the glass colour on the vintage sprayers and drops "Light" from the leather caps.
A Reducer SKU resolves to the cap it is sold with; the orifice reducer sits inside the neck under a cap the
page never takes off, so it is not part of the drawn build. Result: 1,213 of 1,263 resolved. Unresolved:
29 `RdcrShnBlk` SKUs (no short shiny-black 18-415 cap product exists in Convex; the library holds
`CP18-415ShnBlk.psd`), 9 Diva ring SKUs (`…Rng`, a decorative ring with no component record), 12 others.

**2. Layers.** `scripts/register/components/cut_components.py --neck 18-415` reads the master library
read-only and writes native cut-outs to `output/register-components/18-415/` (gitignored), every number
to `data/register/components/18-415-measurements.json`, and `review-components.png` beside the cuts.

- Reference photo: a master PSD of a SKU sold with the part, Clear glass first. Every 18-415 SKU master
  carries the bare body as its own layer. Sprayer and pump SKUs come as two files: the pump exposed with
  its overcap parked beside the bottle, and the overcap on.
- Scale: tied to the body's register plate, not to millimetres. The plate was fitted to this same photo
  geometry, so `px/mm(photo) = px/mm(plate) × seat-to-foot(photo) / seat-to-foot(plate)`. Whatever the
  63 scale flags decide, the components land on the plate at the plate's own scale.
- Caps, fine-mist sprayers and lotion pumps: the library PSD (`20. Caps`) is registered on the closure as
  it sits on the photo (silhouette fit; IoU is the self-check, 0.90 or better is approvable). That gives
  the library layer's px/mm and its rim anchor. The overcap is cut from the overcap-on file at the photo's
  scale: the closure layer that sits on the neck (wide, its bottom near the rim). The tallest layer of that file
  is the dip tube, and taking it drew a white stripe over the glass in CAP ON (fixed 2026-09-25).
- Droppers and vintage bulb sprayers: cut from the photo. The dropper library files hold no pixel
  layers, and the bulb-sprayer library files show the bulb on a long hose and dip tube that the product
  photos do not (registering them scored IoU 0.25–0.42). The photographed top is split at its collar: the
  collar and everything above it draw in front of the glass; the narrow part on the axis below the collar
  (pipette, dip tube) draws behind it.

## Loading

```bash
npx tsx scripts/register/push-register.ts --apply                                   # the own parts (assemblies.build)
npx tsx scripts/register/components/push-components.ts --neck 18-415                # dry run
npx tsx scripts/register/components/push-components.ts --neck 18-415 --apply --approve
```

Dev only. Approvable components load as `approved`; the rest as `measured` and are not drawn. A SKU
renders from the register once its plate and every part it names are approved (`registerStage:forSkus`).

## 14.3 mm — the Tola plug

The two Tola decorative bottles (3 and 6 mL; `GB3TPlGl`, `GB6TPlGl`) are sold with one closure, the ribbed
plastic plug photographed in their neck. Jordan 2026-09-25: the plug is separate from the glass. The bodies
lane cuts it (`scripts/register/bodies/build_bodies.py`, `plug_layers`): the seated layer is the head above the
glass rim (usage `seated`, drawn in CAP ON and SIDECAR); the exploded layer is the head plus a synthesised stem
(usage `exploded`). Component `LIB-14.3mm-Plug`, type plug-applicator, slot cap, px/mm the 3 mL plate's own;
numbers in `data/register/components/14.3mm-measurements.json`, loaded with `push-components.ts --neck 14.3mm`.
`build_register.py` resolves both Tola assemblies to `cap:LIB-14.3mm-Plug`.

## Known gaps

- Bulb sprayers keep one cut per finish from one body's photo; the bulb's hang is that photo's.
- The reducer insert is not drawn (see above); the Diva ring SKUs and the short shiny-black cap wait on data.
- Frosted-glass references are used only where a Clear photo of the same SKU does not exist.
