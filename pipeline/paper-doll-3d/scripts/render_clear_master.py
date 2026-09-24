"""
render_clear_master.py — one CLEAR bare-body MASTER plate for a paper-doll group.

WHY
  One master render per GROUP (shape + capacity + neck + glass), not per SKU:
  the 29 Cylinder 9 ml · CLEAR · 17-415 assemblies are one piece of glass with
  29 tops. The tops are photographic kit overlays that stack on this layer;
  Blender never re-renders the body per cap. Cap OFF, no roller/sprayer/pump.

GEOMETRY
  The shipped configurator GLB, untouched (public/models/bodies-thickness/
  <bodyId>.glb): drawing-exact 17-415 finish, hollow vessel (wall 1.6, base
  3.5), rim datum BB_ATTACH_NECK. Never a photo cutout of clear glass.

REGISTRATION (the builder's own contract, preview-registration.ts)
  A canonical body registers kit hardware by glass WIDTH and BASELINE, on the
  neck axis. So the camera is orthographic, front-on, and placed so that on the
  1000x1100 kit canvas: axis x = --axis-x, glass bottom edge y = --foot-y,
  glass diameter = --width-px. Rendered at --factor x that canvas (2.08 ->
  2080x2288, the PDP paper-doll canvas; same 10:11 frame).

LOOK
  GLASS_CLEAR as locked in public/models/materials.json: Principled, Base Color
  white, roughness 0, IOR 1.52, transmission 1, no thin film, colour from a
  Volume Absorption node (Thin Wall does not exist in Principled v2; the volume
  path is always live). Filmic, never AgX. Soft gradient dome + one large dim
  key; no small hard area lights (they float as panels inside glass).

ALPHA
  Glass has no honest alpha from one render. Two renders that differ ONLY in
  the backdrop emission — black, then the bone stage (#F5F3EF after Filmic) —
  are solved per pixel in display space so that the layer composited over bone
  reproduces the bone render exactly, dark refraction edges included.

    blender --background --python scripts/render_clear_master.py -- \
        --glb ../../public/models/bodies-thickness/Cyl-round-17-415-70x20.glb \
        --out pilot/cyl9-clear-17-415-master --label CLR

  Writes <out>/raw/{black,bone,clay}.png (16-bit display renders) and
  <out>/render-params.json. scripts/matte_master.py does the solve and QA.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np

LANE = Path(__file__).resolve().parents[1]
REPO = LANE.parents[1]

KIT_W, KIT_H = 1000, 1100
BONE = (245, 243, 239)                         # #F5F3EF, the plate stage


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--glb", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--label", default="CLR")
    p.add_argument("--factor", type=float, default=2.08, help="render px per kit px")
    p.add_argument("--axis-x", type=float, default=500.0, help="kit anchors.axisX")
    p.add_argument("--foot-y", type=float, default=1054.0, help="kit anchors.baselineY (glass bottom edge)")
    p.add_argument("--width-px", type=float, default=209.5,
                   help="glass diameter on the kit canvas; the 29 live CLEAR plates measure 208-210, median 209")
    p.add_argument("--samples", type=int, default=768)
    p.add_argument("--noise", type=float, default=0.004)
    p.add_argument("--passes", default="black,bone,clay")
    p.add_argument("--drawing-dims", default="",
                   help="DIAGNOSTIC ONLY: 'H,D' in mm (e.g. 72,19.7) stretches the barrel and scales the "
                        "glass below the finish to a drawing's overall height/diameter; finish untouched")
    return p.parse_args(argv)


def srgb_to_linear(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


# ---------------------------------------------------------------- geometry
def load_body(glb):
    bpy.ops.import_scene.gltf(filepath=str(Path(glb).resolve()))
    body = next(o for o in bpy.data.objects if o.type == "MESH")
    rim = next((o for o in bpy.data.objects if o.name.startswith("BB_ATTACH_NECK")), None)
    shoulder = next((o for o in bpy.data.objects if o.name.startswith("BB_REF_SHOULDER")), None)
    co = np.array([v.co[:] for v in body.data.vertices])
    info = {
        "mesh": body.name,
        "verts": len(co),
        "height_mm": float(co[:, 2].max() * 1e3),
        "diameter_mm": float(2 * np.hypot(co[:, 0], co[:, 1]).max() * 1e3),
        "rim_mm": float(rim.matrix_world.translation.z * 1e3) if rim else None,
        "shoulder_mm": float(shoulder.matrix_world.translation.z * 1e3) if shoulder else None,
    }
    return body, info


def apply_drawing_dims(body, info, spec):
    """Barrel-only stretch + below-finish radial scale. The finish is instanced truth: never scaled."""
    H, D = (float(x) for x in spec.split(","))
    dz = H / 1e3 - info["height_mm"] / 1e3
    s = (D / info["diameter_mm"])
    z0, z1 = 0.006, 0.050                          # straight barrel (straighten_barrel fit: 5.5..49.9 mm)
    f0, f1 = 0.0545, info["shoulder_mm"] / 1e3     # blend radial scale out across the shoulder
    for v in body.data.vertices:
        x, y, z = v.co
        w = min(max((f1 - z) / (f1 - f0), 0.0), 1.0)
        k = 1.0 + (s - 1.0) * w
        v.co.x, v.co.y = x * k, y * k
        v.co.z = z + dz * min(max((z - z0) / (z1 - z0), 0.0), 1.0)
    body.data.update()
    for o in bpy.data.objects:
        if o.type == "EMPTY":
            o.location.z += dz
    info.update(height_mm=H, diameter_mm=D, drawing_dims=spec,
                rim_mm=(info["rim_mm"] or 0) + dz * 1e3, shoulder_mm=(info["shoulder_mm"] or 0) + dz * 1e3)


# ---------------------------------------------------------------- materials
def glass_clear():
    lock = json.loads((REPO / "public/models/materials.json").read_text())["materials"]["GLASS_CLEAR"]
    m = bpy.data.materials.new("GLASS_CLEAR")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*lock["linear"], 1.0)
    b.inputs["Roughness"].default_value = lock["roughness"]
    b.inputs["Metallic"].default_value = lock["metalness"]
    b.inputs["IOR"].default_value = lock["ior"]
    b.inputs["Transmission Weight"].default_value = lock["transmission"]
    b.inputs["Coat Weight"].default_value = lock["clearcoat"]
    b.inputs["Thin Film Thickness"].default_value = 0.0
    vol = nt.nodes.new("ShaderNodeVolumeAbsorption")
    hexv = lock["_blender"]["volume_color"].lstrip("#")
    vol.inputs["Color"].default_value = (*[srgb_to_linear(int(hexv[i:i + 2], 16)) for i in (0, 2, 4)], 1.0)
    vol.inputs["Density"].default_value = lock["_blender"]["volume_density"]
    nt.links.new(vol.outputs["Volume"], nt.nodes["Material Output"].inputs["Volume"])
    return m, lock


def clay():
    m = bpy.data.materials.new("CLAY")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.62, 0.61, 0.59, 1.0)
    b.inputs["Roughness"].default_value = 0.9
    return m


def emitter(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    e = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(e.outputs["Emission"], nt.nodes["Material Output"].inputs["Surface"])
    return m, e


# ---------------------------------------------------------------- studio
def studio(scene, flag_x=0.055, flag_depth=0.24):
    """Soft dome: bright behind the bottle, dim toward camera and below, so the
    cylinder's refracting edges pick up the darker front hemisphere (the dark
    edge lines of real clear glass on a light sweep) without any hard source."""
    w = bpy.data.worlds.new("dome")
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    back = nt.nodes.new("ShaderNodeMapRange")          # dir.y: -1 camera side .. +1 behind the bottle
    back.interpolation_type = "SMOOTHSTEP"
    back.inputs["From Min"].default_value = -0.15
    back.inputs["From Max"].default_value = 0.75
    back.inputs["To Min"].default_value = 0.05
    back.inputs["To Max"].default_value = 1.0
    nt.links.new(sep.outputs["Y"], back.inputs["Value"])
    top = nt.nodes.new("ShaderNodeMapRange")           # a little lift from above, darker below the horizon
    top.interpolation_type = "SMOOTHSTEP"
    top.inputs["From Min"].default_value = -0.3
    top.inputs["From Max"].default_value = 0.9
    top.inputs["To Min"].default_value = 0.35
    top.inputs["To Max"].default_value = 1.25
    nt.links.new(sep.outputs["Z"], top.inputs["Value"])
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    nt.links.new(back.outputs["Result"], mul.inputs[0])
    nt.links.new(top.outputs["Result"], mul.inputs[1])
    nt.links.new(mul.outputs["Value"], bg.inputs["Strength"])
    bg.inputs["Color"].default_value = (1.0, 0.985, 0.96, 1.0)    # warm studio cream
    # large, dim key: a 1.2 m disc 1.1 m out, high camera-left. Soft strip, no panel.
    key = bpy.data.lights.new("key", "AREA")
    key.shape = "DISK"
    key.size = 1.2
    key.energy = 45.0
    key.color = (1.0, 0.97, 0.92)
    ko = bpy.data.objects.new("key", key)
    scene.collection.objects.link(ko)
    ko.location = (-0.55, -0.85, 0.55)
    ko.rotation_euler = (math.radians(55), 0, math.radians(-33))
    # floor under the foot (edge-on to the camera, so never directly visible): the heavy base
    # reflects and refracts a surface instead of an empty lower hemisphere
    bpy.ops.mesh.primitive_plane_add(size=3.0, location=(0, 0, 0))
    floor = bpy.context.active_object
    fm = bpy.data.materials.new("floor")
    fm.use_nodes = True
    fb = fm.node_tree.nodes["Principled BSDF"]
    fb.inputs["Base Color"].default_value = (*[srgb_to_linear(c) for c in BONE], 1.0)
    fb.inputs["Roughness"].default_value = 0.85
    floor.data.materials.append(fm)
    floor.location.y = 0.0
    floor.scale.y = 1.0
    # black side flags, edge-on to the camera and outside the frame: the glass wall seen at grazing
    # picks up the sides, and dark sides are what draw the thin dark edge lines of real clear glass
    # on a light sweep (bright-field glass lighting). Identical in every pass, so they never touch alpha.
    flag_m = bpy.data.materials.new("flag")
    flag_m.use_nodes = True
    fbs = flag_m.node_tree.nodes["Principled BSDF"]
    fbs.inputs["Base Color"].default_value = (0.004, 0.004, 0.004, 1.0)
    fbs.inputs["Roughness"].default_value = 1.0
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_plane_add(size=1.0, location=(sx * flag_x, 0.0, 0.06),
                                         rotation=(0, math.radians(90), 0))
        fl = bpy.context.active_object
        fl.scale = (0.30, flag_depth, 1.0)          # local x -> world z (height), local y -> world y (depth)
        fl.data.materials.append(flag_m)
    return floor


def backdrop():
    bpy.ops.mesh.primitive_plane_add(size=4.0, location=(0, 0.18, 0.5), rotation=(math.radians(90), 0, 0))
    bd = bpy.context.active_object
    m, e = emitter("backdrop")
    bd.data.materials.append(m)
    # the backdrop is the BACKGROUND, not a light: camera, reflection and refraction only, so the
    # black and bone passes light the glass identically and differ only in what shows through it
    bd.visible_diffuse = False
    bd.visible_volume_scatter = False
    bd.visible_shadow = False
    return bd, e


def camera(scene, a, info):
    pxmm = a.width_px / info["diameter_mm"]
    cam = bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    cam.sensor_fit = "HORIZONTAL"
    cam.ortho_scale = KIT_W / pxmm / 1e3                      # metres across the canvas
    cam.clip_start, cam.clip_end = 0.01, 10.0
    co = bpy.data.objects.new("cam", cam)
    scene.collection.objects.link(co)
    zc = (a.foot_y - KIT_H / 2) / pxmm / 1e3                   # world z at the canvas centre
    xc = (KIT_W / 2 - a.axis_x) / pxmm / 1e3                  # axis offset from the canvas centre
    co.location = (xc, -1.5, zc)
    co.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = co
    scene.render.resolution_x = round(KIT_W * a.factor)
    scene.render.resolution_y = round(KIT_H * a.factor)
    scene.render.resolution_percentage = 100
    return pxmm


def border(scene, a, info, pxmm, pad_px=34):
    """Render only the bottle (plus margin); the rest of the frame is the flat backdrop."""
    half = info["diameter_mm"] / 2 * pxmm
    top = a.foot_y - info["height_mm"] * pxmm
    l, r = a.axis_x - half - pad_px, a.axis_x + half + pad_px
    t, b = top - pad_px, a.foot_y + pad_px
    scene.render.use_border = True
    scene.render.use_crop_to_border = False
    scene.render.border_min_x, scene.render.border_max_x = l / KIT_W, r / KIT_W
    scene.render.border_min_y, scene.render.border_max_y = 1 - b / KIT_H, 1 - t / KIT_H
    return dict(left=l, right=r, top=t, bottom=b)


def cycles(scene, a):
    scene.render.engine = "CYCLES"
    c = scene.cycles
    c.device = "CPU"
    c.samples = a.samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = a.noise
    c.use_denoising = True
    c.denoiser = "OPENIMAGEDENOISE"
    c.max_bounces = 48
    c.transmission_bounces = 48
    c.glossy_bounces = 16
    c.diffuse_bounces = 4
    c.transparent_max_bounces = 16
    c.volume_bounces = 2
    c.caustics_reflective = True
    c.caustics_refractive = True
    c.blur_glossy = 0.2
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.display_settings.display_device = "sRGB"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "16"
    scene.render.dither_intensity = 0.0


def calibrate_bone(scene, e, out):
    """Find the backdrop emission whose FILMIC display value is exactly the bone stage.
    Per-channel bisection on a tiny backdrop-only render; Filmic is monotone per channel."""
    keep = (scene.render.resolution_x, scene.render.resolution_y, scene.render.use_border,
            scene.cycles.samples, scene.cycles.use_denoising)
    scene.render.resolution_x = scene.render.resolution_y = 8
    scene.render.use_border = False
    scene.cycles.samples = 4
    scene.cycles.use_denoising = False
    cam = scene.camera
    keep_loc = cam.location.copy()
    cam.location.z = 2.0                                      # above the bottle, still on the backdrop
    target = np.array(BONE) / 255.0
    lo, hi = np.zeros(3), np.full(3, 40.0)
    probe = Path(out) / "raw" / "_bone_probe.png"
    for _ in range(26):
        mid = (lo + hi) / 2
        e.inputs["Color"].default_value = (*mid, 1.0)
        e.inputs["Strength"].default_value = 1.0
        scene.render.filepath = str(probe)
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(str(probe))           # 16-bit PNG: PIL would truncate to 8 bits
        img.colorspace_settings.name = "Non-Color"       # and Blender would linearise a 16-bit PNG
        got = np.array(img.pixels[:]).reshape(img.size[1], img.size[0], 4)[4, 4, :3].copy()
        bpy.data.images.remove(img)
        lo = np.where(got < target, mid, lo)
        hi = np.where(got >= target, mid, hi)
    cam.location = keep_loc
    (scene.render.resolution_x, scene.render.resolution_y, scene.render.use_border,
     scene.cycles.samples, scene.cycles.use_denoising) = keep
    probe.unlink(missing_ok=True)
    em = (lo + hi) / 2
    e.inputs["Color"].default_value = (*em, 1.0)
    return [float(x) for x in em], [float(x) * 255 for x in got]


def main():
    a = parse_args()
    out = (LANE / a.out) if not Path(a.out).is_absolute() else Path(a.out)
    (out / "raw").mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    body, info = load_body(a.glb)
    if a.drawing_dims:
        apply_drawing_dims(body, info, a.drawing_dims)
    glass, lock = glass_clear()
    body.data.materials.clear()
    body.data.materials.append(glass)
    cycles(scene, a)
    studio(scene)
    bd, e = backdrop()
    pxmm = camera(scene, a, info)
    emission, probe = calibrate_bone(scene, e, out)
    region = border(scene, a, info, pxmm)
    print(f"[reg] {pxmm:.4f} kit px/mm  rim datum -> y {a.foot_y - (info['rim_mm'] or info['height_mm']) * pxmm:.1f}"
          f"  backdrop emission {emission} -> {probe}")

    passes = [p for p in a.passes.split(",") if p]
    for name in passes:
        if name == "black":
            e.inputs["Color"].default_value = (0, 0, 0, 1)
            body.data.materials[0] = glass
        elif name == "bone":
            e.inputs["Color"].default_value = (*emission, 1)
            body.data.materials[0] = glass
        elif name == "clay":
            e.inputs["Color"].default_value = (*emission, 1)
            body.data.materials[0] = clay()
        scene.render.filepath = str(out / "raw" / f"{name}.png")
        bpy.ops.render.render(write_still=True)
        print(f"[out] raw/{name}.png")

    params = dict(
        blender=bpy.app.version_string, engine="CYCLES", device="CPU",
        glb=str(Path(a.glb).resolve().relative_to(REPO)) if str(Path(a.glb).resolve()).startswith(str(REPO)) else a.glb,
        body=info, label=a.label, material="GLASS_CLEAR", material_lock=lock,
        view_transform="Filmic", look="None", samples=a.samples, adaptive_threshold=a.noise, denoiser="OIDN",
        canvas=dict(kit=[KIT_W, KIT_H], render=[scene.render.resolution_x, scene.render.resolution_y], factor=a.factor),
        registration=dict(axis_x=a.axis_x, foot_y=a.foot_y, width_px=a.width_px, kit_px_per_mm=pxmm,
                          rim_y=a.foot_y - (info["rim_mm"] or info["height_mm"]) * pxmm),
        border_kit_px=region, bone=BONE, backdrop_emission_linear=emission, passes=passes,
    )
    (out / "render-params.json").write_text(json.dumps(params, indent=1))
    print(json.dumps(params["registration"]))


main()
