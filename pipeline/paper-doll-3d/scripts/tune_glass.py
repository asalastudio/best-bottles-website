# Paste this into Blender's Scripting tab (with materials.blend open) and press
# Run. It only touches MATERIALS — no geometry is created, moved or altered.
#
# Edit the TUNE block, run, look, repeat. When you like it, save the .blend and
# run, from the repo root:
#     blender --background --python pipeline/paper-doll-3d/scripts/materials.py -- extract
# which writes the values to public/models/materials.json for the browser.
#
# ---------------------------------------------------------------------------
# WHY THE GLASS LOOKS WEAK RIGHT NOW, AND WHAT ACTUALLY FIXES IT
# ---------------------------------------------------------------------------
# 1. THIN WALL must be OFF.
#    Blender 5's Principled has a "Thin Wall" switch. When it is on, the shader
#    treats the surface as an infinitely thin membrane — light does NOT travel
#    through a volume, so Volume Absorption is ignored and coloured glass comes
#    out clear. Our bottles are solid bodies, so this must be off.
#
# 2. COLOUR COMES FROM THE VOLUME, NOT FROM BASE COLOR.
#    Real amber glass is clear glass that absorbs blue and green over distance —
#    which is why a thin wall looks pale and a thick base looks deep. Tinting
#    Base Color instead gives a flat, plasticky wash with no depth. So Base
#    Color stays WHITE and the colour lives in Volume Absorption.
#
# 3. DENSITY IS PER METRE, AND THESE BOTTLES ARE TINY.
#    Transmission through a slab is exp(-density x path). A O20 mm bottle is
#    only 0.02 m of path, so:
#        density  40 -> 45% light through  (pale)
#        density 100 -> 14%                (rich)
#        density 160 ->  4%                (deep, near-opaque at the edges)
#    A density that looks right on a 1 m cube is invisible here. That is why
#    the amber read as salmon.
#
# 4. ROUGHNESS 0, NOT 0.03.
#    Polished container glass is optically smooth. Even 0.03 frosts the
#    reflections just enough to read as acrylic.

import bpy

# ---------------------------------------------------------------------------
# TUNE — the only part you need to edit
# ---------------------------------------------------------------------------
IOR_SODA_LIME = 1.52          # real soda-lime glass; do not drift from this

TUNE = {
    # material name        density  absorption colour  roughness
    "BB_MAT_GLASS_CLEAR":   (  6.0, (0.92, 0.97, 0.95), 0.00),
    "BB_MAT_GLASS_FROSTED": ( 10.0, (0.95, 0.96, 0.96), 0.42),
    "BB_MAT_GLASS_AMBER":   (150.0, (0.55, 0.19, 0.03), 0.00),
    "BB_MAT_GLASS_COBALT":  (150.0, (0.04, 0.13, 0.62), 0.00),
    "BB_MAT_GLASS_GREEN":   (130.0, (0.06, 0.34, 0.14), 0.00),
}

# Frosting is a SURFACE, not a volume: keep transmission high and raise
# roughness. Dropping transmission to fake it turns glass into grey plastic.
FROSTED = {"BB_MAT_GLASS_FROSTED"}


def tune_glass():
    touched = []
    for name, (density, abs_rgb, rough) in TUNE.items():
        m = bpy.data.materials.get(name)
        if not m or not m.use_nodes:
            print(f"  MISSING {name}")
            continue
        nt = m.node_tree
        bsdf = nt.nodes.get("Principled BSDF")
        out = nt.nodes.get("Material Output")
        if not bsdf or not out:
            continue

        def s(k, v):
            if k in bsdf.inputs:
                bsdf.inputs[k].default_value = v

        s("Base Color", (1.0, 1.0, 1.0, 1.0))   # colour lives in the volume
        s("Metallic", 0.0)
        s("Roughness", rough)
        s("IOR", IOR_SODA_LIME)
        s("Transmission Weight", 1.0)
        s("Alpha", 1.0)
        s("Thin Wall", False)                   # <- the big one
        s("Coat Weight", 0.0)
        s("Specular IOR Level", 0.5)

        # one Volume Absorption node, reused if it is already there
        vol = next((n for n in nt.nodes if n.type == "VOLUME_ABSORPTION"), None)
        if vol is None:
            vol = nt.nodes.new("ShaderNodeVolumeAbsorption")
            vol.location = (bsdf.location.x, bsdf.location.y - 340)
        vol.inputs["Color"].default_value = (*abs_rgb, 1.0)
        vol.inputs["Density"].default_value = density
        if not out.inputs["Volume"].is_linked:
            nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])

        touched.append((name, density, rough))

    print("\n=== glass tuned (materials only, geometry untouched) ===")
    for n, d, r in touched:
        # transmission through a 20 mm bottle, as a sanity readout
        import math
        t = math.exp(-d * 0.020) * 100
        print(f"  {n:26s} density {d:6.1f}  rough {r:.2f}  "
              f"-> {t:5.1f}% through 20 mm")
    print("\nLook, adjust TUNE, run again. Then save and `materials.py -- extract`.")


def tune_caps():
    """Lacquered phenolic reads right with a COAT, not with raw gloss.

    A pigmented cap is a coloured body under clear lacquer: the highlight sits
    ON TOP of the colour rather than replacing it. Metallized caps get a
    thinner coat over a real metal layer.
    """
    for name in [m.name for m in bpy.data.materials if m.name.startswith("BB_MAT_CAP_")]:
        m = bpy.data.materials[name]
        b = m.node_tree.nodes.get("Principled BSDF")
        if not b:
            continue
        plated = b.inputs["Metallic"].default_value > 0.5

        def s(k, v):
            if k in b.inputs:
                b.inputs[k].default_value = v

        s("Coat Weight", 0.35 if plated else 0.9)
        s("Coat Roughness", 0.03)
        s("Coat IOR", 1.5)
        s("Thin Wall", False)
        if not plated:
            s("Specular IOR Level", 0.55)
    print("caps: coat applied (0.9 pigmented / 0.35 plated)")


tune_glass()
tune_caps()
