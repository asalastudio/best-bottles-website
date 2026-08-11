#!/usr/bin/env python3
"""BEST BOTTLES — view-preset renderer for built master scenes.

Loads a .blend produced by build-master-scene.py and renders one of the
standard views. Consolidates the session-proven ad-hoc cameras (macro,
section, three-quarter, spin) into named presets, with the Metal GPU enable
built in (--factory-startup resets compute prefs; without this every render
silently falls back to CPU at ~4x the wall time).

    blender -b --factory-startup scene.blend -P render-views.py -- \
        --view front --out render.png [--samples 160] [--spin-phi 225] [--clay]

Views:
    front         master camera as saved (product elevation)
    macro         tight neck close-up (framing from the finish specs)
    threequarter  38-degree hero angle (flat-face bottles show their face)
    section       drawing convention: near half cut away, engineering clay,
                  camera sees the FAR wall's threads (use --spin-phi to pose
                  the helix; run-out azimuth per the thread design law)
    spin          8 x 45-degree bottle rotations (pose sweeps / turntables)

--clay overrides bottle + closure materials with neutral opaque clay in ANY
view — the THREAD-STANDARD.md gate: thread form is judged matte, never
through glass. (section is always clay; there it also cuts the cap so the
thread engagement shows.)

--clay-body-only applies the same diagnostic clay below the locked finish
datum while preserving the approved clear-glass neck, band, and threads.
"""
import argparse
import math
import sys

import bpy


def enable_gpu():
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True


def bottle_object():
    return next(o for o in bpy.data.objects if o.name.startswith("BB_BTL"))


def product_meshes():
    return [o for o in bpy.data.objects if o.type == "MESH"
            and o.name.startswith(("BB_BTL", "BB_ROLL", "BB_CAP", "BB_FIN"))
            and not o.hide_render]        # skip the parked library master


def clay_material():
    """Return the shared neutral diagnostic clay material."""
    clay = bpy.data.materials.get("BB_MAT_CLAY")
    if clay is not None:
        return clay
    clay = bpy.data.materials.new("BB_MAT_CLAY")
    clay.use_nodes = True
    pr = clay.node_tree.nodes["Principled BSDF"]
    pr.inputs["Base Color"].default_value = (0.82, 0.81, 0.79, 1.0)
    pr.inputs["Roughness"].default_value = 0.65
    return clay


def apply_clay(objs):
    """Neutral opaque clay on every product mesh — the clay-gate material."""
    clay = clay_material()
    for o in objs:
        o.data.materials.clear()
        o.data.materials.append(clay)
    return clay


def apply_body_only_clay(bottle):
    """Clay the molded body while leaving the locked finish glass untouched."""
    if "bb_finish_datum_z_mm" not in bottle:
        raise ValueError("body-only clay requires bb_finish_datum_z_mm metadata")
    clay = clay_material()
    materials = list(bottle.data.materials)
    if clay in materials:
        clay_index = materials.index(clay)
    else:
        bottle.data.materials.append(clay)
        clay_index = len(bottle.data.materials) - 1
    datum_z = float(bottle["bb_finish_datum_z_mm"])
    for polygon in bottle.data.polygons:
        mean_z = sum(
            bottle.data.vertices[index].co.z for index in polygon.vertices
        ) / len(polygon.vertices)
        if mean_z < datum_z - 1e-4:
            polygon.material_index = clay_index
    return clay


def neck_frame(bottle):
    """Camera height/distance framing the finish, derived from the asset's
    own custom properties (written at build time)."""
    h = float(bottle["height_mm"])
    neck_h = float(bottle["neck_h"])
    return h - neck_h * 0.45, 61.0        # cz, distance


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--view", required=True,
                   choices=["front", "macro", "threequarter", "section", "spin"])
    p.add_argument("--out", required=True)
    p.add_argument("--samples", type=int, default=160)
    p.add_argument("--spin-phi", type=float, default=0.0,
                   help="bottle Z rotation in degrees (section pose)")
    p.add_argument("--res", type=int, nargs=2, default=None,
                   help="override resolution, e.g. --res 1040 1144")
    clay_group = p.add_mutually_exclusive_group()
    clay_group.add_argument(
        "--clay",
        action="store_true",
        help="neutral opaque clay on bottle + closures, any view "
             "(the THREAD-STANDARD.md gate material)",
    )
    clay_group.add_argument(
        "--clay-body-only",
        action="store_true",
        help="clay only below the finish datum; preserve locked neck glass",
    )
    a = p.parse_args(argv)

    enable_gpu()
    s = bpy.context.scene
    s.cycles.samples = a.samples
    if a.res:
        s.render.resolution_x, s.render.resolution_y = a.res
    cam = bpy.data.objects["BB_CAM_MASTER"]
    bottle = bottle_object()
    if a.clay_body_only:
        apply_body_only_clay(bottle)
    elif a.clay or a.view == "section":
        apply_clay(product_meshes())

    if a.view == "front":
        pass                                       # master camera as saved

    elif a.view == "macro":
        cz, dist = neck_frame(bottle)
        cam.location = (0, -dist, cz)
        cam.rotation_euler = (math.radians(90), 0, 0)

    elif a.view == "threequarter":
        h = float(bottle["height_mm"])
        env = max(110.0, h * 1.25)
        ang = math.radians(38)
        d0 = env / 0.36
        cam.location = (d0 * math.sin(ang), -d0 * math.cos(ang), 0.32 * env)
        cam.rotation_euler = (math.radians(90), 0, ang)

    elif a.view == "section":
        bottle.rotation_euler = (0, 0, math.radians(a.spin_phi))
        cut = bpy.data.meshes.new("CUT")
        sz = 300.0
        cut.from_pydata(
            [(-sz, -sz, -10), (sz, -sz, -10), (sz, 0, -10), (-sz, 0, -10),
             (-sz, -sz, 300), (sz, -sz, 300), (sz, 0, 300), (-sz, 0, 300)],
            [],
            [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
             (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)])
        cut.update()
        # from_pydata winding above is INWARD; an inside-out cutter makes
        # the EXACT boolean stitch seams instead of cutting (latent since
        # this preset was written — caught by the thread clay gate).
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(cut)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(cut)
        bm.free()
        co = bpy.data.objects.new("CUT", cut)
        s.collection.objects.link(co)
        co.hide_render = True
        for o in product_meshes():         # cut cap + roller too: the sheet
            m = o.modifiers.new("SECTION", "BOOLEAN")   # convention, and the
            m.operation = "DIFFERENCE"     # cap section shows the anti-phase
            m.object = co                  # thread engagement
        cz, dist = neck_frame(bottle)
        cam.location = (0, -dist, cz)
        cam.rotation_euler = (math.radians(90), 0, 0)

    elif a.view == "spin":
        cz, dist = neck_frame(bottle)
        cam.location = (0, -dist, cz)
        cam.rotation_euler = (math.radians(90), 0, 0)
        base = a.out.rsplit(".", 1)[0]
        for phi in range(0, 360, 45):
            bottle.rotation_euler = (0, 0, math.radians(phi))
            s.render.filepath = f"{base}-{phi:03d}.png"
            bpy.ops.render.render(write_still=True)
        print(f"VIEW_DONE spin {base}-*.png")
        return

    s.render.filepath = a.out
    bpy.ops.render.render(write_still=True)
    print(f"VIEW_DONE {a.view} {a.out}")


if __name__ == "__main__":
    main()
