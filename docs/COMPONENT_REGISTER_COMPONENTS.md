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

## 13-415 (2026-09-26)

**Own parts.** `own_build_13415` reads the website SKU the same way: `MtlRoll` / `Roll` + a code is the metal or plastic
roller insert under the roll-on cap `CPRoll13-415<code>`; `Spry` + a code is the sprayer `CP13-415Spry<code>`; a SKU
with no type token names its plain cap (`BlkSht`, `WhtSht` = the short ribbed caps, `Gl`, `Sl` = the tall shiny caps).
The assembly SKUs spell matte "Matt" where the components spell "Mt"; the roll-on caps file matte copper as `Cu` and
the black dotted cap as `BlackDot`; `GBTallRect10MtlRollPinkDo` is a truncated website SKU. The 13-415 sprayers are filed
in Convex as Cap/Closure (applicator Fine Mist Sprayer); `component_type` now types them `fine-mist-sprayer`, so they
cut with their overcap. Result: 478 of 519 sold SKUs resolved. Unresolved: 9 metal atomizers and 3 plastic bottles (own
classes, Jordan 2026-09-24) and 29 short-cap SKUs on the Cylinder 5, Blue 5, Tall Cylinder 9 (clear and frosted), Bell,
Elegant frosted, Pillar and Tulip 6 (`BlkShSht`, `CuSht`, `GlMattSht`, `SlMattSht`, `GlSht`, `SlSht`, one `MinarCu`):
no component record and no master photo.

**Layers.** Every 13-415 master comes as a pair: uncapped (the roller or sprayer on the neck, the cap parked beside the
bottle) and capped. A cap registers on the capped file. The roller inserts are cut from the uncapped photo and cleared
3 px below the rim, as the 17-415 pilot did: the library insert files carry a white masking shape. The library sprayer is
one layer (head and ferrule), and its overcap is a tall metal sleeve that hides the whole sprayer. A master whose largest
layer runs off the canvas is an uncut photo pasted in (the capped Circle 15 black-dot file) and is skipped for the next
SKU sold with the part. 23 components, IoU 0.904 to 0.997, all approved (Jordan 2026-09-26: "I approve all the
approvable ones").

**Draw order (2026-09-26).** Jordan: the clear overcap drew behind the nozzle. `orderLayers` (compose.ts) now draws the
overcap over the mechanism it covers and under the collar; with no collar layer (the 13-415 one-piece sprayer) it draws
last. The library's turquoise 17-415 collar carried a white paper strip on its right edge; `drop_white_edge_strip` clears
such strips on coloured parts at cut time, and the pilot collar was cleaned and reloaded
(`push-phase3.ts --only CMP-SPR-CLR-17-415`).

**Specks (2026-09-26).** Jordan's review sheet showed a white fleck beside the copper 13-415 sprayer and a white paper wedge
on its overcap. `drop_specks` (cut_components.py) runs on every front layer at cut time: pieces detached from the part and
under 1% of it go, with their haze; on a coloured cap or overcap, near-white paper outside the row outline of the coloured
pixels goes when a piece reaches 12 px or more off the outline, so chrome highlights and gold rims stay.
`clean_layers.py --neck <neck>` applies it to layers already cut, in place (canvas kept, so anchors hold). 18-415: nine
layers cleaned, including the paper band on the copper overcap `CMP-SPR-MTCP-18-415-03`; 13-415: six.

## Seating on the neck (2026-09-26)

Jordan: "the caps are not centered on top of the bottle" (Tall Cylinder 9), and the roller "sits a little bit off to the side"
(5 mL cylinder). Two causes, both fixed:

- **Parts.** Anchors came from where each part stood in its product photo, and the photographed part was often a little off
  the glass axis (up to 1.15 mm). `recentre` (cut_components.py) puts each source image's anchor on the part's own centre
  line; layers cut from one image move together (a nozzle disc stays on its head), the overcap is its own source, bulb
  sprayers keep theirs. Applied to 13-415, 18-415, 14.3mm and the 17-415 pilot (`clean_layers.py --recentre`).
- **Plates.** The plate axis was the barrel's centre; on a plate whose glass leans a little (the Tall Cylinder 9 drifts 0.7 mm
  from foot to neck) the neck is elsewhere. `scripts/register/bodies/neck_axis.py` seats every threaded neck (and the Tola's
  14.3 mm) on the neck's own axis: rows from 0.5 mm under the rim to the shoulder's start, median midpoint. 79 plates moved
  (largest 0.72 mm); `anchors.barrelAxisX` keeps the old value; jars, ground stoppers and the heart keep the barrel axis.
  `build_bodies.py` measures the same way on future runs.

**Closures end where the shoulder begins (the stage decides, per bottle).** Jordan: the 9 mL cylinder's sprayer should be
"raised up a little bit"; the 5 mL cylinder's cap "is dropping a little low". One closure serves bottles whose necks differ
(13-415 shoulders begin 9.9 to 17.6 mm under the rim, 18-415 14.2 to 20+), and the parts were measured on long-necked
reference photos, so on a short neck they swallowed the shoulder or sank into the glass (Slim 30, Cylinder 50). Each plate's
`anchors.shoulderY` is now where its shoulder begins (neck_axis.py: two thirds of the way from neck to body width, then back up
the flare past the thread crests; the old mark stays as `bodyShoulderY`), each layer records `solidBottomY` (its lowest solid
row; bulb sprayers excepted, their bulb hangs beside the bottle), and `compose.ts shoulderLiftMm` lifts a bottle's seated
front layers by however far they would reach past its shoulder. Inserts behind the glass stay on the rim. The Diva 46 and the
other long necks do not move; the 5 mL cylinder lifts about 1.1 mm, the Slim 30 about 4 mm.

## Known gaps

- Bulb sprayers keep one cut per finish from one body's photo; the bulb's hang is that photo's. Their dip tube is
  that photo's length too: the stage clips every behind-glass layer (dip tube, pipette) at the plate's baseline,
  so a tube cut on the 100 mL Circle never shows below the Round 78's foot (`BEHIND_GLASS_SLOTS`).
- The reducer insert is not drawn (see above); the Diva ring SKUs and the short shiny-black cap wait on data.
- Frosted-glass references are used only where a Clear photo of the same SKU does not exist.
