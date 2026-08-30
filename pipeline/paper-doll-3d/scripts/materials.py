#!/usr/bin/env python3
"""The material library: authored in Blender, consumed by the browser.

WHY A .BLEND AND NOT MATERIALS IN THE GLB
-----------------------------------------
glTF does carry PBR materials, and a Blender Principled BSDF exports cleanly as
factors (baseColor, roughness, metallic, plus KHR_materials_clearcoat /
_transmission / _ior / _anisotropy) with no UVs needed. Verified 2026-08-30.

But baking them into the parts would freeze ONE colourway per file: ten cap
finishes would become ten GLBs instead of one file plus a swatch click, and the
instant switching goes away. So the GLBs stay geometry-only — the contract is
unchanged — and the material VALUES travel as data instead.

    build   creates/updates materials.blend, a library of named materials with
            nothing but Principled BSDF sliders. Open it, set Cycles to
            rendered preview, and tune what you see.
    extract reads that .blend and writes public/models/materials.json, which
            the React viewer loads in place of hardcoded values.

The starting values are the MEASURED ones — cap colours sampled from the
isolated layers in "20. Closures .../12. 17-415 Roll on", glass from the
current presets — so tuning starts from evidence rather than from zero.

WHAT WILL NOT TRANSFER
----------------------
Only Principled BSDF SLIDERS survive. Procedural node graphs (noise, mixes,
geometry nodes) do not export and would have to be baked to textures, which
needs UVs these meshes deliberately do not have. Author with sliders.

And Cycles is not three.js: Blender path-traces with true refraction and
caustics, three.js rasterizes an approximation. The VALUES transfer exactly;
the LOOK will still need a browser check. Expect to go back and forth once.

    blender --background --python scripts/materials.py -- build
    blender --background --python scripts/materials.py -- extract
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy

LANE = Path(__file__).resolve().parents[1]
BLEND = LANE / "materials.blend"
OUT = LANE.parents[1] / "public" / "models" / "materials.json"

# role -> starting values. `role` is matched against the MESH NAME in the
# browser, which is why parts ship with stable names.
LIBRARY = {
    # ---- glass -----------------------------------------------------------
    "GLASS_CLEAR":   dict(base="#ffffff", rough=0.03, metal=0.0, ior=1.52,
                          transmission=1.0, coat=0.0,
                          atten_color="#eef6f2", atten_dist=0.42),
    "GLASS_FROSTED": dict(base="#ffffff", rough=0.55, metal=0.0, ior=1.50,
                          transmission=0.98, coat=0.0,
                          atten_color="#f4f6f5", atten_dist=0.28),
    "GLASS_AMBER":   dict(base="#ffffff", rough=0.04, metal=0.0, ior=1.52,
                          transmission=1.0, coat=0.0,
                          atten_color="#a8571a", atten_dist=0.030),
    "GLASS_COBALT":  dict(base="#ffffff", rough=0.04, metal=0.0, ior=1.52,
                          transmission=1.0, coat=0.0,
                          atten_color="#123f9e", atten_dist=0.026),
    "GLASS_GREEN":   dict(base="#ffffff", rough=0.04, metal=0.0, ior=1.52,
                          transmission=1.0, coat=0.0,
                          atten_color="#1f6b3a", atten_dist=0.028),

    # ---- closure shells: MEASURED from the cap PSDs ----------------------
    # plated = vacuum-metallized (a real metal layer under lacquer).
    # The rest are pigmented PHENOLIC, which is a dielectric: metal 0.
    "CAP_SHINY_SILVER": dict(base="#828282", rough=0.10, metal=1.0, coat=0.35),
    "CAP_MATTE_SILVER": dict(base="#c0c0c0", rough=0.48, metal=1.0, coat=0.35),
    "CAP_SHINY_GOLD":   dict(base="#9b9062", rough=0.13, metal=1.0, coat=0.35),
    "CAP_MATTE_GOLD":   dict(base="#c5b375", rough=0.44, metal=1.0, coat=0.35),
    "CAP_COPPER":       dict(base="#975a42", rough=0.28, metal=1.0, coat=0.35),
    "CAP_SHINY_BLACK":  dict(base="#292929", rough=0.09, metal=0.0, coat=0.90),
    "CAP_WHITE":        dict(base="#f1f1f1", rough=0.42, metal=0.0, coat=0.90),

    # ---- fixed-role parts (never take the colourway) ---------------------
    "PART_STUD_STEEL":   dict(base="#f2f4f6", rough=0.06, metal=1.0, coat=0.50),
    "PART_BALL_STEEL":   dict(base="#cfd2d6", rough=0.18, metal=1.0, coat=0.0),
    "PART_BALL_PLASTIC": dict(base="#eeece4", rough=0.45, metal=0.0, coat=0.0),
    "PART_HOUSING_PP":   dict(base="#e8e6dd", rough=0.40, metal=0.0, coat=0.0),
    "PART_ACTUATOR_PP":  dict(base="#f4f4f2", rough=0.38, metal=0.0, coat=0.0),
    "PART_REDUCER_PP":   dict(base="#e9e7df", rough=0.42, metal=0.0, coat=0.0),
    "PART_OVERCAP_CLEAR": dict(base="#ffffff", rough=0.12, metal=0.0, ior=1.49,
                               transmission=0.94, coat=0.0),
}


def srgb_to_linear(c):
    """sRGB 0-1 -> linear. Blender's Base Color is LINEAR.

    Feeding a measured sRGB value straight in and converting again on extract
    double-gammas it: #292929 came back as #6f6f6f. The measured hex is the
    truth, so it is stored as hex and converted at both boundaries.
    """
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c):
    return c * 12.92 if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def hex_to_linear(h):
    h = h.lstrip("#")
    return tuple(srgb_to_linear(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4))


def linear_to_hex(rgb):
    return "#" + "".join(
        "%02x" % max(0, min(255, round(linear_to_srgb(float(c)) * 255)))
        for c in rgb[:3])


def _set(bsdf, name, value):
    if name in bsdf.inputs:
        bsdf.inputs[name].default_value = value


def build():
    """Create or refresh materials.blend from LIBRARY, preserving edits.

    A material that already exists is LEFT ALONE — the whole point is that this
    file is hand-tuned, so a rebuild must never clobber that work. Delete a
    material in Blender to have it regenerated from the starting values.
    """
    if BLEND.exists():
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)

    made, kept = [], []
    for name, v in LIBRARY.items():
        full = f"BB_MAT_{name}"
        if bpy.data.materials.get(full):
            kept.append(full)
            continue
        m = bpy.data.materials.new(full)
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        _set(b, "Base Color", (*hex_to_linear(v["base"]), 1.0))
        _set(b, "Roughness", v["rough"])
        _set(b, "Metallic", v["metal"])
        _set(b, "Coat Weight", v.get("coat", 0.0))
        if "ior" in v:
            _set(b, "IOR", v["ior"])
        if "transmission" in v:
            _set(b, "Transmission Weight", v["transmission"])
        m.use_fake_user = True          # survive a save with no object using it
        made.append(full)

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    print(f"materials.blend: {len(made)} created, {len(kept)} preserved")
    for n in made:
        print(f"   new  {n}")
    print(f"\nOpen {BLEND}")
    print("Set the viewport to Rendered (Cycles) and tune. Re-run `extract`.")


def extract():
    """Read the .blend and write materials.json for the browser."""
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    out = {}
    for m in bpy.data.materials:
        if not m.name.startswith("BB_MAT_") or not m.use_nodes:
            continue
        b = m.node_tree.nodes.get("Principled BSDF")
        if not b:
            continue

        def g(k, d=None):
            return b.inputs[k].default_value if k in b.inputs else d

        col = g("Base Color", (1, 1, 1, 1))
        rec = dict(
            color=linear_to_hex(col),
            linear=[round(float(c), 4) for c in col[:3]],
            roughness=round(float(g("Roughness", 0.5)), 4),
            metalness=round(float(g("Metallic", 0.0)), 4),
            clearcoat=round(float(g("Coat Weight", 0.0)), 4),
            ior=round(float(g("IOR", 1.5)), 4),
            transmission=round(float(g("Transmission Weight", 0.0)), 4),
        )
        # attenuation is not a Principled slider, so it rides along from LIBRARY
        key = m.name.replace("BB_MAT_", "")
        lib = LIBRARY.get(key, {})
        if "atten_dist" in lib:
            rec["attenuationDistance"] = lib["atten_dist"]
            rec["attenuationColor"] = lib["atten_color"]
        out[key] = rec

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(
        dict(source="pipeline/paper-doll-3d/materials.blend",
             note=("Authored in Blender, consumed by the browser. Values are "
                   "Principled BSDF sliders; Cycles is not three.js, so expect "
                   "one round trip."),
             materials=out), indent=2))
    print(f"wrote {OUT}  ({len(out)} materials)")
    for k, v in sorted(out.items()):
        print(f"   {k:22s} {v['color']}  rough {v['roughness']:.2f}  "
              f"metal {v['metalness']:.2f}  coat {v['clearcoat']:.2f}")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    cmd = argv[0] if argv else "build"
    if cmd == "build":
        build()
    elif cmd == "extract":
        extract()
    else:
        raise SystemExit("usage: materials.py -- [build|extract]")
