# Render Design System — schema + colour management proposal

Status: **PROPOSAL, nothing built.** The brief asks for these two decisions
first because they constrain everything downstream. Findings below are
measured from the repo on 2026-08-31, not assumed.

---

## 1. What is actually true today

### 1.1 There is no single token file. There are three sources.

| # | Source | Covers | Consumed by | Authored by |
|---|--------|--------|-------------|-------------|
| 1 | `public/models/materials.json` (45 entries) | closures, caps, plastics, studs | **web only** | extracted FROM `materials.blend` |
| 2 | `src/lib/materials/glassPresets.ts` | all glass | **web only** | hand-authored TypeScript |
| 3 | `build-master-scene.py` `GLASS_VARIANTS` + `mat_glass()`, and per-part materials in `closures.py` | Blender product scenes | **Blender only** | hand-authored Python |

A bridge exists — `pipeline/paper-doll-3d/scripts/materials.py` `build` / `extract` —
but it runs the **opposite direction** to the brief: `materials.blend` is the
authoring surface and `materials.json` is the derived artifact. It also only
covers group 1. The Blender scenes that render heroes never read
`materials.json` at all.

**Consequence:** glass is defined twice with different shapes, and a metal
approved in the browser has no path into a hero render. This is the drift
Jordan is seeing.

### 1.2 Colour management is mismatched, and the mismatch is already
being hand-compensated

- Blender: `scene.view_settings.view_transform = "Standard"` — a plain
  linear-to-sRGB transfer with no filmic shoulder.
- Web: `<Canvas>` does not set `toneMapping`, so it takes React Three
  Fiber's default, **ACESFilmic**. Only `toneMappingExposure` is passed.

These do not match, and the material notes prove the team has already been
paying for it. From `CAP_SHINY_GOLD`:

> "ACES desaturates clipped highlights — coloured metals run LOWER
> envMapIntensity than silver so their hue survives the tone curve."

That is an ACES correction baked into an approved value. Under Blender's
Standard transform the same number is simply wrong. Any material moved
between lanes today lands mis-tuned.

Exposure also drifts: it is per-studio-preset on the web
(`1.05 / 0.91 / 0.95 / 1.05`) and absent as a shared concept.

### 1.3 The two lanes do not share an environment

- Web: `/models/studio-classic-clean.hdr` (dark-lifted, horizon-melted
  Poly Haven `studio_small_03`), plus per-glass `envRotationDeg` (clear = 62°).
- Blender: builds a **procedural** `QA_WORLD`. No HDRI, no matching rotation.

The brief calls the shared HDRI non-negotiable and it is right to: for
metals, which are ~100% reflection, the environment *is* the material.

### 1.4 The camera is a 1.5× mismatch — measured

| Lane | Setting | Vertical FOV | Equivalent lens |
|---|---|---|---|
| Blender `BB_CAM_MASTER` | `lens = 100mm`, `sensor_width = 36` | 20.41° | 100 mm |
| Web `<Canvas camera>` | `fov: 30` | 30.00° | **67.2 mm** |

The configurator is shooting **1.49× wider** than the hero lens, and 67 mm
sits outside the 85–105 mm band the brief specifies for product work. This
is a proportion difference buyers can see, independent of any material.

To match: web `fov` → `20.41`, and the orbit radius must grow **1.489×**
to hold framing — `max(0.22, h*3.15)` becomes `h*4.69`.

### 1.5 What is already correct

- Units are consistent and documented: Blender scenes are 1 BU = 1 mm and
  `export_web_body.py` converts to metres (`v.co *= 0.001`) for the GLB.
- Origins already mate: every closure part origins on the neck rim, which
  is why a cap swap needs no offset table.
- Texture colour spaces are right: matcaps `SRGBColorSpace`, matte
  normal/roughness `NoColorSpace`.
- Naming is already SKU-traceable: `BB_{PART}_{FINISH}`.
- `material_lock.py` already pins sha256 over renderer-loaded files and
  material values. Approvals are recorded in `note` fields.

That last point matters: **the approved, locked values live on the web
side.** It constrains the migration order in §3.

---

## 2. Proposed token schema

### 2.1 The one decision that fixes Jordan's complaint

Today tokens are named by **part** — `CAP_SHINY_GOLD`, `SPRAY_TURQUOISE`,
`PART_STUD_CHROME`. Nothing structurally guarantees that a gold cap and a
gold sprayer collar are the same gold; they are the same only as long as
someone remembers to point them at the same entry. When that memory fails
you get exactly the inconsistency being reported. (It failed this week: the
antique atomizer's fitment was given a hand-rolled metal with
`envMapIntensity` capped at 1.1 against shiny silver's approved 2.4, and
read flat white next to correct caps.)

So: **tokens are physical materials; parts are assignments.**

```
materials   metal.gold.polished          <- one gold, defined once
assignments BB_CAP_18415       -> metal.gold.polished
            BB_SPR_COLLAR_18415 -> metal.gold.polished
```

"Any two parts sharing a token are visually identical" then holds by
construction rather than by discipline, and a new part picks up correct
materials by naming convention alone.

### 2.2 Core is renderer-neutral; lane blocks are *compensations*

Only physically meaningful values live in the core. Renderer-specific
knobs — `envMapIntensity` has no Cycles equivalent; `distortion` and
`anisotropicBlur` are `MeshTransmissionMaterial` approximation controls —
live in `lanes`, and **every lane value must carry a `why`**. That keeps
hard-won knowledge (the ACES compensation) without letting it quietly
become a second source of truth.

### 2.3 Colour is stored linear; hex is derived

The repo has already been bitten by double-encoding — "library colour
arrays are ALREADY sRGB fractions, map ×255, never re-encode (double
encoding washed the golds out)". Make that structurally impossible:
`baseColorLinear` is normative, `baseColorHex` is generated, and the
generator asserts they agree.

### 2.4 Schema

```jsonc
{
  "schemaVersion": "1.0.0",
  "colorManagement": { "$ref": "#/colorManagement" },
  "environment": {
    "hdri": "/models/studio-classic-clean.hdr",
    "rotationDeg": 62,          // MUST be mirrored in the Blender world
    "exposure": 1.0             // identical in both lanes, no per-preset drift
  },
  "camera": {
    "focalLengthMm": 100, "sensorWidthMm": 36,
    "heroAngleDeg": [0, 0], "orbitLimits": { "polarDeg": [60, 100] },
    "heroDepthOfField": true, "configuratorDepthOfField": false
  },

  "materials": {
    "metal.gold.polished": {
      "class": "metal",
      "baseColorLinear": [1.0, 0.8927, 0.5900],
      "baseColorHex": "#ffe496",        // derived; generator asserts match
      "metalness": 1.0,
      "roughness": 0.09,                 // never 0 — a mirror reads as nothing
      "ior": 1.5,
      "specularColorHex": "#f8fffd",
      "provenance": "physicallybased.info metal F0; sRGB fractions, ×255 direct",
      "approvedBy": "jordan", "approvedOn": "2026-08-31", "locked": true,
      "lanes": {
        "web":     { "envMapIntensity": 1.62,
                     "why": "ACES desaturates clipped highlights; coloured
                             metals run lower than silver so hue survives" },
        "blender": { "why": "no envMapIntensity analogue; HDRI strength 1.0" }
      }
    },

    "glass.flint": {
      "class": "glass",
      "transmission": 1.0, "ior": 1.52, "roughness": 0.05,
      "attenuationColorHex": "#f0f4f0",   // faint iron-green; white reads plastic
      "attenuationDistanceM": 0.8,
      "clearcoat": 1.0,
      "thickness": { "source": "geometry",
                     "bake": "/models/bodies-thickness/{bodyId}.thickness.png",
                     "fallbackM": 0.0095,
                     "why": "real wall thickness per body; a flat value is
                             only valid on the thin-wall path" },
      "lanes": {
        "web":     { "distortion": 0.05, "anisotropicBlur": 0.05,
                     "transmissionResolution": 512,
                     "mobileFallback": "MeshPhysicalMaterial" },
        "blender": { "boreFrost": true,
                     "why": "moulded bore is matte on real bottles" }
      }
    },

    "polymer.leather.black": {
      "class": "polymer",
      "baseColorLinear": [0.021, 0.021, 0.023],
      "metalness": 0.0, "roughness": 0.62, "sheen": 0.25,
      "maps": { "normal": "/models/pbr/leather/normal.png",
                "roughness": "/models/pbr/leather/roughness.png",
                "repeat": [3, 1] },
      "provenance": "traced from 20. Closures .../leather cap PSDs"
    }
  },

  "assignments": {
    "BB_CAP_18415":        { "SHN_GOLD": "metal.gold.polished", "...": "..." },
    "BB_SPR_COLLAR_18415": { "SHN_GOLD": "metal.gold.polished" },
    "BB_ANSP_COLLAR_18415":{ "SHN_GOLD": "metal.gold.polished" }
  }
}
```

`class` drives validation: `metal` must have `metalness: 1` and
`roughness > 0`; `polymer` must have `metalness: 0` (this is the audit the
brief asks for — polymers that inherited non-zero metalness from a bad
export); `glass` must carry attenuation and a thickness source.

### 2.5 Generators

- `materials.py --emit-blender` — reads tokens, builds Principled BSDF node
  groups. Replaces `GLASS_VARIANTS` and the per-part materials in
  `closures.py` as the source of truth.
- `src/lib/materials/registry.ts` — generated, exports memoized
  `MeshPhysicalMaterial` instances. Replaces the `build()` closure in
  `Bottle3DViewer.tsx`, the ad-hoc metal path, and `glassPresets.ts`.

Both generated in CI; `material_lock.py` extends to cover the token file so
a drifted value fails the gate rather than shipping.

---

## 3. Proposed colour management

### 3.1 Target: ACESFilmic, and move **Blender** to meet the web

Three candidate targets:

| Option | Cost |
|---|---|
| Move web to Standard/None | **Invalidates every locked approval.** The wet-look blacks and metal sheens were tuned against the ACES shoulder; without it they clip. |
| Move both to AgX | three.js has no AgX. Would need a custom shader pass, and still not identical. |
| **Move Blender to an ACES view transform** | Re-renders heroes, but the approvals survive. |

**Recommendation: option 3.** The reasoning is not aesthetic — it is that
approvals are the scarcest asset in this system, they live on the web side,
and they are already ACES-compensated. Matching in the other direction
throws them away.

### 3.2 Concretely

1. **Pin the web explicitly.** Stop relying on the R3F default:
   `gl={{ toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}`.
   An implicit default is a value that can change under a library upgrade.
2. **Single exposure token.** Collapse the four per-preset
   `toneMappingExposure` values to one shared number. Per-preset exposure is
   drift with a nice name.
3. **Blender:** `view_transform` → ACES (install the ACES OCIO config, or
   the closest shipped transform), exposure 0, `Filmic`/`AgX` off.
4. **Share the HDRI.** Point the Blender world at
   `studio-classic-clean.hdr` at the documented rotation. Delete `QA_WORLD`'s
   procedural lighting. Note the rotation in the token file — an unmatched
   world rotation moves every highlight and quietly breaks parity.
5. **Measure, don't assume.** Render a parity chart in both lanes: an
   8-step neutral ramp, the 5 metals, the 5 glasses, identical camera and
   HDRI. Record per-patch ΔE and publish the residual as the documented
   delta. Nothing is signed off on "looks close".

### 3.3 Honest risk

Switching Blender's view transform **changes every hero still already
rendered.** That is the real cost of this proposal and it should be an
explicit decision, not a side effect. If the existing heroes are considered
locked, the alternative is to keep the two transforms and publish a
measured correction LUT — worse, but survivable.

---

## 4. Sequencing

1. Token schema + colour management signed off (this document).
2. Pin web tone mapping; collapse exposure to one token. *(Cheap, no visual
   change, stops future drift.)*
3. Port the 45 materials + 5 glass presets into the new schema, preserving
   every `note`, approval and lock verbatim.
4. Generate the R3F registry; delete hand-rolled material paths in
   `Bottle3DViewer.tsx`. **This alone fixes the gold/silver inconsistency.**
5. Generate the Blender side; retire `GLASS_VARIANTS`.
6. Share the HDRI; switch the Blender view transform; render the parity chart.
7. Fix the camera: web `fov` 30 → 20.41, radius `h*3.15` → `h*4.69`.
8. Reference sheet: every token on a sphere and on a real part, both lanes.

Steps 2–4 are worth doing even if the Blender lane never changes, because
they fix the reported inconsistency on their own.

## 5. Open questions for Jordan

1. **Are the existing hero stills locked?** Answer decides §3.3.
2. **Leather maps** — we have five `LEATHER_*` colours but no real
   normal/roughness textures. Source from ambientCG/physicallybased and
   self-host, or photograph the actual caps?
3. **Camera fix now or after launch?** It is a visible proportion change to
   every 3D PDP.
