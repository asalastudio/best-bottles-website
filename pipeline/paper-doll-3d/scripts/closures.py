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

# Cap listings the live site publishes, in the same shape as the rig's
# CAPS_BY_FINISH. These are PUBLISHED dimensions, not derived ones.
#
#   plain    CP18-415MtSl    19 +/-0.5 x Ø21 +/-0.5   483 SKUs
#   leather  CP18-415BlkLthr 30 +/-0.5 x Ø25 +/-0.5    82 SKUs (the wrap adds
#                                                      real diameter and height)
#
# The 18-415 cap is SQUAT — h/d 0.90 against 1.42 for both 17-415 and 13-415 —
# so it cannot be extrapolated from the family, which is exactly why the thread
# standard recorded "(no cap modeled yet)" rather than guessing. The isolated
# PSD layer independently measures h/d 0.95-1.00, agreeing with the listing.
#
# Thread fit follows the two measured caps: the cap's root land clears the
# bottle's crest T by a consistent +0.60 on both 17-415 (16.90 vs 16.3) and
# 13-415 (13.40 vs 12.8). Crest clearance over E varies (+0.30 / +0.70), so
# the midpoint is used and flagged.
LOCAL_CAPS = {
    "18-415": dict(asset_id="BB_CAP_18415_001", height=19.0,
                   od_top=20.60, od_base=21.0,
                   thread_root_d=18.10,      # T 17.5 + 0.60, the measured rule
                   thread_crest_d=16.00,     # E 15.5 + 0.50, midpoint — DERIVED
                   source="bestbottles.com CP18-415MtSl listing"),
}


def cap_builder(rig, finish):
    """Threaded screw cap, built from the CAPS_BY_FINISH listing registry."""
    listing = dict(rig.CAPS_BY_FINISH, **LOCAL_CAPS).get(finish)
    if listing is None:
        raise SystemExit(
            f"no cap listing for {finish}. CAPS_BY_FINISH has "
            f"{sorted(dict(rig.CAPS_BY_FINISH, **LOCAL_CAPS))}. Photo-solve it "
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


# ---------------------------------------------------------------------------
# The 17-415 family — already MEASURED, only ever trapped in the render rig.
# ---------------------------------------------------------------------------
# Every part is exported SEPARATELY so the configurator can swap one piece,
# recolour one piece, or pull the stack apart for an exploded view. Split
# where the real product has a separate moulding or a separate colour (roller
# housing / ball; collar / actuator / overcap) — never for cosmetic sub-pieces,
# which multiplies files without buying versatility.
#
# EVERY part's origin is the NECK RIM, z = 0. That is the house convention
# ("origin IS the rim datum"), so the browser does one thing for all of them:
# parent to BB_ATTACH_NECK, zero the transform. Position within the stack is
# baked into the geometry, so an exploded view is a translation along +Y by
# stack index and nothing has to know each part's seating maths.

def _load_c17(rig):
    """components_17415.py, loaded the way the rig itself loads it."""
    import importlib.util as ilu
    spec = ilu.spec_from_file_location(
        "components_17415", RIG_DIR / "components_17415.py")
    mod = ilu.module_from_spec(spec)
    sys.modules["components_17415"] = mod
    spec.loader.exec_module(mod)
    return mod


def roller_housing_builder(rig, finish, variant):
    c17 = _load_c17(rig)
    rs = c17.ROLLER_PLASTIC_17415 if variant == "plastic" else rig.ROLLER_17415
    bore_r = rig.FINISH_MASTERS[finish]["bore_d"] / 2.0
    return dict(spec=rs, profile=rig.roller_profile(rs, bore_r), modulate=None)


def roller_ball_builder(rig, finish, variant):
    """A sphere, not a revolve — and it carries its own seat height.

    The rig parents the ball to the neck and sets location z = ball_z. Baking
    that offset into the geometry instead keeps the one rule that every part
    parent-and-zeros; otherwise the ball alone would need special handling in
    the browser.
    """
    c17 = _load_c17(rig)
    rs = c17.ROLLER_PLASTIC_17415 if variant == "plastic" else rig.ROLLER_17415
    return dict(spec=rs, sphere=(rs["ball_d"], rs["ball_z"]))


def collar_builder(rig, finish, variant):
    c17 = _load_c17(rig)
    cs = c17.COLLAR_17415
    bottle = rig.FINISH_MASTERS[finish]
    rig.resolve_thread(bottle)
    if "turns" not in bottle and "thread_band" in bottle:
        bottle["turns"] = bottle["thread_band"] / bottle["pitch"]
    return dict(spec=cs, profile=c17.collar_profile(rig, cs),
                modulate=rig.cap_thread_modulator(cs, bottle))


def actuator_builder(rig, finish, variant):
    c17 = _load_c17(rig)
    hs = c17.ACTUATOR_17415
    return dict(spec=hs, profile=c17.actuator_profile(hs), modulate=None)


def overcap_builder(rig, finish, variant):
    c17 = _load_c17(rig)
    oc = c17.OVERCAP_17415
    return dict(spec=oc, profile=c17.overcap_profile(oc), modulate=None)


# --------------------------------------------------------------- 18-415 reducer
# Traced from the ISOLATED part layer in
# "20. Closures .../23. 18-415 Reducer/18-415Reducer.psd" (Layer 2, 114x128 px),
# which photographs the plug alone on white — no bottle to separate it from.
#
# SCALE comes from the finish, not the photo: the plug body press-fits the
# 18-415 bore (Ø10.3, drawing-exact) less 0.10/side, the same fit the roller
# record uses. 99 px == 10.10 mm gives 9.802 px/mm, and every other dimension
# falls out of that one anchor.
#
# It corroborates: flange 11.63 > bore 10.30 so it seats on the rim; 11.63 <
# E 15.50 so it clears inside a cap; insert 10.71 < finish_h 15.80 so it sits
# within the finish. A wrong scale would break at least one of those.
REDUCER_18415 = dict(
    asset_id="BB_RDCR_18415_001",
    source="18-415Reducer.psd Layer 2, traced 2026-08-30",
    scale_reference="body OD == 18-415 bore 10.3 less 0.10/side press fit",
    lip_od=7.65, lip_top_z=2.24,
    flange_od=11.63, flange_top_z=0.92,
    body_od=10.10, body_bottom_z=-8.88,
    chamfer_od=6.43, bottom_z=-10.71,
    orifice_d=1.6,        # ASSUMED — a silhouette cannot show a bore. The
                          # part's whole job is to restrict flow, so it is a
                          # through-channel, but this diameter is unverified.
)


def reducer_profile(rd):
    """Closed (r,z) outline, z = 0 on the flange underside — its mating face,
    which rests on the neck rim, so seating stays parent-and-zero."""
    ro = rd["orifice_d"] / 2.0
    p = [
        (ro, rd["bottom_z"]),                       # bore mouth at the bottom
        (rd["chamfer_od"] / 2.0, rd["bottom_z"]),   # chamfered lead-in
        (rd["body_od"] / 2.0, rd["body_bottom_z"]),
        (rd["body_od"] / 2.0, 0.0),                 # body, inside the bore
        (rd["flange_od"] / 2.0, 0.0),               # flange underside = the rim
        (rd["flange_od"] / 2.0, rd["flange_top_z"]),
        (rd["lip_od"] / 2.0, rd["flange_top_z"]),   # flange top face
        (rd["lip_od"] / 2.0, rd["lip_top_z"]),      # lip, proud of the rim
        (ro, rd["lip_top_z"]),
    ]
    z = rd["lip_top_z"]                             # back down the channel
    while z > rd["bottom_z"] + 0.2:
        p.append((ro, z)); z -= 0.4
    p.append((ro, rd["bottom_z"]))
    return _dedupe_profile(p)


def _dedupe_profile(p, eps=1e-4):
    out = [p[0]]
    for q in p[1:]:
        if abs(q[0] - out[-1][0]) > eps or abs(q[1] - out[-1][1]) > eps:
            out.append(q)
    return out


def reducer_builder(rig, finish, variant):
    return dict(spec=REDUCER_18415, profile=reducer_profile(REDUCER_18415),
                modulate=None)


def cap_part_builder(rig, finish, variant):
    cs, profile, modulate = cap_builder(rig, finish)
    return dict(spec=cs, profile=profile, modulate=modulate)


# (finish, part, variant) -> builder.  `part` names the MESH; `variant` is a
# distinct moulding of that part, never a colour.
PARTS = {
    ("17-415", "ROLL_HOUSING", "plastic"): roller_housing_builder,
    ("17-415", "ROLL_HOUSING", "steel"):   roller_housing_builder,
    ("17-415", "ROLL_BALL", "plastic"):    roller_ball_builder,
    ("17-415", "ROLL_BALL", "steel"):      roller_ball_builder,
    ("17-415", "SPR_COLLAR", None):        collar_builder,
    ("17-415", "SPR_ACTUATOR", None):      actuator_builder,
    ("17-415", "SPR_OVERCAP", None):       overcap_builder,
    ("17-415", "CAP", None):               cap_part_builder,
    ("13-415", "CAP", None):               cap_part_builder,
    ("18-415", "REDUCER", None):           reducer_builder,
    ("18-415", "CAP", None):               cap_part_builder,
}

# Assembly = an ordered stack of parts, bottom first. The order is what an
# exploded view animates along; it is NOT a rendering hint.
ASSEMBLIES = {
    ("17-415", "roller-plastic"): ["ROLL_HOUSING@plastic", "ROLL_BALL@plastic"],
    ("17-415", "roller-steel"):   ["ROLL_HOUSING@steel", "ROLL_BALL@steel"],
    ("17-415", "sprayer"):        ["SPR_COLLAR", "SPR_ACTUATOR", "SPR_OVERCAP"],
    ("17-415", "lotion-pump"):    ["SPR_COLLAR", "SPR_ACTUATOR", "SPR_OVERCAP"],
    ("17-415", "cap"):            ["CAP"],
    ("13-415", "cap"):            ["CAP"],
    ("18-415", "reducer"):        ["REDUCER", "CAP"],
    ("18-415", "cap"):            ["CAP"],
}


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


def build_part(rig, finish, part, variant, segments):
    """Build ONE closure part as a bare mesh in metres, origin on the rim."""
    from mathutils import Matrix

    builder = PARTS.get((finish, part, variant))
    if builder is None:
        raise SystemExit(f"no builder for {(finish, part, variant)}. "
                         f"have: {sorted(PARTS)}")
    rec = builder(rig, finish, variant)
    name = f"BB_{part}_{finish.replace('-', '')}"
    if variant:
        name += f"_{variant.upper()}"

    if "sphere" in rec:
        d, z = rec["sphere"]
        obj = rig.uv_sphere(name, d)
        if obj.name not in bpy.context.scene.collection.objects:
            try:
                bpy.context.scene.collection.objects.link(obj)
            except RuntimeError:
                pass
        obj.data.transform(Matrix.Translation((0.0, 0.0, z)))   # bake the seat
    else:
        obj = rig.revolve(name, rec["profile"], segments=segments,
                          modulate=rec.get("modulate"))
        bpy.context.scene.collection.objects.link(obj)
        weld_seam(obj)

    obj.data.transform(_scale_matrix(MM))
    strip_materials(obj)
    return obj, rec["spec"]


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

def build_all_parts(rig, args):
    """Export every registered part, plus the assembly stacks that use them."""
    import json

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    made, failed = {}, []

    print("\n=== closure parts ===")
    for (finish, part, variant) in sorted(PARTS, key=lambda k: (k[0], k[1], k[2] or "")):
        if args.finish and finish != args.finish:
            continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        try:
            obj, spec = build_part(rig, finish, part, variant, args.segments)
        except Exception as exc:
            failed.append((finish, part, variant, str(exc)[:90]))
            print(f"  FAIL {finish} {part} {variant or '':8s} {str(exc)[:70]}")
            continue
        rep = verify_part(obj)
        path = out_dir / f"{obj.name}.glb"
        export_glb(obj, path)
        key = f"{part}@{variant}" if variant else part
        made[(finish, key)] = dict(
            file=path.name, mesh=obj.name, finish=finish, part=part,
            variant=variant, attach="BB_ATTACH_NECK",
            asset_id=spec.get("asset_id"),
            non_manifold=rep["non_manifold_edges"], verts=rep["verts"],
            height_mm=round(rep["height_mm"], 2),
            max_diameter_mm=round(rep["max_diameter_mm"], 2))
        flag = "" if rep["non_manifold_edges"] == 0 else "  NOT WATERTIGHT"
        print(f"  ok   {obj.name:34s} {rep['height_mm']:6.2f}h "
              f"x {rep['max_diameter_mm']:6.2f}d  {rep['verts']:6d}v"
              f"  nm={rep['non_manifold_edges']}{flag}")

    assemblies = []
    for (finish, kind), stack in sorted(ASSEMBLIES.items()):
        if args.finish and finish != args.finish:
            continue
        if all((finish, k) in made for k in stack):
            assemblies.append(dict(finish=finish, kind=kind,
                                   stack=[made[(finish, k)]["mesh"] for k in stack]))
    manifest = dict(
        contract=dict(units="metres", up="Y", materials=0,
                      origin="neck rim (BB_ATTACH_NECK) for EVERY part",
                      seating="parent to BB_ATTACH_NECK and zero the transform",
                      exploded="translate each part along +Y by its stack index"),
        parts=list(made.values()), assemblies=assemblies)
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"\n  {len(made)} parts, {len(assemblies)} assemblies -> "
          f"{out_dir}/manifest.json")
    if failed:
        print(f"  {len(failed)} FAILED")
    return 1 if failed else 0


def verify_part(obj):
    import bmesh
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)   # glTF-style weld
    nm = sum(1 for e in bm.edges if not e.is_manifold)
    bm.free()
    zs = [v.co.z for v in obj.data.vertices]
    rs = [(v.co.x ** 2 + v.co.y ** 2) ** 0.5 for v in obj.data.vertices]
    return dict(non_manifold_edges=nm, verts=len(obj.data.vertices),
                height_mm=(max(zs) - min(zs)) / MM,
                max_diameter_mm=max(rs) * 2 / MM)


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--finish", default="17-415")
    ap.add_argument("--kind", default="cap")
    ap.add_argument("--parts", action="store_true",
                    help="build every registered PART for --finish (Phase 1)")
    ap.add_argument("--segments", type=int, default=96)
    ap.add_argument("--out", default="glb-closures")
    args = ap.parse_args(argv)

    if args.parts:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        return build_all_parts(load_rig(), args)

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
