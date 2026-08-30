"""
glass_bench.py — tune glass in Blender against the REAL photograph.

The bench puts the actual product photo INTO the scene, standing at true scale
beside the model. A 70 mm bottle sits next to a 70 mm tall photograph of that
same bottle, lit by the same world, framed by the same camera. Open the .blend,
switch to Rendered, edit TUNE in tune_glass.py, press Run, and judge the two
side by side without leaving Blender.

Why in-scene rather than a reference image on the camera: a background image
does not survive a render, cannot be judged in Rendered view at an angle, and
gives you nothing to measure. A plane does all three.

    # build the bench and save a .blend to open
    blender --background --python scripts/glass_bench.py -- \
        --body Cyl-round-17-415-70x20 --glass amber --save-blend

    # then, in Blender: open pipeline/paper-doll-3d/glass-bench.blend,
    # Rendered view, tweak scripts/tune_glass.py, Run, look.

    # when it looks right, get NUMBERS instead of an opinion
    python3 scripts/glass_compare.py --body Cyl-round-17-415-70x20 --glass amber

The photo is shadeless (Emission), so it shows exactly as captured and is not
re-lit by the studio. That is the point: it is evidence, not set dressing.
"""

import argparse
import csv
import sys
from pathlib import Path

import bpy

LANE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LANE / "scripts"))
from materials import LIBRARY, hex_to_linear  # noqa: E402

MM = 0.001


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--body", default="Cyl-round-17-415-70x20")
    p.add_argument("--glass", default="clear",
                   choices=["clear", "amber", "cobalt", "frosted", "green"])
    p.add_argument("--photo", default=None, help="SKU override for the reference")
    p.add_argument("--gap-mm", type=float, default=18.0)
    p.add_argument("--res", type=int, default=1400)
    p.add_argument("--samples", type=int, default=96)
    p.add_argument("--save-blend", action="store_true")
    p.add_argument("--render", action="store_true", help="also render a still")
    p.add_argument("--out", default=str(LANE / "renders" / "glass-bench"))
    return p.parse_args(argv)


def body_row(body_id):
    with open(LANE / "bodies.csv", newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["body_id"] == body_id:
                return r
    raise SystemExit(f"body_id not in bodies.csv: {body_id}")


def glass_material(name, key):
    """Principled + Volume Absorption.

    Colour lives in the VOLUME, never in Base Color — that is what makes a thin
    wall pale and a thick base deep. Thin Wall must stay off or the volume is
    ignored entirely. Both rules are documented at length in tune_glass.py.
    """
    spec = LIBRARY[key]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*hex_to_linear(spec["base"]), 1)
    bsdf.inputs["Roughness"].default_value = spec["rough"]
    bsdf.inputs["Metallic"].default_value = spec["metal"]
    if "IOR" in bsdf.inputs:
        bsdf.inputs["IOR"].default_value = spec.get("ior", 1.52)
    for n in ("Transmission Weight", "Transmission"):
        if n in bsdf.inputs:
            bsdf.inputs[n].default_value = spec.get("transmission", 1.0)
            break
    if "Thin Film Thickness" in bsdf.inputs:
        bsdf.inputs["Thin Film Thickness"].default_value = 0.0
    for n in ("Thin Wall", "Thin Surface"):
        if n in bsdf.inputs:
            bsdf.inputs[n].default_value = False

    # attenuation distance -> density; absorption colour is what SURVIVES,
    # so it is bright. A dark absorption colour double-darkens into plastic.
    dist = spec.get("atten_dist")
    if dist:
        vol = nt.nodes.new("ShaderNodeVolumeAbsorption")
        vol.location = (-260, -320)
        vol.inputs["Color"].default_value = (*hex_to_linear(spec["atten_color"]), 1)
        vol.inputs["Density"].default_value = 1.0 / dist
        out = nt.nodes["Material Output"]
        nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])
    return mat


def photo_plane(png, height_m, x_center):
    """The reference photograph, standing at TRUE SCALE, shadeless."""
    img = bpy.data.images.load(str(png))
    w_px, h_px = img.size
    width_m = height_m * (w_px / h_px)

    bpy.ops.mesh.primitive_plane_add(size=1)
    plane = bpy.context.active_object
    plane.name = "BENCH_REFERENCE_PHOTO"
    plane.rotation_euler = (1.5707963, 0, 0)          # stand it up, facing -Y
    plane.scale = (width_m, 1.0, height_m)
    plane.location = (x_center, 0.0, height_m / 2.0)

    mat = bpy.data.materials.new("BENCH_PHOTO")
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    out = nt.nodes["Material Output"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Cubic"
    tex.location = (-560, 0)
    # Shadeless: the photo must read exactly as captured, not re-lit by the
    # studio. Emission at strength 1 through the transparent alpha.
    emit = nt.nodes.new("ShaderNodeEmission"); emit.location = (-240, 60)
    trans = nt.nodes.new("ShaderNodeBsdfTransparent"); trans.location = (-240, -120)
    mix = nt.nodes.new("ShaderNodeMixShader"); mix.location = (-40, 0)
    nt.links.new(tex.outputs["Color"], emit.inputs["Color"])
    nt.links.new(tex.outputs["Alpha"], mix.inputs["Fac"])
    nt.links.new(trans.outputs["BSDF"], mix.inputs[1])
    nt.links.new(emit.outputs["Emission"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    mat.blend_method = "BLEND" if hasattr(mat, "blend_method") else mat.blend_method
    plane.data.materials.append(mat)
    return plane, width_m


def main():
    a = parse_args()
    row = body_row(a.body)
    sku = a.photo or row["representative_sku"]
    png = LANE / "silhouettes" / f"{sku}.png"
    if not png.exists():
        raise SystemExit(f"no reference photo at {png} — run extract_psd_silhouette.py")
    glb = LANE / "glb" / f"{a.body}.glb"
    if not glb.exists():
        glb = LANE / "releases" / "2026-08-30-bodies-v1" / "glb" / f"{a.body}.glb"
    if not glb.exists():
        raise SystemExit(f"no GLB for {a.body} — run bottle_bodies.py")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = a.samples
    # Filmic, never AgX: AgX desaturates hard (amber -> salmon, cobalt -> grey)
    # and guarantees Blender and three.js can never agree.
    try:
        scene.view_settings.view_transform = "Filmic"
    except TypeError:
        scene.view_settings.view_transform = "Standard"

    bpy.ops.import_scene.gltf(filepath=str(glb))
    body = next((o for o in bpy.data.objects
                 if o.type == "MESH" and o.name.startswith("BB_BTL_")), None)
    if body is None:
        raise SystemExit("no BB_BTL_* mesh in the GLB")

    # Y-UP INVERTS INSIDE BLENDER: the files are Y-up on disk, but the glTF
    # importer restores Blender's Z-up. Height is .z here, .y in the browser.
    h_m = body.dimensions.z
    w_m = max(body.dimensions.x, body.dimensions.y)

    body.data.materials.clear()
    body.data.materials.append(glass_material(f"GLASS_{a.glass.upper()}_BENCH",
                                              f"GLASS_{a.glass.upper()}"))

    gap = a.gap_mm * MM
    plane, pw = photo_plane(png, h_m, -(w_m / 2 + gap + 0.0))
    plane.location.x = -(w_m / 2 + gap + pw / 2)

    # world + lights from the shared studio, so photo and model share one setup
    try:
        from materials import _studio
        _studio(scene)
    except Exception as e:                       # noqa: BLE001
        print(f"note: shared _studio() unavailable ({e}); using a grey dome")
        world = bpy.data.worlds.new("BENCH")
        world.use_nodes = True
        world.node_tree.nodes["Background"].inputs[0].default_value = (.6, .6, .62, 1)
        scene.world = world

    span = pw + gap + w_m
    cam_data = bpy.data.cameras.new("BENCH_CAM")
    cam_data.type = "ORTHO"                       # ortho = a fair comparison:
    cam_data.ortho_scale = span * 1.28            # no perspective to argue about
    cam = bpy.data.objects.new("BENCH_CAM", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (plane.location.x / 2 + w_m / 4, -0.55, h_m / 2)
    cam.rotation_euler = (1.5707963, 0, 0)
    scene.camera = cam

    scene.render.resolution_x = a.res
    scene.render.resolution_y = int(a.res * (h_m * 1.28) / (span * 1.28))
    scene.render.film_transparent = False

    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    if a.save_blend:
        blend = LANE / "glass-bench.blend"
        # open in Rendered view, through the camera - finding the shading
        # buttons is a real stumbling block
        for area in getattr(bpy.context.screen, "areas", []) or []:
            if area.type == "VIEW_3D":
                area.spaces[0].shading.type = "RENDERED"
                area.spaces[0].region_3d.view_perspective = "CAMERA"
        bpy.ops.wm.save_as_mainfile(filepath=str(blend))
        print(f"bench -> {blend}")
    if a.render:
        scene.render.filepath = str(out / f"{a.body}--{a.glass}.png")
        bpy.ops.render.render(write_still=True)
        print(f"render -> {scene.render.filepath}")

    print(f"body {a.body}  {h_m*1000:.1f} x {w_m*1000:.1f} mm")
    print(f"photo {sku}.png at true scale, {pw*1000:.1f} mm wide")
    print(f"glass GLASS_{a.glass.upper()}")


if __name__ == "__main__":
    main()
