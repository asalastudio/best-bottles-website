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
import math
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

# MOULDING VARIANTS, measured 2026-08-31 from "6. 18-415 Caps" PSDs scaled
# by the known diameters (short/tall share the O21 wall; leather is the
# published 30 x O25 listing — the wrap adds real size). Tall = mean of
# ShnBlkTall (h/w 1.310), MtSlTall (1.247), Wh (1.268) at O21 -> 26.8.
# White exists ONLY as a tall cap.
LOCAL_CAP_VARIANTS = {
    ("18-415", "tall"): dict(
        asset_id="BB_CAP_18415_TALL_001", height=26.8,
        od_top=20.60, od_base=21.0,
        thread_root_d=18.10, thread_crest_d=16.00,
        source="CP18-415ShnBlkTall/MtSlTall/Wh PSDs at O21"),
    ("18-415", "leather"): dict(
        asset_id="BB_CAP_18415_LTHR_001", height=30.0,
        od_top=24.60, od_base=25.0,
        thread_root_d=18.10, thread_crest_d=16.00,
        source="bestbottles.com CP18-415BlkLthr listing 30 x O25; PSD h/w agrees"),
}


def cap_builder(rig, finish, variant=None):
    """Threaded screw cap, built from the CAPS_BY_FINISH listing registry.
    `variant` selects an alternative MOULDING (tall / leather) of the same
    thread — a different physical cap, never just a colour."""
    listing = (LOCAL_CAP_VARIANTS.get((finish, variant)) if variant
               else dict(rig.CAPS_BY_FINISH, **LOCAL_CAPS).get(finish))
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



def _fin_spec(c17, base, finish):
    """COLLAR_17415 / COLLAR_18415 etc. — spec dict selected by finish."""
    return getattr(c17, f"{base}_{finish.replace('-', '')}")

def collar_builder(rig, finish, variant):
    c17 = _load_c17(rig)
    cs = _fin_spec(c17, "COLLAR", finish)
    bottle = rig.FINISH_MASTERS[finish]
    rig.resolve_thread(bottle)
    if "turns" not in bottle and "thread_band" in bottle:
        bottle["turns"] = bottle["thread_band"] / bottle["pitch"]
    return dict(spec=cs, profile=c17.collar_profile(rig, cs),
                modulate=rig.cap_thread_modulator(cs, bottle))


def actuator_builder(rig, finish, variant):
    c17 = _load_c17(rig)
    hs = _fin_spec(c17, "ACTUATOR", finish)
    return dict(spec=hs, profile=c17.actuator_profile(hs), modulate=None)


def overcap_builder(rig, finish, variant):
    """The overcap seats on the COLLAR's top face, not on the rim.

    fit_closure() parents it to the collar-top datum and zeroes it, and
    COLLAR_17415 documents `top_face_z=3.0` as "overcap seating plane". Its
    own profile starts at its base, so exporting it unshifted puts it 3 mm
    too low once every part is rim-referenced. Bake the offset in, keeping
    the one rule that all parts parent-and-zero to BB_ATTACH_NECK.
    """
    c17 = _load_c17(rig)
    oc = _fin_spec(c17, "OVERCAP", finish)
    z0 = _fin_spec(c17, "COLLAR", finish)["top_face_z"]
    prof = [(r, z + z0) for r, z in c17.overcap_profile(oc)]
    return dict(spec=oc, profile=prof, modulate=None)


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


def pump_spout_builder(rig, finish, variant):
    """The lotion pump's spout nub — geometry, and the ONLY thing distinguishing
    a pump from a sprayer.

    components_17415 builds one actuator moulding for both and differentiates
    them at the face: the pump gets this sideways spout, the sprayer an orifice
    insert. Exporting neither made the two assemblies byte-identical, which is
    exactly the "missing detail" it looks like. No material can add it — a
    normal map cannot either, since these meshes carry no UVs by design.

    It is OFF-AXIS: a small cylinder lying along -Y, so it cannot come from the
    lathe path. Built, rotated and positioned here, then baked so its origin is
    still the neck rim and it parent-and-zeros like every other part.
    """
    import bmesh
    from mathutils import Matrix

    c17 = _load_c17(rig)
    hs = _fin_spec(c17, "ACTUATOR", finish)
    r_face = (hs["body_od_high"] / 2.0
              + (hs["body_od_low"] - hs["body_od_high"]) / 2.0 * 0.25)
    d, proud, z = hs["pump_spout_d"], hs["pump_spout_proud"], hs["pump_spout_z"]

    me = bpy.data.meshes.new("BB_PMP_SPOUT_17415")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=32,
                          radius1=d / 2.0, radius2=d / 2.0, depth=proud + 1.0)
    bm.to_mesh(me); bm.free()
    obj = bpy.data.objects.new("BB_PMP_SPOUT_17415", me)
    bpy.context.scene.collection.objects.link(obj)
    # create_cone builds along +Z centred on the origin: stand it along -Y and
    # push it out to the actuator face at the spout height.
    obj.data.transform(Matrix.Rotation(math.radians(90.0), 4, "X"))
    obj.data.transform(Matrix.Translation((0.0, -(r_face - 1.0), z)))
    return dict(spec=dict(asset_id="BB_PMP_SPOUT_17415",
                          spout_d=d, proud=proud, spout_z=z),
                object=obj)


def spr_insert_builder(rig, finish, variant):
    """The sprayer's discharge orifice — the visible hole the mist exits.

    ADDED 2026-08-31 (Jordan: "we can't see the hole where the spray comes
    out"). 18-415 has had its white nozzle insert from day one; 17-415
    never got one, so the head read as a blank cylinder. Geometry does the
    work: a slim flush ring with a counterbored hole — self-shadowing in
    the recess reads as the dark orifice, no dedicated material needed.

    Same off-axis pattern as pump_spout_builder: built along +Z, stood
    along -Y, pushed out to the actuator face at orifice_z.
    """
    import bmesh
    from mathutils import Matrix

    c17 = _load_c17(rig)
    hs = _fin_spec(c17, "ACTUATOR", finish)
    r_face = hs["body_od_high"] / 2.0
    d, depth, hole = hs["spray_insert_d"], hs["spray_insert_depth"], hs["spray_hole_d"]
    z = hs["orifice_z"]

    me = bpy.data.meshes.new(f"BB_SPR_INSERT_{finish.replace('-','')}")
    bm = bmesh.new()
    ro, rc, rh = d / 2.0, d / 2.0 - 0.35, hole / 2.0
    SEG = 32
    L = depth + 1.0                                # sits into the face
    rings = [
        (ro, 0.10),                                # flush outer lip, barely proud
        (ro, -L + 0.4),
        (rc, 0.10),                                # counterbore face
        (rh, 0.10 - depth),                        # recess floor at the hole
        (rh, -L),                                  # hole tube inward (shadow)
    ]
    ring_verts = []
    for r, zz in rings:
        ring_verts.append([bm.verts.new((r * math.cos(2 * math.pi * i / SEG),
                                         r * math.sin(2 * math.pi * i / SEG), zz))
                           for i in range(SEG)])
    def lace(a, b):
        for i in range(SEG):
            j = (i + 1) % SEG
            bm.faces.new((a[i], a[j], b[j], b[i]))
    lace(ring_verts[0], ring_verts[1])             # outer wall (into the head)
    lace(ring_verts[0], ring_verts[2])             # lip face
    lace(ring_verts[2], ring_verts[3])             # counterbore cone
    lace(ring_verts[3], ring_verts[4])             # hole bore
    bm.normal_update()
    bm.to_mesh(me); bm.free()
    for poly in me.polygons: poly.use_smooth = True
    obj = bpy.data.objects.new(f"BB_SPR_INSERT_{finish.replace('-','')}", me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.transform(Matrix.Rotation(math.radians(90.0), 4, "X"))
    obj.data.transform(Matrix.Translation((0.0, -(r_face - 0.05), z)))
    return dict(spec=dict(asset_id=f"BB_SPR_INSERT_{finish.replace('-','')}",
                          insert_d=d, hole_d=hole, orifice_z=z),
                object=obj)


# Dot studs, measured in build-master-scene.py: ~1.4 mm domes on a STAGGERED
# lattice, ~3.9 mm row pitch, 8 columns, extracted from CpRoll17-415*Dot.psd.
DOTS_17415 = dict(
    asset_id="BB_CAP_DOTS_17415_001",
    # MEASURED 2026-08-30 from the isolated cap layer in
    # "20. Closures .../12. 17-415 Roll on/2. CpRoll17-415BlkDot.psd", scaled
    # by the published cap Ø19.0. Supersedes build-master-scene's comment
    # ("1.4 mm, 3.9 mm pitch, 8 columns"), which gives ~3x too many studs and
    # reads as a dense speckle instead of the sparse jewels the product has.
    #
    # The front face shows THREE columns, so six around the circumference at
    # 60 deg. Centre column studs sit at y 5.92 / 14.24 / 22.41 mm (pitch
    # ~8.25) and the side columns at 9.85 / 18.42 — offset half a row, which is
    # the stagger.
    dot_d=1.2, row_pitch=8.4, columns=6,
    # FLUSH-set rhinestones (Jordan, twice): "they need to be flush...
    # they need to sit inside". Even 0.12mm proud broke the silhouette at
    # close zoom. Now the stone's table rises only `proud` (invisible at
    # any zoom, kept nonzero solely to beat z-fighting) and the bezel is
    # buried `sink` INSIDE the wall — the outline stays perfectly clean.
    proud=0.04, sink=0.02,
    z_lo=-8.9, z_hi=9.6,    # measured span, referenced to the rim datum
)


def cap_dots_builder(rig, finish, variant):
    """The studs on a *Dot cap — GEOMETRY, and a separate part from the shell.

    The render rig does these as a shader (stud mask + dome bump + silver metal
    in-dot) on the cap mesh. That cannot cross to the browser: these meshes
    carry no UVs, so there is nothing to map a texture to — and a normal map
    would be wrong regardless, because real studs BREAK THE SILHOUETTE at the
    edge of the cap and no bump map moves an outline.

    Separate from the shell because the product is: the studs read silver on
    the black, pink AND silver variants, so the shell takes the colourway and
    the studs stay metal. Same split as collar-and-actuator.
    """
    import bmesh
    from mathutils import Matrix

    d = DOTS_17415
    # Reuse cap_builder so the wall this sits on is the SAME wall the shell
    # builds — deriving skirt_below_rim twice is how the two drift apart.
    cs, _prof, _mod = cap_builder(rig, finish)
    r_base, r_top = cs["od_base"] / 2.0, cs["od_top"] / 2.0
    z_lo, z_hi = d["z_lo"], d["z_hi"]
    span = z_hi - z_lo
    rows = int(span // d["row_pitch"]) + 1

    me = bpy.data.meshes.new("BB_CAP_DOTS_17415")
    acc = bmesh.new()
    for col in range(d["columns"]):
        theta = 2.0 * math.pi * col / d["columns"]
        # stagger every other column by half a row, as the photo shows
        z0 = z_lo + (d["row_pitch"] / 2.0 if col % 2 else 0.0)
        z = z0
        while z <= z_hi:
            t = (z - (-cs["skirt_below_rim"])) / cs["height"]
            r_wall = r_base + (r_top - r_base) * max(0.0, min(1.0, t))
            tmp = bmesh.new()
            # RHINESTONE, truly flush: a tiny faceted stone — octagonal
            # table over bezel facets — whose table sits AT the wall
            # (+proud, sub-visible) while the bezel is buried `sink`
            # inside. Flat-shaded facets each catch their own glint; the
            # silhouette never bumps because nothing meaningfully protrudes.
            a, p_, s_ = d["dot_d"] / 2.0, d["proud"], d["sink"]
            depth = p_ + s_
            bmesh.ops.create_cone(tmp, cap_ends=True, segments=8,
                                  radius1=a, radius2=a * 0.62, depth=depth)
            # vary each stone's facet clocking so the glints don't repeat
            clock = math.radians((col * 37 + int(z * 7)) % 360)
            bmesh.ops.rotate(tmp, verts=tmp.verts,
                             cent=(0, 0, 0),
                             matrix=Matrix.Rotation(clock, 3, "Z"))
            # axis +Z -> radial: tilt the stone to face outward
            bmesh.ops.rotate(tmp, verts=tmp.verts, cent=(0, 0, 0),
                             matrix=Matrix.Rotation(math.pi / 2.0, 3, "Y"))
            bmesh.ops.rotate(tmp, verts=tmp.verts, cent=(0, 0, 0),
                             matrix=Matrix.Rotation(theta, 3, "Z"))
            off = r_wall - s_ + depth / 2.0
            bmesh.ops.translate(tmp, verts=tmp.verts,
                                vec=(off * math.cos(theta),
                                     off * math.sin(theta), z))
            me2 = bpy.data.meshes.new("t"); tmp.to_mesh(me2); tmp.free()
            acc.from_mesh(me2); bpy.data.meshes.remove(me2)
            z += d["row_pitch"]
    acc.to_mesh(me); acc.free()
    obj = bpy.data.objects.new("BB_CAP_DOTS_17415", me)
    bpy.context.scene.collection.objects.link(obj)
    return dict(spec=dict(d, count=rows * d["columns"]), object=obj)


def leather_cap_builder(rig, finish, variant):
    """The faux-leather cap, PROFILE-TRACED from CP18-415BlkLthr.psd
    (2026-08-31): a straight O24.5 wrap wall with a ~2.5mm top roundover
    and a slightly domed top — NOT the tapered hard-cap shell (Jordan:
    "the leather is completely off"). Published 30 x O25 envelope; traced
    wall O24.5, height 29.1. No visible thread: the wrap covers the shell,
    interior is a plain bore. Origin = neck rim per the house contract."""
    import math
    R, r_in = 12.25, 10.75
    skirt, top, ro = 16.75, 12.35, 2.5
    prof = [(r_in, -skirt), (r_in, top - 2.4), (0.001, top - 2.0),
            (0.001, top + 0.55)]
    prof.append((R - ro - 2.0, top + 0.35))          # gentle dome
    prof.append((R - ro, top))
    for i in range(1, 7):                             # top roundover
        a = math.pi / 2 * i / 6
        prof.append((R - ro + ro * math.sin(a), top - ro + ro * math.cos(a)))
    prof.append((R, -skirt))
    return dict(spec=dict(asset_id="BB_CAP_18415_LTHR_002",
                          height=skirt + top + 0.55, od=R * 2,
                          source="CP18-415BlkLthr.psd trace"),
                profile=prof, modulate=None)


def dip_tube_builder(rig, finish, variant):
    """The DIP TUBE, Pacdora-grade (Jordan's reference,
    pacdora.com/mockup-detail/510470): a THIN gently CURVED translucent
    line whose tip drifts to the bottle wall — never a straight fat rod
    ("looks like a piece of paper"). Swept O3 bezier, straight under the
    stem then bowing sideways toward the base. Origin = rim datum,
    descending -z; the viewer scales length to each body."""
    L = 62.0 if finish == "17-415" else 80.0
    bow = 7.0
    cu = bpy.data.curves.new("BB_DIP_TUBE", "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(2)
    for bp, co in zip(sp.bezier_points,
                      [(0.0, 0.0, 1.0), (0.6, 0.0, -L * 0.55),
                       (bow, 0.0, -L + 1.0)]):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    cu.bevel_depth = 1.4
    cu.bevel_resolution = 6
    cu.resolution_u = 32
    cu.use_fill_caps = True
    obj = bpy.data.objects.new("BB_DIP_TUBE", cu)
    bpy.context.scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.active_object
    return dict(spec=dict(asset_id=f"BB_DIP_TUBE_{finish.replace('-','')}",
                          od=2.8, length=L, bow=bow), object=obj)


def nozzle_insert_builder(rig, finish, variant):
    """The small WHITE nozzle/spout insert on the 18-415 head's face — the
    single non-trim element of the monochrome design (both PSD refs)."""
    import bmesh
    from mathutils import Matrix
    c17 = _load_c17(rig)
    hs = _fin_spec(c17, "ACTUATOR", finish)
    d, z = hs["spray_insert_d"], hs["orifice_z"]
    r_face = hs["body_od_high"] / 2.0
    me = bpy.data.meshes.new("noz")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=24,
                          radius1=d / 2.0, radius2=d / 2.0, depth=1.2)
    bm.to_mesh(me); bm.free()
    obj = bpy.data.objects.new("noz", me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.transform(Matrix.Rotation(math.radians(90.0), 4, "X"))
    obj.data.transform(Matrix.Translation((0.0, -(r_face - 0.35), z)))
    return dict(spec=dict(asset_id=f"BB_SPR_NOZZLE_{finish.replace('-','')}",
                          insert_d=d, z=z), object=obj)


def pump_body_builder(rig, finish, variant):
    """The INTERNAL pump mechanism visible through the glass below the
    collar (Jordan's reference crop: the white housing/valve body the
    tube hangs from). Professionals model the interior; a tube with no
    mechanism reads unanchored. Stepped white PP: gasket flange at the
    bore mouth -> housing barrel -> valve taper the tube exits from.
    Origin = rim datum, descending -z inside the neck."""
    fm = rig.FINISH_MASTERS[finish]
    bore_r = fm["bore_d"] / 2.0 - 0.15
    prof = [
        (bore_r, 0.0),               # gasket flange at the rim mouth
        (bore_r, -2.2),
        (bore_r - 0.9, -2.8),        # step to the housing barrel
        (bore_r - 0.9, -11.0),
        (2.6, -13.0),                # valve taper
        (2.6, -16.0),                # tube socket
        (1.4, -16.0),
        (1.4, 0.0),                  # inner bore back to datum
    ]
    return dict(spec=dict(asset_id=f"BB_PMP_BODY_{finish.replace('-','')}",
                          bore_d=fm["bore_d"], depth=16.0),
                profile=prof, modulate=None)


# ------------------------------------------------- antique bulb sprayer
# Measured 2026-08-31 from Ansp18-415Blk.psd at 14.55 px/mm (collar
# barrel = O21.3): chrome collar barrel 18.5 above the rim; ringed stem
# to a bullet nozzle topping out ~38; the mesh-net bulb is an egg
# 53.6 x 40 tilted ~30 deg, centred (-35, 0, +26), joined to the stem by
# a chrome ferrule. Tassel variant hangs cord+crown+fringe from the far
# tip. Bulb/tassel are SEPARATE parts (fabric colourway); collar+stem
# one chrome part.

def ansp_collar_builder(rig, finish, variant):
    """The antique atomizer's FITMENT — barrel + short stem stub.

    REBUILT 2026-08-31 (Jordan). The sculpted prototype supplies the bulb
    and its ferrule; the mechanical fitment is spec-built here, the same
    way every other 18-415 closure is, because hand-editing the sculpt's
    own collar produced a double-height barrel and a torn joint.

    Reference truth (GBElgFrst60AnSpBlk render, scaled off the bottle's
    known 54.5 mm width): the barrel covers the whole finish — top a shade
    proud of the rim, bottom landing on the shoulder — and reads ~20.4 mm
    OD. It uses COLLAR_18415's Ø21.3 so it matches the sprayer collar
    already shipping beside it. Only a short stub shows above the rim; the
    sculpted ferrule swallows it.
    """
    fm = rig.FINISH_MASTERS[finish]
    skirt = fm["finish_h"] - 0.45           # 15.35: stops shy of the datum
    bore_r = fm["bore_d"] / 2.0 - 0.2
    prof = [
        (10.65, -skirt),                    # barrel wall, down to the shoulder
        (10.65, 1.4),                       # ...up to just proud of the rim
        (10.35, 2.0),                       # rolled top edge
        (9.20, 2.5),
        (4.60, 3.1),                        # shoulder in to the stem
        (3.20, 4.2),
        (3.20, 9.0),                        # stem stub = the ferrule's socket
        (2.10, 9.4),                        # stub crown
        (2.10, 8.6),                        # ---- inner return ----
        (2.30, 4.6),
        (bore_r, 3.0),
        (bore_r, -skirt),                   # inner sleeve down the finish
    ]
    return dict(spec=dict(asset_id=f"BB_ANSP_COLLAR_{finish.replace('-','')}",
                          od=21.3, barrel_h=skirt + 2.0, top=9.4),
                profile=prof, modulate=None)


def ansp_bulb_builder(rig, finish, variant):
    import bmesh
    from mathutils import Matrix
    me = bpy.data.meshes.new("ansp_bulb")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=20.0)
    bmesh.ops.scale(bm, verts=bm.verts, vec=(1.34, 1.0, 1.0))
    bm.to_mesh(me); bm.free()
    me.transform(Matrix.Rotation(-0.52, 4, "Y"))
    me.transform(Matrix.Translation((-35.0, 0.0, 26.0)))
    obj = bpy.data.objects.new("ansp_bulb", me)
    bpy.context.scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth()
    return dict(spec=dict(asset_id=f"BB_ANSP_BULB_{finish.replace('-','')}",
                          egg=(53.6, 40.0), centre=(-35, 0, 26)), object=obj)


def ansp_ferrule_builder(rig, finish, variant):
    """Chrome cone joining the bulb to the stem side."""
    import bmesh
    from mathutils import Matrix
    me = bpy.data.meshes.new("ansp_ferrule")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=32,
                          radius1=6.0, radius2=2.4, depth=13.0)
    bm.to_mesh(me); bm.free()
    me.transform(Matrix.Rotation(1.5708, 4, "Y"))          # axis -> +X
    me.transform(Matrix.Translation((-11.0, 0.0, 26.5)))
    obj = bpy.data.objects.new("ansp_ferrule", me)
    bpy.context.scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth()
    return dict(spec=dict(asset_id=f"BB_ANSP_FERRULE_{finish.replace('-','')}"),
                object=obj)


def ansp_tassel_builder(rig, finish, variant):
    """Cord + crown + fringe hanging from the bulb's far tip."""
    import bmesh
    from mathutils import Matrix
    me = bpy.data.meshes.new("ansp_tassel")
    acc = bmesh.new()
    def add(prim):
        tmp = bmesh.new(); prim(tmp)
        m2 = bpy.data.meshes.new("t"); tmp.to_mesh(m2); tmp.free()
        acc.from_mesh(m2); bpy.data.meshes.remove(m2)
    # cord
    def cord(bm):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=12,
                              radius1=0.8, radius2=0.8, depth=14.0)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(-57.0, 0.0, 30.0))
    add(cord)
    # crown ball
    def crown(bm):
        bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=14, radius=4.0)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(-57.0, 0.0, 21.5))
    add(crown)
    # fringe (tapered skirt)
    def fringe(bm):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=28,
                              radius1=4.6, radius2=3.4, depth=26.0)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(-57.0, 0.0, 4.5))
    add(fringe)
    acc.to_mesh(me); acc.free()
    obj = bpy.data.objects.new("ansp_tassel", me)
    bpy.context.scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth()
    return dict(spec=dict(asset_id=f"BB_ANSP_TASSEL_{finish.replace('-','')}"),
                object=obj)


# ------------------------------------------------------- dropper (18-415)
# Measured 2026-08-31 from Drp18-415Sl.psd at 33.7 px/mm (collar = O21.3):
# white rubber bulb O9.8 x 18.3 above the collar, chrome barrel O21.3
# (finish + 2.0 proud), glass pipette O6.7 descending ~52 with a taper
# and the classic balled tip. All revolves.

def drp_collar_builder(rig, finish, variant):
    fm = rig.FINISH_MASTERS[finish]
    skirt = fm["finish_h"] - 0.45
    prof = [
        (10.65, -skirt), (10.65, 1.6),          # barrel
        (10.2, 2.1), (5.6, 2.1),                # FLAT top face (a stepped
        (5.2, 1.7),                              # top caught the softbox as
        (fm["bore_d"] / 2.0 - 0.2, 1.5),         # a weird hotspot - Jordan)
        (fm["bore_d"] / 2.0 - 0.2, -skirt),
    ]
    return dict(spec=dict(asset_id=f"BB_DRP_COLLAR_{finish.replace('-','')}",
                          od=21.3, proud=2.0), profile=prof, modulate=None)


def drp_bulb_builder(rig, finish, variant):
    import math as _m
    prof = [(3.4, 2.0), (4.9, 2.6), (4.9, 14.0)]
    for i in range(1, 9):                       # rounded top
        a = _m.pi / 2 * i / 8
        prof.append((4.9 * _m.cos(a), 14.0 + 6.3 * _m.sin(a)))
    return dict(spec=dict(asset_id=f"BB_DRP_BULB_{finish.replace('-','')}",
                          od=9.8, top=20.3), profile=prof, modulate=None)


def drp_pipette_builder(rig, finish, variant):
    """HOLLOW glass tube — outer wall AND inner bore modelled, because
    glass-in-glass reads by its DOUBLE edge lines (Jordan: the solid rod
    'looks like some weird plastic pipe'). The bore's silhouette gives the
    second line pair for free in any shading mode."""
    prof = [
        # outer wall down
        (3.35, 1.0), (3.35, -44.0),
        (1.6, -49.0), (1.6, -50.0),
        (2.15, -50.8), (2.15, -52.2),            # balled tip
        (0.9, -53.0), (0.35, -53.15),
        # tip orifice up the BORE
        (0.35, -52.6), (0.9, -52.0),
        (1.05, -50.0), (1.05, -49.0),
        (2.1, -44.5),                             # bore widens after taper
        (2.1, 0.6), (3.35, 1.0),                  # bore wall up to the top
    ]
    return dict(spec=dict(asset_id=f"BB_DRP_PIPETTE_{finish.replace('-','')}",
                          od=6.7, bore=4.2, tip=-53.15),
                profile=prof, modulate=None)


def cap_part_builder(rig, finish, variant):
    cs, profile, modulate = cap_builder(rig, finish, variant)
    return dict(spec=cs, profile=profile, modulate=modulate)


# (finish, part, variant) -> builder.  `part` names the MESH; `variant` is a
# distinct moulding of that part, never a colour.
PARTS = {
    ("17-415", "ROLL_HOUSING", "plastic"): roller_housing_builder,
    ("17-415", "ROLL_HOUSING", "steel"):   roller_housing_builder,
    ("17-415", "ROLL_BALL", "plastic"):    roller_ball_builder,
    ("17-415", "ROLL_BALL", "steel"):      roller_ball_builder,
    ("17-415", "PMP_BODY", None):          pump_body_builder,
    ("18-415", "PMP_BODY", None):          pump_body_builder,
    ("17-415", "DIP_TUBE", None):          dip_tube_builder,
    ("18-415", "DIP_TUBE", None):          dip_tube_builder,
    ("17-415", "SPR_COLLAR", None):        collar_builder,
    ("17-415", "SPR_ACTUATOR", None):      actuator_builder,
    ("17-415", "SPR_OVERCAP", None):       overcap_builder,
    ("17-415", "PMP_SPOUT", None):         pump_spout_builder,
    ("17-415", "SPR_INSERT", None):        spr_insert_builder,
    ("17-415", "CAP_DOTS", None):          cap_dots_builder,
    ("17-415", "CAP", None):               cap_part_builder,
    ("13-415", "CAP", None):               cap_part_builder,
    ("18-415", "SPR_NOZZLE", None):        nozzle_insert_builder,
    ("18-415", "DRP_COLLAR", None):        drp_collar_builder,
    ("18-415", "DRP_BULB", None):          drp_bulb_builder,
    ("18-415", "DRP_PIPETTE", None):       drp_pipette_builder,
    ("18-415", "ANSP_COLLAR", None):       ansp_collar_builder,
    ("18-415", "ANSP_BULB", None):         ansp_bulb_builder,
    ("18-415", "ANSP_FERRULE", None):      ansp_ferrule_builder,
    ("18-415", "ANSP_TASSEL", None):       ansp_tassel_builder,
    ("18-415", "SPR_COLLAR", None):        collar_builder,
    ("18-415", "SPR_ACTUATOR", None):      actuator_builder,
    ("18-415", "SPR_OVERCAP", None):       overcap_builder,
    ("18-415", "PMP_SPOUT", None):         pump_spout_builder,
    ("18-415", "REDUCER", None):           reducer_builder,
    ("18-415", "CAP", None):               cap_part_builder,
    ("18-415", "CAP", "tall"):             cap_part_builder,
    ("18-415", "CAP", "leather"):          leather_cap_builder,
}

# Assembly = an ordered stack of parts, bottom first. The order is what an
# exploded view animates along; it is NOT a rendering hint.
ASSEMBLIES = {
    ("17-415", "roller-plastic"): ["ROLL_HOUSING@plastic", "ROLL_BALL@plastic"],
    ("17-415", "roller-steel"):   ["ROLL_HOUSING@steel", "ROLL_BALL@steel"],
    # The base sprayer and pump have NO overcap. Spry17-415Blk photographs
    # without one, and the SKU vocabulary carries it separately (*LtnClOvrCap
    # = lotion + clear overcap, only ~16 SKUs). Bundling it into every stack
    # made the assembled render 21.85 mm taller than the product.
    ("17-415", "sprayer"):        ["SPR_COLLAR", "SPR_ACTUATOR"],
    ("17-415", "lotion-pump"):    ["SPR_COLLAR", "SPR_ACTUATOR", "PMP_SPOUT"],
    ("17-415", "sprayer-overcap"):     ["SPR_COLLAR", "SPR_ACTUATOR", "SPR_OVERCAP"],
    ("17-415", "lotion-pump-overcap"): ["SPR_COLLAR", "SPR_ACTUATOR", "PMP_SPOUT",
                                        "SPR_OVERCAP"],
    ("17-415", "cap"):            ["CAP"],
    ("17-415", "cap-dot"):        ["CAP", "CAP_DOTS"],
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

    if "object" in rec:
        obj = rec["object"]
        obj.name = name
        obj.data.name = name
    elif "sphere" in rec:
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
