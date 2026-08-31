#!/usr/bin/env python3
"""Build the Best Bottles packshot rig — founder diagram, 2026-08-29.

Deterministic by construction: every element is placed from the constants
below, so the rig is identical every run. That is the point — 118 bodies and
~30 components only composite together if they share one camera and one light.

  blender -b -P scripts/paper-doll-3d/build-packshot-rig.py -- \
      --output pipeline/paper-doll/studio-packshot-template.blend

Then open that .blend and the Higgsfield bar floats over the viewport for
interactive checking. Adjust constants here and re-run; never nudge by hand,
or the rig stops being reproducible.

Layout (camera looks along +Y):
    bottle at world origin, base on z=0
    camera at -Y, orthographic, level, framing 0..FRAME_H
    bone sweep behind at +Y with a curved floor-to-wall fillet
    softbox/scrim pair each side at +/-X
    black edge cards close in at +/-X  <- these make the glass read
    white bounce in front, below the lens
"""
import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector

# ── rig constants — the whole spec lives here ────────────────────────────────
FRAME_H        = 0.224    # m. 224mm frames the tallest body (195mm) + headroom
FLOOR_MARGIN   = 0.018    # m of sweep visible BELOW the foot. Without it the
                          # bottle sits flush on the frame edge with no ground.
BACKDROP_GAP   = 1.05     # m. 41in, inside the 36-48in the diagram calls for
SWEEP_W        = 2.40     # m
SWEEP_RISE     = 1.60     # m of vertical wall above the fillet
SWEEP_FILLET   = 0.45     # m radius of the floor-to-wall curve

SOFTBOX_SIZE   = 0.35     # m
SOFTBOX_X      = 0.40     # m outboard
SOFTBOX_POWER  = 11.5     # W at tabletop distance. 6.5W read 134/255
                          # backdrop; bone wants ~222. Bracketed: 30W clipped 70% of frame;
                          # 15W gave 198/255 backdrop, 19W lands near bone 222.

SCRIM_SIZE     = 0.34     # m — the scrim is what the subject actually "sees".
                          # Tabletop scale: the first pass used 1.1m panels around
                          # a 70mm bottle, which lit like a room set, not a packshot.
SCRIM_X        = 0.26     # m

EDGE_CARD_X    = 0.065    # m from centre. THE critical constant: sets how
                          # thick and dark the sidewall refraction line reads.
                          # In 3D the cards are hidden from the CAMERA but still
                          # seen by reflection/refraction, so they sit as close as
                          # the look wants regardless of how wide the frame is.
                          # A physical shoot cannot do this - the cards have to
                          # clear the frame edge.
EDGE_CARD_W    = 0.11     # m
EDGE_CARD_H    = 0.17     # m

BOUNCE_W       = 0.26
BOUNCE_D       = 0.15
BOUNCE_Y       = -0.11
BOUNCE_Z       = -0.02

CAM_Y          = -0.60    # ortho: distance is framing-neutral, kept sane
RES_X, RES_Y   = 2080, 2288          # studio-spec canvas
BONE           = (0.933, 0.859, 0.769, 1.0)   # #eedbc4 linear-ish


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, rgba, roughness=0.9, emission=None, emission_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    if emission is not None:
        for key in ("Emission Color", "Emission"):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = emission
                break
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return m


def build_sweep(coll, visible_camera=True):
    """Cyclorama: floor -> quarter-round fillet -> vertical wall, extruded in X."""
    r, y0 = SWEEP_FILLET, BACKDROP_GAP
    pts = [(0.0, -0.9)]                       # floor toward camera
    pts.append((0.0, y0 - r))                 # fillet start
    for i in range(1, 13):                    # 90 deg arc, 12 segments
        a = (math.pi / 2) * (i / 12)
        pts.append((r * (1 - math.cos(a)), y0 - r + r * math.sin(a)))
    pts.append((r + SWEEP_RISE, y0))          # wall top

    verts, faces = [], []
    for i, (z, y) in enumerate(pts):
        verts.append((-SWEEP_W / 2, y, z))
        verts.append((SWEEP_W / 2, y, z))
        if i:
            a = 2 * (i - 1)
            faces.append((a, a + 1, a + 3, a + 2))
    me = bpy.data.meshes.new("BB_SWEEP")
    me.from_pydata(verts, [], faces)
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new("BB_SWEEP", me)
    ob.data.materials.append(mat("BB_SweepBone", BONE, roughness=0.95))
    ob.visible_camera = visible_camera
    coll.objects.link(ob)
    return ob


def add_plane(coll, name, w, h, loc, rot, material, visible_camera=True):
    """Build the quad directly.

    bpy.ops.mesh.primitive_plane_add + transform_apply silently left every
    plane at the origin when run headless - the bounce card ended up sitting
    through the bottle, which is what put the black band across the frame.
    Constructing mesh data with explicit coordinates has no context dependency.
    """
    hw, hh = w / 2.0, h / 2.0
    corners = [Vector((-hw, -hh, 0)), Vector((hw, -hh, 0)),
               Vector((hw, hh, 0)), Vector((-hw, hh, 0))]
    eul = Euler(rot, "XYZ")
    verts = [tuple(Vector(loc) + (c.copy() @ eul.to_matrix().transposed())) for c in corners]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], [(0, 1, 2, 3)])
    me.update()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(material)
    ob.visible_camera = visible_camera
    coll.objects.link(ob)
    return ob


def add_area(coll, name, size, loc, rot, power):
    d = bpy.data.lights.new(name, type="AREA")
    d.shape = "RECTANGLE"
    d.size, d.size_y = size, size * 1.35      # tall rectangle, like a strip box
    d.energy = power
    ob = bpy.data.objects.new(name, d)
    ob.location, ob.rotation_euler = loc, rot
    coll.objects.link(ob)
    return ob


def build(output: Path, transparent: bool):
    clear_scene()
    scene = bpy.context.scene
    coll = bpy.data.collections.new("BB_RIG")
    scene.collection.children.link(coll)

    # A level ORTHO camera sees the floor edge-on - there is no ground to
    # photograph, only a hard line and void beneath. So in transparent mode the
    # sweep lights the glass and is refracted by it, but is not photographed;
    # canvas, gradient, ground plane and shadow all come from the compositor.
    build_sweep(coll, visible_camera=not transparent)

    black = mat("BB_EdgeCardBlack", (0.012, 0.012, 0.012, 1), roughness=0.55)
    white = mat("BB_Bounce", (0.92, 0.92, 0.92, 1), roughness=1.0)

    # Softbox + scrim per side. The subject effectively sees the SCRIM, so the
    # emitter is placed at the scrim plane and sized to it; a separate
    # translucent panel in front of a smaller light would only cost samples
    # for the same result.
    for sgn, side in ((-1, "L"), (1, "R")):
        add_area(coll, f"BB_SOFTBOX_{side}", SCRIM_SIZE,
                 (sgn * SCRIM_X, -0.10, FRAME_H * 1.15),
                 (math.radians(90), 0, math.radians(90) * sgn), SOFTBOX_POWER)
        # non-rendering marker so the physical scrim position stays legible
        m = add_plane(coll, f"BB_SCRIM_{side}_marker", SCRIM_SIZE, SCRIM_SIZE * 1.35,
                      (sgn * SCRIM_X, -0.10, FRAME_H * 1.15),
                      (math.radians(90), 0, math.radians(90) * sgn), white)
        m.hide_render = True
        m.display_type = "WIRE"

        # BLACK EDGE CARDS — the load-bearing element for clear glass
        add_plane(coll, f"BB_EDGECARD_{side}", EDGE_CARD_W, EDGE_CARD_H,
                  (sgn * EDGE_CARD_X, 0.0, EDGE_CARD_H / 2),
                  (math.radians(90), 0, math.radians(90) * sgn), black,
                  visible_camera=False)

    add_plane(coll, "BB_BOUNCE", BOUNCE_W, BOUNCE_D,
              (0, BOUNCE_Y, BOUNCE_Z), (math.radians(-18), 0, 0), white,
              visible_camera=False)

    # ── camera: orthographic, dead level, framing 0..FRAME_H ────────────────
    cd = bpy.data.cameras.new("BB_CAM")
    cd.type = "ORTHO"
    cd.ortho_scale = FRAME_H
    cam = bpy.data.objects.new("BB_CAM", cd)
    cam.location = (0.0, CAM_Y, FRAME_H / 2 - FLOOR_MARGIN)
    cam.rotation_euler = (math.radians(90), 0.0, 0.0)   # level. never tilt.
    coll.objects.link(cam)
    scene.camera = cam

    scene.render.engine = "CYCLES"
    scene.cycles.samples = 256
    scene.render.resolution_x, scene.render.resolution_y = RES_X, RES_Y
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    try:
        scene.view_settings.view_transform = "Standard"
    except Exception:
        pass

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    print(f"\nrig written: {output}")
    print(f"  ortho frame     {FRAME_H*1000:.0f} mm  (tallest body 195 mm)")
    print(f"  canvas          {RES_X} x {RES_Y}   transparent={transparent}")
    print(f"  edge cards      +/-{EDGE_CARD_X*1000:.0f} mm from centre")
    print(f"  backdrop gap    {BACKDROP_GAP*39.37:.0f} in")
    print(f"  camera          ORTHO, level, lens centre z={(FRAME_H/2-FLOOR_MARGIN)*1000:.0f} mm")
    print(f"  floor margin    {FLOOR_MARGIN*1000:.0f} mm below the foot")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", type=Path,
                    default=Path("pipeline/paper-doll/studio-packshot-template.blend"))
    ap.add_argument("--opaque", action="store_true",
                    help="keep the sweep in the render instead of alpha")
    a = ap.parse_args(argv)
    build(a.output.resolve(), transparent=not a.opaque)
