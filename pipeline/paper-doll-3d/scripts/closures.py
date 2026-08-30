#!/usr/bin/env python3
"""Geometry-only closure GLB exporter.

The measured closure geometry already exists in scripts/paper-doll-3d/ — it is
just trapped in a RENDER pipeline that bakes materials and never exports. This
module imports those specs and profile functions, rebuilds them as bare meshes,
and writes them to the same delivery contract the bottle bodies use:

    BB_CAP_<finish>      one mesh, closed solid, POSITION + NORMAL only.
                         NO material, NO texture, NO UVs.
    origin (0,0,0)       the MATING FACE = the neck rim, so a closure
                         parent-and-zeros onto the body's BB_ATTACH_NECK.

    Y-up, metres.

That origin is not a choice made here: cap_profile() in build-master-scene.py
already documents "z=0 on the neck rim (its mating datum)", and
components_17415.py says "origin IS the rim datum". This exporter only has to
avoid breaking it.

Run:
    blender --background --python scripts/closures.py -- \
        --finish 17-415 --kind cap --out glb-closures
"""

from __future__ import annotations

import argparse
import importlib.util as ilu
import sys
from pathlib import Path

import bpy

MM = 0.001                      # spec millimetres -> Blender/GLB metres

# The render rig lives outside this pipeline directory; its filename is
# hyphenated, so it cannot be a plain import.
RIG_DIR = Path(__file__).resolve().parents[3] / "scripts" / "paper-doll-3d"


def load_rig():
    """Import build-master-scene.py for its specs, profiles and revolve().

    Safe to import: the module guards its entry point with __main__.
    """
    spec = ilu.spec_from_file_location(
        "build_master_scene", RIG_DIR / "build-master-scene.py")
    mod = ilu.module_from_spec(spec)
    sys.modules["build_master_scene"] = mod
    spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------------------
# Closure registry — spec + profile + thread, per (finish, kind)
# ---------------------------------------------------------------------------
# Only what is MEASURED goes here. 18-415 caps are deliberately absent: the
# thread standard records "(no cap modeled yet)" for that finish, and the
# source art in "20. Closures .../6. 18-415 Caps" has not been photo-solved
# yet. Inventing dimensions for the 694-SKU finish would be the one mistake
# this lane cannot afford.

# How far the cap skirt runs below the rim. Measured for 17-415 (14.70 against
# a 13.76 finish): the skirt covers the ENTIRE finish and passes the flange
# bead by ~2.9 mm, ending 0.94 mm below the attachment datum. Applied to other
# finishes that rule is a derivation, not a measurement — hence PROVISIONAL,
# the same status components_17415.py carries for its photo-solved records.
SKIRT_BELOW_DATUM = 0.94

MEASURED_SKIRT = {"17-415": 14.70}          # do not derive what was measured


def cap_builder(rig, finish):
    """Threaded screw cap, built from the CAPS_BY_FINISH listing registry."""
    listing = rig.CAPS_BY_FINISH.get(finish)
    if listing is None:
        raise SystemExit(
            f"no cap listing for {finish}. CAPS_BY_FINISH has "
            f"{sorted(rig.CAPS_BY_FINISH)}. Photo-solve {finish} from the PSD "
            f"library ('20. Closures .../{finish} Caps') before building it — "
            f"inventing a height for a 694-SKU finish is not a shortcut.")

    bottle = rig.FINISH_MASTERS[finish]

    # rig.resolve_thread() only injects `turns` when a spec has NO explicit
    # pitch, so a finish that declares `pitch=3.175` (13-415, 15-415) passes
    # through and cap_thread_modulator then dies on KeyError: 'turns'. The law
    # is turns = band / pitch (THREAD-STANDARD.md §1), so apply it here rather
    # than mutating the shared rig.
    rig.resolve_thread(bottle)
    if "turns" not in bottle and "thread_band" in bottle:
        bottle["turns"] = bottle["thread_band"] / bottle["pitch"]

    skirt = MEASURED_SKIRT.get(finish, bottle["finish_h"] + SKIRT_BELOW_DATUM)
    cs = dict(rig.CAP_COMMON, **listing)
    cs["skirt_below_rim"] = skirt
    cs["provisional"] = finish not in MEASURED_SKIRT

    # The skirt has to clear the transfer bead or the cap cannot seat.
    bead_bottom = bottle["finish_h"] - (bottle.get("bead_z", 0.0)
                                        + bottle.get("bead_h", 0.0))
    if skirt < bead_bottom:
        raise SystemExit(f"{finish} cap skirt {skirt:.2f} stops above the "
                         f"flange bead at {bead_bottom:.2f} — it would not seat")

    return cs, rig.cap_profile(cs), rig.cap_thread_modulator(cs, bottle)


BUILDERS = {
    ("17-415", "cap"): cap_builder,
    ("13-415", "cap"): cap_builder,
}


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def build_closure(rig, finish, kind, segments):
    """Revolve the closure profile into a bare mesh, in metres."""
    builder = BUILDERS.get((finish, kind))
    if builder is None:
        raise SystemExit(f"no builder registered for {finish} {kind}. "
                         f"have: {sorted(BUILDERS)}")
    cs, profile, modulate = builder(rig, finish)

    name = f"BB_CAP_{finish.replace('-', '')}" if kind == "cap" else \
           f"BB_{kind.upper()}_{finish.replace('-', '')}"
    obj = rig.revolve(name, profile, segments=segments, modulate=modulate)
    # revolve() returns an UNLINKED object; the caller owns scene membership.
    bpy.context.scene.collection.objects.link(obj)
    weld_seam(obj)

    # The rig's profiles are in millimetres; the delivery contract is metres.
    # Scale the MESH DATA, not the object, so the exported transform stays
    # identity and the origin remains exactly the mating face.
    obj.data.transform(_scale_matrix(MM))

    strip_materials(obj)
    return obj, cs


def weld_seam(obj):
    """Close the revolve seam.

    cap_profile() returns a CLOSED outline — its first and last points are the
    same (r,z) — so revolve() lays down two coincident vertex rings at that
    seam and every edge on it borders one face instead of two. That reads as
    `segments * 2` non-manifold edges and nothing else is wrong with the mesh.

    Threshold is 1e-4 MILLIMETRES (this runs pre-scale). The bodies lane lost
    real time to Blender's 0.01 m default welding whole bottles into their own
    axis; anything at feature scale here would eat a 0.75 mm thread.
    """
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def _scale_matrix(s):
    from mathutils import Matrix
    return Matrix.Diagonal((s, s, s, 1.0))


def strip_materials(obj):
    """The browser shades by mesh name. A material in the file is a defect."""
    obj.data.materials.clear()
    while obj.material_slots:
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.material_slot_remove()


# ---------------------------------------------------------------------------
# Verify — the same gates the bodies pass
# ---------------------------------------------------------------------------

def verify(obj, cs):
    """Closed solid, correct height, and the mating face at the origin."""
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    loose = [e for e in bm.edges if len(e.link_faces) != 2]
    nonmanifold = len(loose)
    bm.free()

    bb = [v.co for v in obj.data.vertices]
    z_lo = min(v.z for v in bb) / MM
    z_hi = max(v.z for v in bb) / MM
    r_max = max((v.x ** 2 + v.y ** 2) ** 0.5 for v in bb) / MM

    report = {
        "non_manifold_edges": nonmanifold,
        "height_mm": z_hi - z_lo,
        "spec_height_mm": cs["height"],
        "skirt_below_rim_mm": -z_lo,
        "spec_skirt_below_rim_mm": cs["skirt_below_rim"],
        "max_diameter_mm": r_max * 2,
        "spec_od_base_mm": cs["od_base"],
        "verts": len(obj.data.vertices),
    }
    report["height_dev_mm"] = report["height_mm"] - cs["height"]
    report["skirt_dev_mm"] = (report["skirt_below_rim_mm"]
                              - cs["skirt_below_rim"])
    return report


def export_glb(obj, out_path):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=str(out_path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
    )


# ---------------------------------------------------------------------------

def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--finish", default="17-415")
    ap.add_argument("--kind", default="cap")
    ap.add_argument("--segments", type=int, default=96)
    ap.add_argument("--out", default="glb-closures")
    args = ap.parse_args(argv)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    rig = load_rig()

    obj, cs = build_closure(rig, args.finish, args.kind, args.segments)
    report = verify(obj, cs)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{obj.name}.glb"
    export_glb(obj, out_path)

    print("\n=== closure build report ===")
    for k, v in report.items():
        print(f"  {k:26s} {v}")
    print(f"  materials on object       {len(obj.data.materials)}")
    print(f"  wrote                     {out_path} "
          f"({out_path.stat().st_size / 1024:.0f} KB)")

    fail = []
    if report["non_manifold_edges"]:
        fail.append(f"{report['non_manifold_edges']} non-manifold edges")
    if abs(report["height_dev_mm"]) > 0.05:
        fail.append(f"height off by {report['height_dev_mm']:.3f} mm")
    if abs(report["skirt_dev_mm"]) > 0.05:
        fail.append(f"mating face off by {report['skirt_dev_mm']:.3f} mm")
    if len(obj.data.materials):
        fail.append("materials present")
    print("  GATE                      " + ("FAIL: " + "; ".join(fail)
                                             if fail else "PASS"))
    return 1 if fail else 0


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    sys.exit(main(argv))
