---
name: bestbottles-glass-material-lab
description: Solve photoreal browser glass for a Best Bottles colourway or body — the measurement loop, the physics rules, and the asset prerequisites. Use when tuning glass materials, adding a colourway, judging "it looks fake/matte/too dark", or fixing reflection artefacts (lines, stripes, speckle) on bottles in three.js.
---

# Best Bottles — glass material lab

Solving glass by eye takes a day and regresses. This is the loop that solved
amber in an afternoon, plus the rules that were paid for in rejected renders.
**Measure. Never eyeball, never ship a render you have not looked at yourself.**

## The three-part truth

Glass realism is **asset + environment + material**, and it fails if any one is
wrong. Tuning the material to fix an asset problem is the classic time sink.

1. **Asset** — must be a HOLLOW vessel with real walls, and must carry a baked
   `thicknessMap`. A solid mesh is dyed acrylic and no material value saves it.
2. **Environment** — an HDRI with a dark base field and its punch ABOVE the
   bottle. See "Lighting law" below; this is where most artefacts come from.
3. **Material** — the preset. Tune this LAST.

## Prerequisites (do these before touching a slider)

```bash
# 1. hollow the body (exterior silhouette is gated, threads untouched)
blender -b --factory-startup -P pipeline/paper-doll-3d/scripts/hollow_body.py -- \
  --glb public/models/bodies-threaded/<BODY>.glb \
  --out public/models/bodies-threaded/<BODY>.glb

# 2. bake per-texel thickness -> bodies-thickness/<BODY>.{glb,thickness.png,.json}
blender -b --factory-startup -P pipeline/paper-doll-3d/scripts/bake_thickness.py -- \
  --glb public/models/bodies-threaded/<BODY>.glb \
  --out public/models/bodies-thickness

# 3. the approved room environment
python3 pipeline/paper-doll-3d/scripts/make_studio_hdri.py --room
```

Then open `/dev/material-lab`. `thicknessMap (baked)` and `room` must be on —
a preset approved without them is meaningless.

## The measurement loop

Glass brightness is only meaningful **relative to the backdrop behind it**, so
every number here is a ratio. Run this in the browser console (or via the
javascript tool) to read the live canvas:

```js
const c = document.querySelector('canvas');
const gl = c.getContext('webgl2') || c.getContext('webgl');
const r = await new Promise(res => requestAnimationFrame(() => {
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const buf = new Uint8Array(W * 4);                     // find the bottle
  gl.readPixels(0, Math.round(H * (1 - 0.52)), W, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let lo = -1, hi = -1;
  for (let x = 0; x < W; x++) if (buf[x*4] < 150) { if (lo < 0) lo = x; hi = x; }
  const cx = Math.round((lo + hi) / 2);
  const g = (x, fy) => { const b = new Uint8Array(4);
    gl.readPixels(x, Math.round(H*(1-fy)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
    return [b[0], b[1], b[2]]; };
  res({ backdrop: g(Math.round(W*0.08), 0.5), mid: g(cx, 0.52), upper: g(cx, 0.34) });
}));
const b = r.backdrop, T = p => p.map((v, i) => +(v / b[i]).toFixed(3));
({ T_mid: T(r.mid), B_over_R: +(T(r.mid)[2] / T(r.mid)[0]).toFixed(3) });
```

`readPixels` inside `requestAnimationFrame` is required — `toDataURL` returns
blank because `preserveDrawingBuffer` is false.

Measure the reference photo the same way (script in the repo history: isolate
the bottle by luminance, sample body-mid against the backdrop columns) and
tune until the ratios agree. **`B/R` — blue over red — is the saturation
number and the one that matters**; matching absolute brightness is optional
because a photograph carries its own exposure.

### When the ratio method does NOT apply

**It only works where absorption dominates — amber and cobalt.** For a
near-colourless finish (clear, frosted, swirl) the reference ratio is
unreachable and chasing it produces grey plastic:

- clear measures .689 on the reference, but sweeping absorption on the live
  canvas bottoms out at **.913** even at `attenuationDistance` 0.012
- swirl measures **above 1.0** — brighter than the backdrop, which absorption
  cannot produce at all; the flutes concentrate light

A colourless bottle gets its presence from **refraction, edges and
reflection**, and the reference was shot in a room with far more to refract
than our studio. Judge those finishes **structurally** — are the edges, the
far wall and the shoulder legible? — and keep their absorption minimal.
`roughness` carries frosted (0.55) and swirl (0.30); it is their identity.

### Reference targets, measured from public/references/9ml/

| colourway | R | G | B | B/R |
|---|---|---|---|---|
| amber   | 0.127 | 0.035 | 0.003 | 0.03 |
| clear   | 0.689 | 0.686 | 0.678 | 0.98 |
| frosted | 0.727 | 0.722 | 0.709 | 0.98 |
| cobalt  | 0.007 | 0.066 | 0.608 | 84.5 |
| swirl   | 1.108 | 1.160 | 1.208 | 1.09 |

## Physics rules (each one cost a rejected render)

**Reflection is a fixed colourless floor.** It does not care what the glass is
doing. Therefore:

- **Washed out / matte / "not amber enough" → MORE transmission or a DARKER
  room. NEVER more absorption.** Raising `attenuationDistance` 0.011 → 0.015
  made amber *more* saturated (B/R 0.41 → 0.23) while making it brighter,
  because it lifted the tinted signal above the neutral floor. Cranking
  absorption dims the tint while the floor stays put, and the glass drifts to
  grey-black.
- **A reflection is only visible where the mirrored world differs from the
  transmitted backdrop.** A uniform bright environment erases every highlight —
  that is what "matte" means here.

**Dark glass sharpens everything.** Absorption swallows a gradient's dim
shoulders and leaves its bright core as a hard band, so feathering alone cannot
rescue a source that is too defined.

## Lighting law — where artefacts come from

**No above-ambient emitter may sit near the horizon (phi ~0.8–1.3).**

An environment map lives at INFINITY, so any bright source near the horizon is
mirrored by a straight cylinder wall along its ENTIRE height. This is geometry,
not falloff: softening, dimming and widening all fail. A real studio light sits
at a finite height ABOVE the bottle, so its reflection lands on threads,
ledge and shoulder and never on the wall.

**All punch goes HIGH in the sphere (phi <= ~0.45); the horizon stays one very
wide, very gentle gradient.** Five rejected attempts died to this: narrow hot
strip, defined-edge window, rim columns at the silhouette, single wide face
dome. Rooms are HDRIs, never JSX `Lightformer` rects (rects have no falloff).

## Artefact → cause

| symptom | cause | fix |
|---|---|---|
| vertical line(s) down the wall | emitter near the horizon | move it high (phi <= 0.45) |
| "painted on" strip | narrow source; >~8x clips to flat white after ACES | wide + moderate, or move it high |
| serrated fringe at a ledge | boolean discarded split normals | `shade_auto_smooth(38 deg)` after the boolean |
| white speckle along seams | bake background is black → zero thickness at UV island edges | pre-fill the bake image with the median |
| matte / fake / no reflection | uniform bright environment | cut the HDRI base field |
| grey-brown instead of tinted | neutral reflection floor dominating | more transmission or darker room |
| everything black | viewport background is dark — glass TRANSMITS it | light backdrop |

## Recording an approval

Presets are DATA (`src/lib/materials/glassPresets.ts`), tuned in the lab and
consumed by the configurator through `applyGlassPreset` — one code path.

- Read the approved numbers **back out of the live session**; never reconstruct
  them from notes.
- `provenance` records where they came from, what they were approved AGAINST
  (body, bake, studio, exposure), and what was superseded. A preset is only
  half a look: these values read near-black on a solid mesh.
- Tag a restore point before any experiment: `git tag -a <name> -m "..."`.
- **Surface** (`ior`, `clearcoat`, `clearcoatRoughness`) is one physical glass
  and must NOT differ by colourway. **Absorption** is per colourway.
  `roughness` is per FINISH — frosted and swirl own theirs; do not propagate.
- **`envRotationDeg` is per colourway** so the finishes do not all catch the
  light in the same place (amber 0, frosted 18, cobalt 34, swirl 46,
  clear 62). It rotates the SAME approved room, adding no emitters, so it
  cannot reintroduce the horizon-line artefact.
- **Watch for a floor-limited channel.** Cobalt's green measured .035 for
  every value from `#060cc4` to `#0620c4` — that is the neutral reflection
  floor, not the glass. When a channel stops responding to the colour, stop
  turning that knob.

## Approved state (2026-08-31)

Amber, on the hollow 9 mL body with its bake, room v9 at exposure 0.91:

```
transmission 1.0   roughness 0.02   ior 1.54   thickness 0.0165
attenuationDistance 0.015   attenuationColor #8f4a16
dispersion 0.95   clearcoat 0.70   clearcoatRoughness 0.02
```

Cobalt, solved the same way: `#060cc4` at the same surface and optical
treatment — measures .000/.035/.592 against a .007/.066/.608 reference.

Restore point: tag `aesop-amber-v1`. Register: **Aesop** — dark apothecary
amber, bone sweep, soft studio, one broad sheen and no lines.
