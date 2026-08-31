"""
Paper Doll 3D — 17-415 component library (9 mL cylinder family).

Every 17-415 closure/fitment the catalog sells on the 9 mL cylinder
(fitment sheet "17-415_Roller": roller plug plastic, roller plug metal,
roll-on cap, spray top, lotion pump), authored as SEPARATE objects whose
origin is their own mating face, so seating is parent-and-zero on the neck
datum (BB_ATTACH_NECK, z = rim). The cap itself lives in build-master-scene
(CAPS_BY_FINISH); this module owns the rollers, the sprayer, the lotion pump,
and the overcap they share.

SOURCE OF TRUTH — and its limits
    No Nemat closure drawings exist (DRAWING-COVERAGE request list; 34 of the
    36 foundation blockers). Every dimension here is PHOTO-SOLVED from the
    product-photography PSDs in Best-Bottles-Original-Photoshop-Sources/
    "17-415 Bottles/1. Cobalt Blue 9ml (Uncapped)", where each closure sits
    on its own layer (alpha authoritative). Scale = the bottle body Ø19.7 mm
    (drawing GBCyl10mlAmber.pdf) measured at mid-height: 11.624 px/mm,
    validated independently against the 27 ±0.5 × Ø19 ±0.5 mm cap listing
    (measured 27.44 × Ø19.01). z = 0 is the neck rim (top of the bottle's
    alpha, which is the back edge of the mouth ellipse: ±0.6 mm datum
    uncertainty — the plastic housing flange reads −0.6, the metal −0.5).
    Status of every value: `provisional` until a Nemat drawing or a sample
    caliper arrives. Cross-checks against the catalog listings are printed
    by component_audit().

    Measurement script + overlays: session scratch components-9ml/
    (measurements.json, 03-profile-overlays.png). Re-derive, never eyeball.

Assembly truth (measured):
    sprayer / pump collar   Ø19.5, skirt −13.3 .. top face +3.0 (17-415 finish
                            is 13.76 tall: skirt stops 0.45 above the datum)
    actuator head           skirt Ø15.6 (+3.0..+9.2) → shoulder → body
                            Ø13.75→13.3 (+10..+20.5) → rounded top +21.85
    pump spout nub          Ø4.5 on the front face, centred +18.2
    overcap (both)          Ø16.94→16.5 × 21.85, seats on the collar top
                            face: top at +24.85 → 72 + 24.85 = 96.85 mm,
                            the catalog's "96 ±1 mm with cap" assembled height
    plastic roller housing  flange Ø12.9 × 1.0, barrel Ø11.85, ball Ø9.5
                            centred +5.6, crown +10.9
    metal roller housing    = ROLLER_17415 in build-master-scene (flange
                            Ø13.35, barrel 11.3–11.5, ball Ø9.5 at +5.2,
                            crown +10.5) — re-measured 2026-08-22 to ±0.1 mm
    internals               the product photos show EMPTY glass under the
                            sprayer/pump (clear-bottle PSD); a dip tube and
                            pump chamber are therefore OPTIONAL (`internals`)
                            and off by default — modelling them is invention.
"""
from __future__ import annotations

import math

import bpy

# --------------------------------------------------------------- records

PROVENANCE = dict(
    source="photo-solved",
    source_files=("17-415 Bottles/1. Cobalt Blue 9ml (Uncapped)/"
                  "{23. GBCylBlu9SpryBlk, 29. LBCylBlu9LtnBlk, "
                  "11. GBCylBlu9RollMattSl, 1. GBCylBlu9MtlRollMattSl}.psd"),
    px_per_mm=11.624,
    scale_reference="bottle body Ø19.7 (GBCyl10mlAmber.pdf)",
    scale_validation="cap 27.44 × Ø19.01 vs listing 27 ±0.5 × Ø19 ±0.5",
    datum_uncertainty_mm=0.6,
    status="provisional",
    measured_on="2026-08-22",
)

# Plastic-ball roller housing (natural PP, milky). The metal-ball housing is
# ROLLER_17415 in build-master-scene.py (flange 13.35 / barrel 11.5 / ball
# at 5.2) — those numbers were measured off the steel-ball photograph and
# re-measure to within 0.1 mm, so they are left as the metal record.
ROLLER_PLASTIC_17415 = dict(
    asset_id="BB_ROLL_17415_PLASTIC_001",
    ball_d=9.5, ball_z=5.6,
    barrel_od=11.85, barrel_top=7.4,
    collar_od=12.9, collar_h=1.0,
    plug_depth=6.0, plug_clear=0.10,
    wall=1.0, rim_r=0.45, fold_h=1.4,
)

# Threaded closure collar shared by the sprayer and the lotion pump.
COLLAR_17415 = dict(
    asset_id="BB_SPR_COLLAR_17415_001",
    od=19.5,
    skirt_below_rim=13.3,        # finish is 13.76: stops 0.45 above the datum
    top_face_z=3.0,              # overcap seating plane
    top_edge_r=0.55,
    stem_hole_d=6.4,
    liner_h=0.8,                 # gasket/liner between rim and ceiling
    wall_at_top=1.6,
    thread_root_d=16.90, thread_crest_d=15.10,   # engages T 16.3 / clears E 14.8
)

# Actuator head — one moulding for both; the pump adds the spout nub.
ACTUATOR_17415 = dict(
    asset_id="BB_SPR_HEAD_17415_001",
    stem_d=6.0, stem_bottom_z=-2.0,
    skirt_od=15.6, skirt_bottom_z=3.0, skirt_top_z=9.2, skirt_edge_r=0.4,
    shoulder_top_z=10.0, body_od_low=13.75,
    body_top_z=20.5, body_od_high=13.3,
    top_z=21.85, top_edge_r=1.0,
    wall=1.0, cavity_top_z=19.4,
    orifice_z=18.6,
    spray_insert_d=3.6, spray_insert_depth=0.3, spray_hole_d=0.4,
    pump_spout_d=4.5, pump_spout_proud=1.2, pump_spout_z=18.2, pump_hole_d=1.6,
)

OVERCAP_17415 = dict(
    asset_id="BB_SPR_OVERCAP_17415_001",
    od_bottom=16.94, od_top=16.50, height=21.85,
    wall=0.55, top_edge_r=1.2, bottom_edge_r=0.3,
)

INTERNALS_17415 = dict(            # optional — see module docstring
    asset_id="BB_SPR_INTERNALS_17415_001",
    chamber_od=8.0, chamber_top_z=-1.0, chamber_bottom_z=-20.0,
    tube_od=2.6, tube_clearance_above_floor=1.5,
)

# Collar / head colourways. PSD finish codes: Gl (shiny gold), MattSl,
# Blk, ShnSl, Red, Tur (turquoise); lotion pump ships in MattSl / Gl / Blk.
CLOSURE_FINISHES = {                 # (base colour, roughness, metallic)
    "black":        ((0.016, 0.016, 0.017), 0.10, 0.0),
    "matte-silver": ((0.700, 0.702, 0.710), 0.46, 0.0),
    "shiny-silver": ((0.780, 0.785, 0.790), 0.14, 1.0),
    "gold":         ((0.830, 0.660, 0.330), 0.18, 1.0),
    "red":          ((0.520, 0.035, 0.040), 0.14, 0.0),
    "turquoise":    ((0.040, 0.420, 0.450), 0.16, 0.0),
}
SPRAYER_FINISHES = sorted(CLOSURE_FINISHES)
PUMP_FINISHES = ["black", "gold", "matte-silver"]

CLOSURE_KINDS = ("sprayer", "pump")


# --------------------------------------------------------------- profiles
# All profiles are closed (r, z) outlines for build-master-scene.revolve():
# outer surface first, then back down the inside. z = 0 at the neck rim.

def _arc(bm, cx, cz, r, a0, a1, steps=None):
    return bm.arc(cx, cz, r, a0, a1, steps) if steps else bm.arc(cx, cz, r, a0, a1)


def collar_profile(bm, cs):
    ro = cs["od"] / 2.0
    z_lo = -cs["skirt_below_rim"]
    z_top = cs["top_face_z"]
    er = cs["top_edge_r"]
    ri = cs["thread_root_d"] / 2.0
    r_hole = cs["stem_hole_d"] / 2.0
    z_ceiling = cs["liner_h"]                      # liner sits rim..liner_h
    p = [(ro - 0.35, z_lo)]
    p += _arc(bm, ro - 0.35, z_lo + 0.35, 0.35, 270, 360, 4)
    p.append((ro, z_top - er))
    p += _arc(bm, ro - er, z_top - er, er, 0, 90)   # rounded top edge
    p.append((r_hole + 0.3, z_top))                # top face (annulus)
    p += _arc(bm, r_hole + 0.3, z_top - 0.3, 0.3, 90, 180, 4)
    p.append((r_hole, z_ceiling + 0.6))            # stem hole wall
    p.append((r_hole + 1.2, z_ceiling + 0.6))      # inner boss under the top
    p.append((r_hole + 1.2, z_ceiling))
    p.append((ri, z_ceiling))                      # ceiling over the liner
    z = z_ceiling
    while z > z_lo + 0.12:                         # threaded bore, dense
        p.append((ri, z))
        z -= 0.10
    p.append((ri, z_lo))
    p.append((ro - 0.35, z_lo))
    return _dedupe(p)


def collar_thread_modulator(bm, cs, bottle):
    """Same internal helix as the cap (cap_thread_modulator): the bottle's
    exact chain, swelling inward, half a period out of phase so a seated
    closure nests in the root land."""
    return bm.cap_thread_modulator(cs, bottle)


def actuator_profile(hs):
    """Outer: stem → skirt → shoulder → body → rounded top; inner: cup
    cavity from the skirt bottom up to cavity_top_z, wall thick, around the
    stem boss."""
    r_stem = hs["stem_d"] / 2.0
    r_sk = hs["skirt_od"] / 2.0
    r_lo = hs["body_od_low"] / 2.0
    r_hi = hs["body_od_high"] / 2.0
    er = hs["top_edge_r"]
    ser = hs["skirt_edge_r"]
    w = hs["wall"]
    z_sb, z_st = hs["skirt_bottom_z"], hs["skirt_top_z"]
    p = [(r_stem, hs["stem_bottom_z"])]
    p.append((r_stem, z_sb))                          # stem up to the skirt
    p.append((r_sk - ser, z_sb))                      # skirt bottom face
    p += [(r_sk - ser + ser * math.sin(math.radians(a)),
           z_sb + ser - ser * math.cos(math.radians(a))) for a in (30, 60, 90)]
    p.append((r_sk, z_st - 0.25))                     # skirt wall
    p.append((r_sk - 0.25, z_st))                     # small break edge
    # shoulder: skirt OD → body OD over shoulder_top_z - skirt_top_z
    z_sh = hs["shoulder_top_z"]
    for i in range(1, 5):
        t = i / 4.0
        p.append((r_sk - 0.25 + (r_lo - (r_sk - 0.25)) * (0.5 - 0.5 * math.cos(math.pi * t)),
                  z_st + (z_sh - z_st) * t))
    p.append((r_hi, hs["body_top_z"]))                # gentle body taper
    z_top = hs["top_z"]
    p.append((r_hi, z_top - er))
    for a in (15, 30, 45, 60, 75, 90):                # rounded top edge
        p.append((r_hi - er + er * math.cos(math.radians(a)),
                  z_top - er + er * math.sin(math.radians(a))))
    p.append((0.0, z_top))                            # crown (flat)
    # inside: down the cavity
    z_cav = hs["cavity_top_z"]
    p.append((0.0, z_cav))
    p.append((r_hi - w, z_cav))
    p.append((r_lo - w, z_sh))
    p.append((r_sk - w, z_st))
    p.append((r_sk - w, z_sb + 0.3))
    p.append((r_stem + 1.0, z_sb + 0.3))              # stem boss shoulder
    p.append((r_stem + 1.0, z_sb + 3.0))
    p.append((r_stem, z_sb + 3.0))
    p.append((r_stem, hs["stem_bottom_z"]))
    return _dedupe(p)


def overcap_profile(oc):
    rb, rt = oc["od_bottom"] / 2.0, oc["od_top"] / 2.0
    h, w, er, ber = oc["height"], oc["wall"], oc["top_edge_r"], oc["bottom_edge_r"]
    p = [(rb - w, 0.0), (rb - ber, 0.0)]
    p += [(rb - ber + ber * math.sin(math.radians(a)), ber - ber * math.cos(math.radians(a)))
          for a in (45, 90)]
    p.append((rt, h - er))
    for a in (15, 30, 45, 60, 75, 90):
        p.append((rt - er + er * math.cos(math.radians(a)), h - er + er * math.sin(math.radians(a))))
    p.append((0.0, h))
    p.append((0.0, h - w))
    p.append((rt - w - er * 0.4, h - w))
    p.append((rb - w, 0.6))
    p.append((rb - w, 0.0))
    return _dedupe(p)


def internals_profile(ins, bottle_floor_z):
    """Pump chamber + dip tube as one revolve (hollow tube not modelled —
    clear PE reads as a rod at product scale)."""
    rc, rt = ins["chamber_od"] / 2.0, ins["tube_od"] / 2.0
    z_end = bottle_floor_z + ins["tube_clearance_above_floor"]
    p = [(0.0, ins["chamber_top_z"]), (rc, ins["chamber_top_z"]),
         (rc, ins["chamber_bottom_z"] + 0.8), (rt, ins["chamber_bottom_z"]),
         (rt, z_end + 0.6), (rt * 0.6, z_end), (0.0, z_end)]
    return _dedupe(p)


def _dedupe(p):
    out = [p[0]]
    for q in p[1:]:
        if abs(q[0] - out[-1][0]) > 1e-4 or abs(q[1] - out[-1][1]) > 1e-4:
            out.append(q)
    return out


# --------------------------------------------------------------- materials

def mat_closure(bm, finish):
    col, rough, metal = CLOSURE_FINISHES[finish]
    m = bm.mat_plastic(f"BB_MAT_CLOSURE_{finish.upper().replace('-', '_')}", col, rough)
    m.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = metal
    return m


def mat_actuator_white(bm):
    return bm.mat_plastic("BB_MAT_ACTUATOR_WHITE", (0.86, 0.86, 0.85), 0.26)


def mat_orifice_dark(bm):
    return bm.mat_plastic("BB_MAT_ORIFICE_DARK", (0.03, 0.03, 0.03), 0.5)


def mat_overcap(bm):
    return bm.mat_natural_plastic("BB_MAT_OVERCAP_NATURAL", (0.93, 0.93, 0.91), 0.34, 0.62)


def mat_internals(bm):
    m = bm.mat_natural_plastic("BB_MAT_INTERNALS_PE", (0.96, 0.96, 0.95), 0.12, 0.85)
    return m


def mat_housing_clear(bm):
    """Metal-ball housing: the photograph shows a clear PP housing with the
    steel ball visible through it."""
    return bm.mat_natural_plastic("BB_MAT_ROLLER_CLEAR", (0.95, 0.95, 0.94), 0.16, 0.78)


# --------------------------------------------------------------- builders

def _tag(obj, rec, **extra):
    for k, v in rec.items():
        if isinstance(v, (int, float, str, bool)):
            obj[k] = v
    for k, v in PROVENANCE.items():
        if isinstance(v, (int, float, str, bool)):
            obj["prov_" + k] = v
    for k, v in extra.items():
        obj[k] = v
    return obj


def _cyl(bm, name, d, h, segments=48):
    """Small solid cylinder along +Z, base at z 0 — orifice insert / spout."""
    r = d / 2.0
    prof = [(0.0, 0.0), (r, 0.0), (r, h), (0.0, h)]
    return bm.revolve(name, prof, segments=segments)


def fit_roller(bm, s, neck, coll, ball_mode):
    """Roller housing + ball. plastic → ROLLER_PLASTIC_17415 (natural PP,
    natural ball); steel → build-master-scene.ROLLER_17415 (clear housing,
    steel ball)."""
    rs = ROLLER_PLASTIC_17415 if ball_mode == "plastic" else bm.ROLLER_17415
    housing = bm.revolve(rs["asset_id"], bm.roller_profile(rs, s["bore_d"] / 2.0))
    housing.data.materials.append(
        bm.mat_natural_plastic("BB_MAT_ROLLER_NATURAL", (0.93, 0.92, 0.87), 0.40, 0.58)
        if ball_mode == "plastic" else mat_housing_clear(bm))
    housing.parent = neck
    housing.location = (0, 0, 0)
    _tag(housing, rs, neck_finish=s["neck_finish"], web_name="roller_housing",
         component="roller_housing", variant=ball_mode)
    bm.link(housing, coll)

    ball = bm.uv_sphere(f"BB_ROLL_BALL_17415_{ball_mode.upper()}", rs["ball_d"])
    ball.data.materials.append(
        bm.mat_steel() if ball_mode == "steel" else
        bm.mat_natural_plastic("BB_MAT_BALL_NATURAL", (0.94, 0.93, 0.89), 0.45, 0.55))
    ball.parent = neck
    ball.location = (0, 0, rs["ball_z"])
    ball["asset_id"] = f"BB_ROLL_BALL_17415_{ball_mode.upper()}"
    ball["ball_d"] = rs["ball_d"]
    ball["web_name"] = "roller_ball"
    ball["component"] = "roller_ball"
    bm.link(ball, coll)
    return housing, ball


def fit_closure(bm, s, neck, coll, kind, finish="black", overcap=True,
                internals=False):
    """Sprayer or lotion pump: collar + actuator (+ spout) (+ overcap)
    (+ optional internals). Returns the dict of objects."""
    assert kind in CLOSURE_KINDS, kind
    if kind == "pump" and finish not in PUMP_FINISHES:
        print(f"note: lotion pump is not listed in {finish}; rendering it anyway")
    objs = {}
    cs = dict(COLLAR_17415)
    collar = bm.revolve(cs["asset_id"], collar_profile(bm, cs),
                        modulate=collar_thread_modulator(bm, cs, s))
    collar.data.materials.append(mat_closure(bm, finish))
    collar.parent = neck
    collar.location = (0, 0, 0)                     # origin IS the rim datum
    _tag(collar, cs, neck_finish=s["neck_finish"], finish=finish,
         web_name=f"{kind}_collar", component=f"{kind}_collar")
    bm.link(collar, coll)
    objs["collar"] = collar

    # attach datum on the collar's top face — the overcap's mating plane
    top = bpy.data.objects.new("BB_ATTACH_COLLAR_TOP", None)
    top.empty_display_type = "ARROWS"
    top.empty_display_size = 4
    top.parent = collar
    top.location = (0, 0, cs["top_face_z"])
    bm.link(top, coll)
    objs["collar_top"] = top

    hs = dict(ACTUATOR_17415)
    head = bm.revolve(hs["asset_id"], actuator_profile(hs))
    head.data.materials.append(mat_actuator_white(bm))
    head.parent = neck
    head.location = (0, 0, 0)                       # stem seats through the collar
    _tag(head, hs, neck_finish=s["neck_finish"], web_name=f"{kind}_head",
         component=f"{kind}_head")
    bm.link(head, coll)
    objs["head"] = head

    # front-face feature (camera looks along +Y from −Y): the insert/spout
    # axis is −Y. Built as a small cylinder parented to the head.
    r_face = hs["body_od_high"] / 2.0 + (hs["body_od_low"] - hs["body_od_high"]) / 2.0 * 0.25
    if kind == "sprayer":
        # The photo shows a RECESSED insert ring flush with the face, not a
        # nub: the insert face sits spray_insert_depth inside the body
        # surface (a dark ring gap reads at the edge), the pin-hole deeper.
        ins = _cyl(bm, "BB_SPR_ORIFICE_INSERT_17415", hs["spray_insert_d"], 1.2)
        ins.data.materials.append(mat_actuator_white(bm))
        ins.parent = head
        ins.rotation_euler = (math.radians(90), 0, 0)          # +Z → −Y
        ins.location = (0, -(r_face - 1.2 - hs["spray_insert_depth"]), hs["orifice_z"])
        ring = _cyl(bm, "BB_SPR_ORIFICE_RING_17415", hs["spray_insert_d"] + 0.5, 0.25)
        ring.data.materials.append(mat_orifice_dark(bm))
        ring.parent = head
        ring.rotation_euler = (math.radians(90), 0, 0)
        ring.location = (0, -(r_face - 0.25 - hs["spray_insert_depth"] - 0.35), hs["orifice_z"])
        hole = _cyl(bm, "BB_SPR_ORIFICE_HOLE_17415", hs["spray_hole_d"] + 0.3, 0.3)
        hole.data.materials.append(mat_orifice_dark(bm))
        hole.parent = head
        hole.rotation_euler = (math.radians(90), 0, 0)
        hole.location = (0, -(r_face - 0.3 - hs["spray_insert_depth"] + 0.05), hs["orifice_z"])
        ring["web_name"] = "sprayer_orifice"
        bm.link(ring, coll)
        for o in (ins, hole):
            o["web_name"] = "sprayer_orifice"
            bm.link(o, coll)
        objs["orifice"] = ins
    else:
        spout = _cyl(bm, "BB_PMP_SPOUT_17415", hs["pump_spout_d"], hs["pump_spout_proud"] + 1.0)
        spout.data.materials.append(mat_actuator_white(bm))
        spout.parent = head
        spout.rotation_euler = (math.radians(90), 0, 0)
        spout.location = (0, -(r_face - 1.0), hs["pump_spout_z"])
        hole = _cyl(bm, "BB_PMP_SPOUT_HOLE_17415", hs["pump_hole_d"], 0.3)
        hole.data.materials.append(mat_orifice_dark(bm))
        hole.parent = head
        hole.rotation_euler = (math.radians(90), 0, 0)
        hole.location = (0, -(r_face + hs["pump_spout_proud"] + 0.02), hs["pump_spout_z"])
        for o in (spout, hole):
            o["web_name"] = "pump_spout"
            bm.link(o, coll)
        objs["spout"] = spout

    if overcap:
        oc = dict(OVERCAP_17415)
        cap = bm.revolve(oc["asset_id"], overcap_profile(oc))
        cap.data.materials.append(mat_overcap(bm))
        cap.parent = top                            # parent-and-zero on the collar top
        cap.location = (0, 0, 0)
        _tag(cap, oc, neck_finish=s["neck_finish"], web_name="overcap",
             component="overcap")
        bm.link(cap, coll)
        objs["overcap"] = cap

    if internals:
        ins_rec = dict(INTERNALS_17415)
        floor_z = -(s["height"] - s["base_th"])     # bottle inner floor, rim frame
        inner = bm.revolve(ins_rec["asset_id"], internals_profile(ins_rec, floor_z),
                           segments=96)
        inner.data.materials.append(mat_internals(bm))
        inner.parent = neck
        inner.location = (0, 0, 0)
        _tag(inner, ins_rec, neck_finish=s["neck_finish"], web_name="internals",
             component="internals", note="OPTIONAL: photos show empty glass")
        bm.link(inner, coll)
        objs["internals"] = inner
    return objs


# --------------------------------------------------------------- audit

def _bounds_local(obj):
    """Bounding box in the NECK frame (z relative to the rim) using the
    object's evaluated mesh and its parent chain up to the neck empty."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(depsgraph)
    mw = ev.matrix_world
    zs, rs = [], []
    for v in ev.data.vertices:
        w = mw @ v.co
        zs.append(w.z); rs.append(math.hypot(w.x, w.y))
    return min(zs), max(zs), max(rs) * 2.0


def component_audit(objs, neck, kind, catalog=None):
    """Print COMPONENT_AUDIT lines: built envelope vs the photo-solved record
    and vs the catalog listing (heightWithCap × diameter)."""
    rim_z = neck.matrix_world.translation.z
    rows = []
    for name, o in objs.items():
        if o.type != "MESH":
            continue
        z0, z1, d = _bounds_local(o)
        rows.append((name, z0 - rim_z, z1 - rim_z, d))
        print(f"COMPONENT_AUDIT {kind}/{name}: z {z0 - rim_z:+7.2f} .. {z1 - rim_z:+6.2f} mm  Ø {d:5.2f} mm")
    if rows:
        zlo = min(r[1] for r in rows); zhi = max(r[2] for r in rows); dmax = max(r[3] for r in rows)
        print(f"COMPONENT_AUDIT {kind}/ASSEMBLY: {zlo:+.2f} .. {zhi:+.2f} above rim  "
              f"(overall {zhi - zlo:.2f} mm, Ø {dmax:.2f})")
        if catalog:
            print(f"COMPONENT_AUDIT {kind}/CATALOG: listing {catalog}")
    return rows


# ---------------------------------------------------------------- 18-415 set
# MEASURED 2026-08-31 from "20. Closures .../7. 18-415 Sprayers/
# 13. Spry18-415ShnBlk.psd" (content 214x391 px, scaled by the collar OD
# 21.3): total 39.0, collar hood 65% (~25.4, rising ~10 above the rim),
# two-tier head 35% (~13.7, O14.5). The 18-415 sprayer is a TALL-HOOD
# design against the 17-415's short band. Thread engagement from
# FINISH_MASTERS["18-415"]: T 17.5 / E 15.5, finish 15.8.
COLLAR_18415 = dict(
    asset_id="BB_SPR_COLLAR_18415_001",
    od=21.3,
    skirt_below_rim=15.35,       # finish is 15.8: stops 0.45 above the datum
    top_face_z=10.0,             # tall hood; overcap seating plane
    top_edge_r=0.6,
    stem_hole_d=6.4,
    liner_h=0.8,
    wall_at_top=1.7,
    thread_root_d=18.10, thread_crest_d=15.80,   # engages T 17.5 / clears E 15.5
)

# CORRECTED 2026-08-31 (Jordan: "the spray pump you have on these is
# wrong"): Spry18-415ShnBlk + Ltn18-415ShnBlk show the 18-415 head is a
# PLAIN STRAIGHT CYLINDER in the trim colour — no white two-tier head,
# no dome. O14.5 flat-top column over the O21.3 collar; the only non-trim
# element is the small white nozzle/spout insert on the face.
ACTUATOR_18415 = dict(
    asset_id="BB_SPR_HEAD_18415_002",
    stem_d=6.0, stem_bottom_z=-2.0,
    skirt_od=14.5, skirt_bottom_z=10.0, skirt_top_z=10.5, skirt_edge_r=0.2,
    shoulder_top_z=10.7, body_od_low=14.5,
    body_top_z=22.9, body_od_high=14.5,
    top_z=23.7, top_edge_r=0.8,
    wall=1.0, cavity_top_z=21.4,
    orifice_z=21.3,
    spray_insert_d=2.6, spray_insert_depth=0.3, spray_hole_d=0.5,
    pump_spout_d=3.6, pump_spout_proud=0.6, pump_spout_z=21.3, pump_hole_d=1.4,
)

OVERCAP_18415 = dict(
    asset_id="BB_SPR_OVERCAP_18415_001",
    od_bottom=18.6, od_top=18.1, height=15.2,
    wall=0.55, top_edge_r=1.2, bottom_edge_r=0.3,
)
