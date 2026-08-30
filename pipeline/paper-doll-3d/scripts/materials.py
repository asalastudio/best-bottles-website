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


def _studio(scene):
    """Bone cyc + the same key/fill/rim set the browser uses.

    Tuning a material against a grey void tells you nothing — a metallized cap
    is entirely a picture of its surroundings. This mirrors the R3F studio so
    what you judge in Cycles is at least lit like what ships.
    """
    import math
    # cyc: a big curved sweep, bone #B29878
    bpy.ops.mesh.primitive_plane_add(size=4.0, location=(0, 0.6, 0))
    cyc = bpy.context.active_object
    cyc.name = "BB_STUDIO_CYC"
    cyc.rotation_euler = (math.radians(90), 0, 0)
    m = bpy.data.materials.new("BB_MAT_STUDIO_BONE")
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    _set(bsdf, "Base Color", (*hex_to_linear("#B29878"), 1.0))
    _set(bsdf, "Roughness", 0.95)
    cyc.data.materials.append(m)

    bpy.ops.mesh.primitive_plane_add(size=4.0, location=(0, -1.4, 0))
    floor = bpy.context.active_object
    floor.name = "BB_STUDIO_FLOOR"
    floor.data.materials.append(m)

    for name, loc, rot, size, energy in (
        ("KEY",   (0.0, -0.9, 1.6), (math.radians(-35), 0, 0), 2.4, 420),
        ("FILL_L", (-1.5, -0.7, 0.5), (0, math.radians(-65), 0), 1.8, 120),
        ("FILL_R", (1.5, -0.7, 0.4), (0, math.radians(65), 0), 1.6, 90),
        ("RIM_L", (-1.0, 1.1, 0.7), (0, math.radians(-115), 0), 0.35, 500),
        ("RIM_R", (1.0, 1.1, 0.7), (0, math.radians(115), 0), 0.35, 420),
    ):
        L = bpy.data.lights.new(f"BB_{name}", "AREA")
        L.energy, L.size, L.shape = energy, size, "SQUARE"
        ob = bpy.data.objects.new(f"BB_{name}", L)
        ob.location, ob.rotation_euler = loc, rot
        scene.collection.objects.link(ob)

    cam_d = bpy.data.cameras.new("BB_CAM")
    cam_d.lens = 42
    cam = bpy.data.objects.new("BB_CAM", cam_d)
    # framed on the two rows, which sit around z 0.00 and z -0.10
    cam.location = (0.0, -0.52, 0.055)
    cam.rotation_euler = (math.radians(84), 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 128


def _import_geo(path, name):
    """Bring in one shipped GLB and return its mesh object."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    mesh = next((o for o in new if o.type == "MESH"), None)
    for o in new:
        if o is not mesh:
            bpy.data.objects.remove(o, do_unlink=True)
    if mesh:
        mesh.name = name
    return mesh


def build():
    """Create materials.blend: a real STUDIO you can open and judge.

    The first version of this shipped 19 materials and nothing else — an empty
    scene, because a Blender material is invisible until it is on an object.
    It laid out no geometry, no lights and no camera, which made it useless as
    an authoring surface.

    So this lays out the actual shipped geometry: a row of bottles carrying the
    glass materials, and a row of bottle-plus-cap pairs carrying the closure
    colourways, on the bone cyc under the browser's lighting. Open it, switch
    the viewport to Rendered, and tune what you can see.

    Existing materials are PRESERVED on rebuild — the file is hand-tuned and a
    rebuild must never clobber that. Delete one in Blender to regenerate it.
    """
    reuse = {}
    if BLEND.exists():
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        for m in bpy.data.materials:
            if m.name.startswith("BB_MAT_"):
                reuse[m.name] = m
        # rebuild the set from scratch each time; only MATERIALS are precious
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o, do_unlink=True)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)

    scene = bpy.context.scene
    made, kept = [], []
    for name, v in LIBRARY.items():
        full = f"BB_MAT_{name}"
        if full in reuse:
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

        # Glass COLOUR is attenuation over distance, and that is a VOLUME
        # property — there is no Principled slider for it. Without this the
        # amber, cobalt and green materials render clear in Cycles, which is
        # exactly what the first studio render showed.
        #
        # It also exports: Blender maps Volume Absorption to
        # KHR_materials_volume (attenuationColor / attenuationDistance), the
        # same pair three.js reads. So the browser and Cycles agree.
        if "atten_dist" in v:
            nt = m.node_tree
            vol = nt.nodes.new("ShaderNodeVolumeAbsorption")
            vol.location = (b.location.x, b.location.y - 320)
            vol.inputs["Color"].default_value = (*hex_to_linear(v["atten_color"]), 1.0)
            # Density is per Blender unit and the scene is METRES, so a 20 mm
            # bottle is only 0.02 of path. 1/atten_dist gives an optical depth
            # of ~0.6 and the glass renders almost clear — which the first
            # studio render showed. Scale so the tint reads at product size.
            vol.inputs["Density"].default_value = 3.0 / max(1e-6, v["atten_dist"])
            out = nt.nodes.get("Material Output")
            if out:
                nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])

        m.use_fake_user = True
        reuse[full] = m
        made.append(full)

    _studio(scene)

    lane = LANE.parents[1] / "public" / "models"
    body_src = lane / "bodies-threaded" / "Cyl-round-17-415-70x20.glb"
    cap_src = lane / "closures" / "BB_CAP_17415.glb"

    proto_body = _import_geo(body_src, "PROTO_BODY") if body_src.exists() else None
    proto_cap = _import_geo(cap_src, "PROTO_CAP") if cap_src.exists() else None

    def place(proto, x, y, mat, label):
        if proto is None:
            return None
        ob = proto.copy()
        ob.data = proto.data.copy()
        ob.data.materials.clear()
        ob.data.materials.append(mat)
        ob.location = (x, y, 0.0)
        ob.name = label
        scene.collection.objects.link(ob)
        return ob

    GAP = 0.035
    glass_keys = [k for k in LIBRARY if k.startswith("GLASS_")]
    cap_keys = [k for k in LIBRARY if k.startswith("CAP_")]

    # row 1 — glass, bare bottles
    x0 = -GAP * (len(glass_keys) - 1) / 2
    for i, k in enumerate(glass_keys):
        place(proto_body, x0 + i * GAP, 0.0, reuse[f"BB_MAT_{k}"], f"GLASS__{k}")

    # row 2 — cap colourways, on a clear bottle so the pairing reads
    x0 = -GAP * (len(cap_keys) - 1) / 2
    for i, k in enumerate(cap_keys):
        x = x0 + i * GAP
        place(proto_body, x, 0.075, reuse["BB_MAT_GLASS_CLEAR"], f"BODY__{k}")
        c = place(proto_cap, x, -0.10, reuse[f"BB_MAT_{k}"], f"CAP__{k}")
        if c:
            c.location = (x, 0.075, 0.070)     # seat on the 70 mm rim

    for p in (proto_body, proto_cap):
        if p:
            bpy.data.objects.remove(p, do_unlink=True)

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    print(f"materials.blend: {len(made)} created, {len(kept)} preserved")
    print(f"  objects laid out: {len(scene.objects)}")
    print(f"\nOpen {BLEND}")
    print("Viewport -> Rendered (Cycles). Row 1 is glass, row 2 is cap finishes.")
    print("Tune, then: blender --background --python scripts/materials.py -- extract")


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
