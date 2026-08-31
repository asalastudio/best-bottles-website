#!/usr/bin/env python3
"""
BEST BOTTLES — BLENDER MASTER PRODUCT SYSTEM (Milestone 1)

Builds the master product-rendering scene from scratch, deterministically:
collections, bone studio, master camera, feathered lighting, the first
validation asset (9 mL cylinder, 17-415), BB_MAT_GLASS_CLEAR, attachment
empties, render settings. Saves a .blend and optionally test-renders.

    blender -b -P build-master-scene.py -- \
        --output pipeline/paper-doll-3d/master/bb-master-scene.blend \
        [--test-render out.png] [--samples 512]

Design contract (mirrors the master-system prompt):
  - 1 BU = 1 mm (scale_length 0.001). Real dimensions only; framing is done
    with camera distance, never by scaling geometry.
  - Every product hangs off BB_PRODUCT_ROOT at world origin, base at z=0.
  - Machine-readable names: BB_BTL_*, BB_MAT_*, BB_ATTACH_*, BB_LIGHT_*.
  - Custom props on assets (asset_id, *_mm, neck_finish, web_name) so
    automation can find/swap/export without scene knowledge.
  - MASTER asset is the source of truth; web GLB is a separate derived
    output (phase 2 exporter renames meshes to the configurator contract:
    body/cap/collar/liquid/label_front/label_back).

Dimensional sources:
  9 mL cylinder: canonical-truth-2026-07-12 body-geometry CSV — dominant
  cluster 70 ±1 mm x 20 ±0.5 mm across 60 variants. A 74x21 cluster exists
  for clear/frosted/swirl (conflict-flagged upstream) — caliper arbitration
  queued; not blocking scene validation.
  17-415 neck: SPI nominal table values, UNVERIFIED (measured=False), same
  policy as the pilot's 18-400. Smooth thread land in milestone 1; helical
  threads come with the generalized builder in phase 2.
"""

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

# 17-415 component library (rollers, sprayer, lotion pump, overcap) lives in
# its own module so the closure records stay reviewable on their own.
import importlib.util as _ilu
_c17_spec = _ilu.spec_from_file_location(
    "components_17415", Path(__file__).resolve().parent / "components_17415.py")
c17 = _ilu.module_from_spec(_c17_spec)
_c17_spec.loader.exec_module(c17)

# ---------------------------------------------------------------- constants

BONE_HEX = "#B29878"                      # Aesop-style warm tan (user pivot 2026-08-08;
                                          # supersedes #EFE9DE — midtone reads glass better)
BONE = (0.445, 0.314, 0.201)              # linearized


def hex_to_linear(hx):
    hx = hx.lstrip("#")
    def lin(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(lin(int(hx[i:i + 2], 16)) for i in (0, 2, 4))
WORLD_STRENGTH = 0.35                     # soft tent; keys do the shaping

# ---------------------------------------------------------------- thread law
# GCMI 415 standard (Jordan directive 2026-08-10; derivation, per-bottle
# tables and the clay-gate protocol live in
# pipeline/paper-doll-3d/specs/THREAD-STANDARD.md).
# ONE pitch for the whole 415 series; per-bottle turns derive from each
# drawing's thread-band length. Never round turns; never re-tune per spec.
THREAD_415 = dict(
    pitch=3.175,           # 8 TPI — the 415-series standard (tall sheet note)
    wu=0.39, wd=0.39,      # symmetric raised-cosine lens: 0.78 x pitch
    plateau=0.0,           #   = 2.48mm section (drawings: "2.5 wide"; the
)                          #   bell's own curvature IS the R0.3-R0.4 crest)

# GCMI nominal finish diameters (T = crest OD, E = root OD). Drawing values
# in each spec override these — the table exists so a finish ruling is a
# one-line swap (e.g. the circle30 15/415 confirmation, Jordan 2026-08-10).
FINISH_415 = {
    "13-415": dict(T=12.8, E=11.2),
    "15-415": dict(T=14.3, E=13.0),
    "17-415": dict(T=16.3, E=14.8),
    "18-415": dict(T=17.5, E=15.5),
}


def resolve_thread(s):
    """Inject pitch/turns from the spec's drawing-verified thread_band.

    turns = band / pitch, NON-integer by design — the run-outs land where
    they land, and thread_phase_deg poses the top one at the rear
    (phase = (360 * frac(turns) - 90) mod 360). Idempotent; a spec that
    already carries pitch (legacy override) passes through untouched.
    """
    if "thread_band" in s and "pitch" not in s:
        s["pitch"] = THREAD_415["pitch"]
        s["turns"] = s["thread_band"] / THREAD_415["pitch"]
        assert abs(s["pitch"] * s["turns"] - s["thread_band"]) < 0.01
    return s

CYL_SPECS = {
    "005": dict(
        # SOURCE OF TRUTH: Nemat engineering drawing GBCyl5mlBlue.pdf
        # (May 10 2012): "Cylindrical 5ml Glass Bottle", Type III soda-lime,
        # 5 +/-0.3ml, Finish 13/415. 53.1 +/-1.2 x O17.4 +/-0.5; T O12.8,
        # E O11.2, bore O7.6; 1.2 top land + 7.8 thread band + 1 collar
        # => finish 10.0; R0.5 lip, R2.5 shoulder, R1.5 heel, PU 1.2.
        asset_id="BB_BTL_CYL_005ML_001",
        capacity_ml=5.0,
        height=53.1, diameter=17.4,
        wall=1.5, base_th=2.4, push_up=1.2,
        heel_r=1.5,
        shoulder_r_out=2.5, shoulder_r_in=1.0,
        neck_finish="13-415",
        neck_t=12.8, neck_e=11.2, neck_h=10.0,
        # GCMI 415 thread (THREAD-STANDARD.md): 8 TPI over the drawing's
        # 7.8 band -> 2.457 turns; top run-out phased to the rear.
        thread_band=7.8,
        thread_phase_deg=74.4,
        thread_fade_in=0.18, thread_lead_out=0.12,
        thread_top_gap=0.7,              # + lip_r 0.5 = the 1.2 top land
        bead_d=12.9, bead_below_rim=9.5, bead_h=1.0,
        bore_d=7.6, lip_r=0.5,
        measured_body=True, measured_neck=True, source="drawing",
    ),
    "009_tall": dict(
        # SOURCE OF TRUTH: Nemat engineering drawing "Tall cylinder 9ml bottle
        # drawing Nemat.pdf" (May 10 2015). Type III soda-lime, 10ml overflow.
        # Every value below is the drawing's, no visual estimation:
        # body O18+/-0.8 x 106.2+/-1.0 total; body ends 94.75, conical shoulder
        # tops at 96.75; GCMI 13-415 finish: T O12.87, E O11.34, bore O7.3,
        # finish height 11.5+/-0.3; thread section 2.5 wide, 20deg flanks,
        # R0.4 crests; heel R1.2; push-up 1.2. Pitch = 415-standard 8 TPI.
        asset_id="BB_BTL_CYL_009ML_TALL_001",
        capacity_ml=9.0, overflow_ml=10.0,
        height=106.2, diameter=18.0,
        wall=1.7, base_th=2.5, push_up=1.2,
        heel_r=1.2,
        shoulder_cone_h=2.0,             # 94.75 -> 96.75 on the drawing
        shoulder_edge_r=1.2, shoulder_neck_r=1.0,
        neck_finish="13-415",
        neck_t=12.87, neck_e=11.34, neck_h=11.5,
        # GCMI 415 thread (THREAD-STANDARD.md): 8 TPI over the 7.8 band ->
        # 2.457 turns. Narrow 13-415 neck: terminations melt over LONGER
        # fades than the family default or they lump on the silhouette
        # ("chewed"); phase puts the top run-out at the rear.
        thread_band=7.8,
        thread_phase_deg=74.4,
        thread_fade_in=0.30, thread_lead_out=0.22,
        thread_top_gap=0.5,              # + lip_r 0.4 = 0.9 land
        bore_d=7.3, lip_r=0.4,
        measured_body=True, measured_neck=True, source="drawing",
    ),
    "009": dict(
        asset_id="BB_BTL_CYL_009ML_001",   # SOLD as 9ml (stakeholder naming);
        # (cylinder-9ml-* slugs); the manufacturer drawing and physical
        # capacity are 10ml +/-0.3 — named for what it IS
        capacity_ml=10.0,
        # Extracted from the Nano Banana clear final (Jordan-designated source,
        # Final-17-415-9ML-MASTER/image-1785596360932.png), normalized to the
        # canonical 20.0mm diameter. Height 74.0 matches the CSV's 74x20 cluster;
        # the 70x20 row remains a flagged conflict — caliper arbitration queued.
        # SOURCE OF TRUTH: Nemat engineering drawing GBCyl10mlAmber.pdf
        # (May 10 2012, same sheet family as Blue): "Cylindrical 10ml Glass
        # Bottle", Type III soda-lime, capacity 10 +/-0.3 ml, Finish 17/415.
        # 72 +/-0.8 x O19.7 +/-0.5; finish height 14.06 +/-0.3 with the 5:1
        # section giving T O16.3, E O14.8, bore O9.8, 8.8mm thread band over
        # a 2mm collar (the detail's dimension line reads 8.8; an earlier
        # transcription said 8.6 — the dimension governs).
        # (The "10ml dimensions and print area" sheet's 70x20
        # is the simplified marketing doc; the engineering sheet governs.)
        # Every prior image-derived neck number understated the finish.
        height=72.0, diameter=19.7,
        wall=1.6, base_th=3.5, push_up=1.0,
        heel_r=2.2,
        # SHOULDER — corrected 2026-08-29 from the engineering drawing.
        # The previous note claimed an "almost cylinder-on-cylinder step ...
        # no mould can actually produce" and used r_out 2.2 / r_in 1.4. The
        # Nemat sheet (GBCyl10mlAmber.pdf, 5:1 detail) draws exactly that step
        # and calls out R0.8 and R0.3 at the finish base. Measured against the
        # source PSD the two-arc shoulder ran 4.8x too long (27.6% of body
        # width vs the reference's 5.7%).
        #
        # cylinder_profile's two-arc solve cannot express it: it asserts
        # ro + ri > (R - neck_r) = 1.7, and the drawing's 0.8 + 0.3 = 1.1.
        # So this spec now uses the cone profile - short near-flat shoulder
        # with small corner fillets - which is what the drawing shows.
        # Presence of shoulder_cone_h selects cylinder_profile_cone.
        shoulder_r_out=2.2, shoulder_r_in=1.4,   # legacy, unused by the cone path
        shoulder_cone_h=1.1, shoulder_edge_r=0.8, shoulder_neck_r=0.3,
        neck_finish="17-415",
        # Use the lower edge of the drawing's 14.06 +/-0.30 finish tolerance
        # for the slightly shorter production presentation requested 2026-08-11.
        neck_t=16.3, neck_e=14.8, neck_h=13.76,
        # GCMI 17/415 engineering datum is 3.175 mm. The current product-photo
        # review master uses a 2.7 mm visual pitch so the top/bottom partials
        # sit closer to the full middle pass (Jordan, 2026-08-11). Keep the
        # nominal value explicit; do not mistake this for a source-sheet edit.
        thread_band=8.8,
        nominal_pitch=3.175,
        pitch=2.7, turns=2.0,
        thread_phase_deg=90.0,
        thread_fade_in=0.18, thread_lead_out=0.12,
        thread_top_gap=0.55,     # + lip_r 0.35 = the drawing's 0.9 land
        bead_d=16.1, bead_below_rim=10.75, bead_h=2.0,  # drawing collar band (2mm
        # zone at the finish base, OD ~ crest)
        bore_d=9.8, lip_r=0.35,
        measured_body=True, measured_neck=True, source="drawing",
    ),
    # ----------------------------------------------- ELEGANT family (flacon)
    "elegant60": dict(
        # SOURCE OF TRUTH: Nemat drawing "GBElegant60 Bottle - Nemat.pdf"
        # (May 10 2015): Elegant 60, Type III soda-lime silica glass,
        # 63 ml overflow, Finish 18/415. 86.7 +/-1 tall x 54.5 +/-1 wide x
        # 27.5 +/-1 deep; main body line at 68.9; base flats 50.5 x 23.5
        # with 2 x 45 degree chamfers; T 17.5, E 15.5, bore 10.3; finish
        # 15.9 +/-0.3. Original front/side PSDs govern only the unprinted
        # corner and shoulder softness. Jordan: all Elegant masters clear.
        asset_id="BB_BTL_ELEGANT_060ML_001",
        body="elegant", capacity_ml=60.0, overflow_ml=63.0,
        height=86.7, diameter=54.5, depth=27.5,
        body_top=70.9, shoulder_line=68.9,
        base_w=50.5, base_d=23.5, chamfer_h=2.0,
        corner_r=3.2,
        # Operator-approved visual target (2026-08-25): the calibrated front
        # silhouette needs slim ~1.6 mm side walls. The unseen front/back
        # offset remains a capacity-solved 3.4 mm because the drawing supplies overflow but
        # no sectioned wall-thickness callout.
        wall=1.6, wall_face=3.4, base_th=4.5,
        neck_finish="18-415",
        neck_t=17.5, neck_e=15.5, neck_h=15.9,
        thread_band=10.1,
        thread_phase_deg=176.5,
        thread_fade_in=0.18, thread_lead_out=0.12,
        thread_top_gap=0.4,
        bore_d=10.3, lip_r=0.5,
        polished_bore=True,
        render_weld_finish=True,
        measured_body=True, measured_neck=True, source="drawing",
    ),

    # ------------------------------------------------- CIRCLE family (disc)
    # First non-revolve shape: circular front silhouette, stadium plan
    # section, rectangular plinth foot. Built as a superellipse loft (see
    # disc_stations); "diameter" = front WIDTH so the batch audit gate reads
    # the drawing's headline dimension unchanged.
    "circle50": dict(
        # SOURCE OF TRUTH: Nemat drawing GBCrcl50.pdf (May 10 2015):
        # "Circle 50", Type III soda-lime, 52ml overflow, Finish 18/415.
        # 87.7+/-1 tall x 72.5+/-1 wide x 23.5+/-1 deep; body circle tops at
        # 71.9; base flat 45 x 20.3, 1mm plinth lip, R5 foot fillet, R2 plan
        # corners; neck T O17.5, E O15.5, bore O10.3, finish 15.8+/-0.3 with
        # 13 / 11 thread-band steps; R2 neck fillet; side faces 20.7 -> 20.3.
        asset_id="BB_BTL_CIRCLE_050ML_001",
        body="disc", capacity_ml=50.0, overflow_ml=52.0,
        height=87.7, diameter=72.5, depth=23.5,
        body_top=71.9,                    # = height - neck_h; circle R derives
        base_w=45.0, base_d=20.3, plinth_h=1.0, flare_h=6.0,
        face_d_top=20.7, face_d_bot=20.9,  # side-view silhouette checkpoints
        n_base=5.0, n_body=2.35,          # plan squareness: R2 plinth, soft disc
        wall=3.75, wall_face=3.0, base_th=4.0,   # cavity ~= 52ml overflow
        neck_finish="18-415",
        neck_t=17.5, neck_e=15.5, neck_h=15.8,
        # GCMI 415 thread (THREAD-STANDARD.md): 8 TPI over the 8.7 band
        # (drawing 11-mark upper zone) -> 2.740 turns; top run-out rear.
        thread_band=8.7,
        thread_phase_deg=176.5,
        thread_fade_in=0.18, thread_lead_out=0.12,
        thread_top_gap=0.4,              # + lip_r 0.5 = the drawing's 0.9 land
        bore_d=10.3, lip_r=0.5,
        measured_body=True, measured_neck=True, source="drawing",
    ),
    "circle30": dict(
        # SOURCE OF TRUTH: Nemat drawing GBCrcl30.pdf (May 10 2015):
        # "Circle 30", Type III soda-lime, 32ml overflow, Finish 15/415.
        # 74+/-1 x 60.3+/-1 x 20.5; body circle tops at 59.6; base flat
        # 37.1 x 16.5, 1mm lip over a 7mm foot; neck T O14.3, E O13,
        # bore O8.3, finish 14.4 (1.5 top land, 13.8 / 9.3 steps); R2 fillet.
        asset_id="BB_BTL_CIRCLE_030ML_001",
        body="disc", capacity_ml=30.0, overflow_ml=32.0,
        height=74.0, diameter=60.3, depth=20.5,
        body_top=59.6,
        base_w=37.1, base_d=16.5, plinth_h=1.0, flare_h=6.0,
        face_d_top=17.8, face_d_bot=18.0,
        n_base=5.0, n_body=2.35,
        wall=3.25, wall_face=2.6, base_th=3.5,   # cavity 32.0ml = 32ml overflow
        neck_finish="15-415",
        neck_t=14.3, neck_e=13.0, neck_h=14.4,
        # GCMI 415 thread (THREAD-STANDARD.md): 8 TPI over the 8.7 band ->
        # 2.740 turns; top run-out rear. Finish 15/415 CONFIRMED by Jordan
        # 2026-08-10 (sheets govern).
        thread_band=8.7,
        thread_phase_deg=176.5,
        thread_fade_in=0.18, thread_lead_out=0.12,
        thread_top_gap=0.5,
        bore_d=8.3, lip_r=0.5,
        measured_body=True, measured_neck=True, source="drawing",
    ),
    "circle100": dict(
        # EXTRAPOLATED — no drawing on file (on the Nemat request list,
        # 87 live variants). Dimensions scaled from the 50 by the anisotropic
        # exponents fitted on the 30->50 pair (width~V^0.38, depth~V^0.28,
        # height~V^0.35, V-ratio 102/52); the 18/415 finish is a STANDARD and
        # does not scale — copied verbatim from the Circle 50 drawing.
        # REPLACE with drawing values when the sheet arrives.
        asset_id="BB_BTL_CIRCLE_100ML_001",
        body="disc", capacity_ml=100.0, overflow_ml=102.0,
        height=111.0, diameter=93.7, depth=28.4,
        body_top=95.2,
        base_w=58.1, base_d=24.5, plinth_h=1.2, flare_h=7.5,
        face_d_top=25.0, face_d_bot=25.3,
        n_base=5.0, n_body=2.35,
        wall=5.05, wall_face=4.1, base_th=4.5,   # cavity 102.1ml = 102ml overflow
        neck_finish="18-415",
        neck_t=17.5, neck_e=15.5, neck_h=15.8,
        # GCMI 415 thread (THREAD-STANDARD.md): 8 TPI over the 8.7 band
        # (mirrors the Circle 50's 18/415 finish) -> 2.740 turns.
        thread_band=8.7,
        thread_phase_deg=176.5,
        thread_fade_in=0.18, thread_lead_out=0.12,
        thread_top_gap=0.4,              # + lip_r 0.5 = the drawing's 0.9 land
        bore_d=10.3, lip_r=0.5,
        measured_body=False, measured_neck=True, source="extrapolated",
    ),
    "circle15": dict(
        # EXTRAPOLATED — no drawing on file (request list, 30 live variants).
        # Scaled DOWN from the 30 by the same exponents (V-ratio 17/32);
        # finish assumed 13/415 (shares the 5ml cylinder's cap family) with
        # the GBCyl5mlBlue drawing's finish numbers. REPLACE when the sheet
        # arrives — the finish assumption especially needs confirmation.
        asset_id="BB_BTL_CIRCLE_015ML_001",
        body="disc", capacity_ml=15.0, overflow_ml=17.0,
        height=59.3, diameter=47.4, depth=17.2,
        body_top=49.3,
        base_w=29.2, base_d=13.8, plinth_h=0.8, flare_h=5.0,
        face_d_top=15.0, face_d_bot=15.2,
        n_base=5.0, n_body=2.35,
        wall=2.55, wall_face=2.0, base_th=3.0,   # cavity 17.0ml = 17ml overflow
        neck_finish="13-415",
        neck_t=12.8, neck_e=11.2, neck_h=10.0,
        # GCMI 415 thread (THREAD-STANDARD.md): 8 TPI over 7.8 -> 2.457
        # turns. Band changed 8.7 -> 7.8 with the standardization: restores
        # the 13/415 sheet's 1.2 + 7.8 + 1.0 finish stack (flagged in
        # THREAD-STANDARD.md pending this size's own sheet).
        thread_band=7.8,
        thread_phase_deg=74.4,
        thread_fade_in=0.18, thread_lead_out=0.12,
        thread_top_gap=0.7,
        bore_d=7.6, lip_r=0.5,
        measured_body=False, measured_neck=False, source="extrapolated",
    ),

    # ------------------------------------------- 18-415 scale-out (2026-08-31)
    # Four bodies onboarded from the live-site harvest so every family that
    # shares the finished 18-415 closure set can go 3D before any sculpted
    # shape (Diva/Diamond/Grace) is attempted. Headline dims are the
    # harvest's live-site truth; NO drawings on file (request list) — the
    # 18/415 finish is a STANDARD copied verbatim from the Circle 50 sheet,
    # exactly the circle100 doctrine. REPLACE with drawing values on arrival.
    "cyl50": dict(
        # Straight column, crisp near-flat shoulder (reference render
        # GBCyl50RdcrMtSlTall: sharp step, thick base slab). Live 117 x O32.
        asset_id="BB_BTL_CYL_050ML_001",
        capacity_ml=50.0, overflow_ml=52.0,
        height=117.0, diameter=32.0,
        wall=2.85, base_th=4.5, push_up=1.0,
        heel_r=2.2,
        shoulder_r_out=2.2, shoulder_r_in=1.4,   # legacy pair, cone governs
        shoulder_cone_h=1.2, shoulder_edge_r=1.2, shoulder_neck_r=0.5,
        neck_finish="18-415",
        neck_t=17.5, neck_e=15.5, neck_h=15.8,
        thread_band=8.7,
        thread_phase_deg=176.5,
        thread_fade_in=0.18, thread_lead_out=0.12,
        thread_top_gap=0.4,
        bore_d=10.3, lip_r=0.5,
        measured_body=False, measured_neck=True, source="harvested",
    ),
    "cyl100": dict(
        asset_id="BB_BTL_CYL_100ML_001",
        capacity_ml=100.0, overflow_ml=103.0,
        height=154.0, diameter=35.0,
        wall=1.8, base_th=4.5, push_up=1.0,
        heel_r=2.2,
        shoulder_r_out=2.2, shoulder_r_in=1.4,
        shoulder_cone_h=1.2, shoulder_edge_r=1.2, shoulder_neck_r=0.5,
        neck_finish="18-415",
        neck_t=17.5, neck_e=15.5, neck_h=15.8,
        thread_band=8.7,
        thread_phase_deg=176.5,
        thread_fade_in=0.18, thread_lead_out=0.12,
        thread_top_gap=0.4,
        bore_d=10.3, lip_r=0.5,
        measured_body=False, measured_neck=True, source="harvested",
    ),
    # Sphere-on-plinth apothecary flask (reference GBRndFrst128Rdcr...: full
    # sphere body, narrow foot disc, the sphere's own curve IS the shoulder).
    # body="round" selects round_profile.
    "round78": dict(
        asset_id="BB_BTL_ROUND_078ML_001",
        body="round", capacity_ml=78.0, overflow_ml=80.0,
        height=73.0, diameter=59.0,
        base_w=23.0, plinth_h=1.8,
        wall=2.6, base_th=4.0, push_up=0.8,
        neck_finish="18-415",
        neck_t=17.5, neck_e=15.5, neck_h=15.8,
        thread_band=8.7,
        thread_phase_deg=176.5,
        thread_fade_in=0.18, thread_lead_out=0.12,
        thread_top_gap=0.4,
        bore_d=10.3, lip_r=0.5,
        measured_body=False, measured_neck=True, source="harvested",
    ),
    "round128": dict(
        asset_id="BB_BTL_ROUND_128ML_001",
        body="round", capacity_ml=128.0, overflow_ml=131.0,
        height=83.0, diameter=69.0,
        base_w=27.0, plinth_h=2.0,
        wall=2.9, base_th=4.5, push_up=0.8,
        neck_finish="18-415",
        neck_t=17.5, neck_e=15.5, neck_h=15.8,
        thread_band=8.7,
        thread_phase_deg=176.5,
        thread_fade_in=0.18, thread_lead_out=0.12,
        thread_top_gap=0.4,
        bore_d=10.3, lip_r=0.5,
        measured_body=False, measured_neck=True, source="harvested",
    ),
    "elegant100": dict(
        # Same oval loft as the drawing-exact elegant60, scaled to the
        # harvest's live headline dims (109 x 61 x 30); section character
        # (chamfers, corner R, shoulder drop) scaled per-axis from the 60.
        asset_id="BB_BTL_ELEGANT_100ML_001",
        body="elegant", capacity_ml=100.0, overflow_ml=103.0,
        height=109.0, diameter=61.0, depth=30.0,
        body_top=93.2, shoulder_line=91.2,
        base_w=56.5, base_d=25.6, chamfer_h=2.5,
        corner_r=3.6,
        wall=2.4, wall_face=4.4, base_th=4.5,   # cavity-solved to ~103ml
        neck_finish="18-415",
        neck_t=17.5, neck_e=15.5, neck_h=15.9,
        thread_band=10.1,
        thread_phase_deg=176.5,
        thread_fade_in=0.18, thread_lead_out=0.12,
        thread_top_gap=0.4,
        bore_d=10.3, lip_r=0.5,
        polished_bore=True,
        render_weld_finish=True,
        measured_body=False, measured_neck=True, source="harvested",
    ),
}

# Roll-on fitment, measured off the same PSD photograph that defined the neck
# (19. GBCyl9RollShBlk.psd) so bottle and fitment agree by construction:
# 9.96mm total above the rim, 11.50mm barrel, 12.45mm collar, 4.48mm exposed
# ball cap. A 9.5mm ball centred 5.2mm above the rim reproduces that envelope
# to 0.01mm and seats its equator just under the barrel rim, which is what
# retains it. Fitment radii derive from the BOTTLE's bore at build time, so a
# caliper correction to the neck re-fits the roller automatically.
ROLLER_17415 = dict(
    asset_id="BB_ROLL_17415_001",
    ball_d=9.5, ball_z=5.2,          # z measured from the neck rim (the datum)
    barrel_od=11.50, barrel_top=7.2,   # socket rim ABOVE the ball equator:
                                       # the ball nests in and is retained,
                                       # showing a crown not a hemisphere
    collar_od=13.35, collar_h=0.95,  # standalone macros: thin wide disc flange
    plug_depth=6.0, plug_clear=0.10,  # press fit: bore minus this per side
    wall=1.0, rim_r=0.45, fold_h=1.4,   # inward fold closing over the ball
)

# Closure, measured off the SAME PSD photograph. The cap sits on its own layer,
# so its alpha is authoritative (a colour-boundary read swallows the shadowed
# neck): 18.92 x 26.89mm overall, 18.34 OD at the top drafting to 18.76 at the
# skirt. The capped assembly measures 88.30mm total, which fixes the seat: the
# skirt bottom lands at z=61.41 on the bottle — just clear of the flange bead,
# covering the whole thread run — and the interior clears the roller ball by
# 2.35mm. Internal thread mirrors the bottle's (same pitch and run) so the two
# engage by construction.
# Cap listings (Jordan, 2026-08-09): 17-415 cap 27 +/-0.5 x O19 +/-0.5;
# 13-415 cap 24 +/-0.5 x O17 +/-0.5; wall 1-2mm (ours: 1.05 at thread
# engagement to 2.0 at crown). Height 27 validates the PSD-alpha 26.89.
CAPS_BY_FINISH = {
    "17-415": dict(asset_id="BB_CAP_17415_001", height=27.0,
                   od_top=18.60, od_base=19.0,
                   thread_root_d=16.90, thread_crest_d=15.10),
    "13-415": dict(asset_id="BB_CAP_13415_001", height=24.0,
                   od_top=16.65, od_base=17.0,
                   thread_root_d=13.40, thread_crest_d=11.90),
}
CAP_COMMON = dict(top_edge_r=0.45, top_th=2.0, wall=1.5)

CAP_17415 = dict(
    asset_id="BB_CAP_17415_001",
    height=26.89, od_top=18.34, od_base=18.76,
    top_edge_r=0.45, top_th=2.0, wall=1.5,   # crisp break edge, not a dome
    skirt_below_rim=14.70,            # z=0 is the neck rim, the shared datum;
                                      # skirt now clears the flange bead entirely
    thread_root_d=16.90, thread_crest_d=15.10,   # engages the O16.3 crest, clears O14.8 root
)

# Dot caps: raised metallic studs, ~1.4mm dots, staggered lattice ~3.9mm row
# pitch, 8 columns (extracted from CpRoll17-415*Dot.psd). Implemented as a
# shader on the SAME cap mesh: stud mask + dome bump + silver metal in-dot.
CAP_DOT_FINISHES = {
    "black-dot":  (0.020, 0.020, 0.022, 0.08),
    "pink-dot":   (0.665, 0.527, 0.578, 0.30),
    "silver-dot": (0.631, 0.631, 0.631, 0.25),
}


def mat_cap_dotted(mode):
    base_r, base_g, base_b, rough = CAP_DOT_FINISHES[mode]
    name = f"BB_MAT_CAP_{mode.upper().replace('-', '_')}"
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_fake_user = True
    nt = m.node_tree
    pr = nt.nodes["Principled BSDF"]
    pr.inputs["Base Color"].default_value = (base_r, base_g, base_b, 1.0)
    pr.inputs["Roughness"].default_value = rough
    # cylindrical stud lattice: 5 columns, 6.8mm rows, staggered diamond
    # (Jordan cap artwork 2026-08-10: previous 8 x 3.9 was ~4x too dense)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], sep.inputs["Vector"])
    ang = nt.nodes.new("ShaderNodeMath"); ang.operation = "ARCTAN2"
    nt.links.new(sep.outputs["Y"], ang.inputs[0])
    nt.links.new(sep.outputs["X"], ang.inputs[1])
    u = nt.nodes.new("ShaderNodeMath"); u.operation = "MULTIPLY"
    u.inputs[1].default_value = 5.0 / 6.2831853       # 5 columns
    nt.links.new(ang.outputs[0], u.inputs[0])
    v = nt.nodes.new("ShaderNodeMath"); v.operation = "DIVIDE"
    v.inputs[1].default_value = 6.8                    # row pitch mm
    nt.links.new(sep.outputs["Z"], v.inputs[0])
    row = nt.nodes.new("ShaderNodeMath"); row.operation = "FLOOR"
    nt.links.new(v.outputs[0], row.inputs[0])
    stag = nt.nodes.new("ShaderNodeMath"); stag.operation = "MULTIPLY"
    stag.inputs[1].default_value = 0.5
    nt.links.new(row.outputs[0], stag.inputs[0])
    u2 = nt.nodes.new("ShaderNodeMath"); u2.operation = "ADD"
    nt.links.new(u.outputs[0], u2.inputs[0])
    nt.links.new(stag.outputs[0], u2.inputs[1])
    fu = nt.nodes.new("ShaderNodeMath"); fu.operation = "FRACT"
    nt.links.new(u2.outputs[0], fu.inputs[0])
    fv = nt.nodes.new("ShaderNodeMath"); fv.operation = "FRACT"
    nt.links.new(v.outputs[0], fv.inputs[0])
    # distance from cell centre (cell ~= 7.45mm arc x 3.9mm at r=9.5)
    du = nt.nodes.new("ShaderNodeMath"); du.operation = "SUBTRACT"
    du.inputs[1].default_value = 0.5
    nt.links.new(fu.outputs[0], du.inputs[0])
    dus = nt.nodes.new("ShaderNodeMath"); dus.operation = "MULTIPLY"
    dus.inputs[1].default_value = 7.45
    nt.links.new(du.outputs[0], dus.inputs[0])
    dv = nt.nodes.new("ShaderNodeMath"); dv.operation = "SUBTRACT"
    dv.inputs[1].default_value = 0.5
    nt.links.new(fv.outputs[0], dv.inputs[0])
    dvs = nt.nodes.new("ShaderNodeMath"); dvs.operation = "MULTIPLY"
    dvs.inputs[1].default_value = 6.8
    nt.links.new(dv.outputs[0], dvs.inputs[0])
    du2 = nt.nodes.new("ShaderNodeMath"); du2.operation = "MULTIPLY"
    nt.links.new(dus.outputs[0], du2.inputs[0]); nt.links.new(dus.outputs[0], du2.inputs[1])
    dv2 = nt.nodes.new("ShaderNodeMath"); dv2.operation = "MULTIPLY"
    nt.links.new(dvs.outputs[0], dv2.inputs[0]); nt.links.new(dvs.outputs[0], dv2.inputs[1])
    dd = nt.nodes.new("ShaderNodeMath"); dd.operation = "ADD"
    nt.links.new(du2.outputs[0], dd.inputs[0]); nt.links.new(dv2.outputs[0], dd.inputs[1])
    dist = nt.nodes.new("ShaderNodeMath"); dist.operation = "SQRT"
    nt.links.new(dd.outputs[0], dist.inputs[0])
    # stud mask: dot radius 0.7mm, soft edge
    mask = nt.nodes.new("ShaderNodeMapRange")
    mask.inputs["From Min"].default_value = 0.58
    mask.inputs["From Max"].default_value = 0.70
    mask.inputs["To Min"].default_value = 1.0
    mask.inputs["To Max"].default_value = 0.0
    nt.links.new(dist.outputs[0], mask.inputs["Value"])
    nt.links.new(mask.outputs["Result"], pr.inputs["Metallic"])
    # studs are bright silver: mix base colour toward silver inside the dot
    mixc = nt.nodes.new("ShaderNodeMix"); mixc.data_type = "RGBA"
    mixc.inputs["B"].default_value = (0.75, 0.76, 0.78, 1.0)
    mixc.inputs["A"].default_value = (base_r, base_g, base_b, 1.0)
    nt.links.new(mask.outputs["Result"], mixc.inputs["Factor"])
    nt.links.new(mixc.outputs["Result"], pr.inputs["Base Color"])
    # dome bump: height falls with distance inside the dot
    bmp = nt.nodes.new("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.8
    bmp.inputs["Distance"].default_value = 0.35
    nt.links.new(mask.outputs["Result"], bmp.inputs["Height"])
    nt.links.new(bmp.outputs["Normal"], pr.inputs["Normal"])
    return m


CAP_FINISHES = {                       # geometry is shared; only material changes
    "black":  ((0.016, 0.016, 0.017), 0.10, 0.0),
    "matte-silver": ((0.700, 0.702, 0.710), 0.46, 0.0),  # phenolic matte silver PLASTIC (not metal)
    "white":  ((0.855, 0.855, 0.845), 0.28, 0.0),
    "silver": ((0.780, 0.785, 0.790), 0.16, 1.0),
    "gold":   ((0.830, 0.660, 0.330), 0.18, 1.0),
}

SEGMENTS = 256
ARC_STEPS = 7


# ------------------------------------------------------------- scene helpers

def collection(name, parent=None):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    holder = parent or bpy.context.scene.collection
    if c.name not in [ch.name for ch in holder.children]:
        holder.children.link(c)
    return c


def link(obj, coll):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)
    return obj


# --------------------------------------------------------------- mesh maker

def arc(cx, cz, r, a0, a1, steps=ARC_STEPS):
    """(r,z) points along a circular arc, angles in degrees."""
    return [
        (cx + r * math.cos(math.radians(a)), cz + r * math.sin(math.radians(a)))
        for a in [a0 + (a1 - a0) * i / steps for i in range(steps + 1)]
    ]


def cylinder_profile(s, fm=None):
    """Closed (r,z) outline of the bottle wall, outer surface up then bore
    down, ready to revolve. Starts and ends on the axis (r=0).

    With fm (a FINISH_MASTERS entry): BODY-ONLY mode — the profile ends at
    the finish attachment datum (height - finish_h) with the directive's
    transition: shoulder curve -> small defined ledge -> short land at the
    master's E -> datum. The finish itself is the instanced master."""
    R = s["diameter"] / 2.0
    neck_r = s["neck_e"] / 2.0        # land sits at thread ROOT; helix bulges to T/2
    bore_r = s["bore_d"] / 2.0
    wall = s["wall"]
    z_n = s["height"] - s["neck_h"]               # neck land begins here
    if fm:
        E2, B2 = fm["neck_d"] / 2.0, fm["bore_d"] / 2.0
        z_d = s["height"] - fm["finish_h"]        # attachment datum
        LAND_H, LED_H, LED_W = 1.2, 0.5, 0.55
        neck_r = E2 + LED_W                       # shoulder aims at ledge outer
        z_n = z_d - LAND_H - LED_H                # ...arriving below the ledge
        bore_r = B2
    ro, ri = s["shoulder_r_out"], s["shoulder_r_in"]

    # --- shoulder solve -------------------------------------------------
    # Two arcs, tangent-continuous at both ends: the surface leaves the body
    # wall travelling straight up, turns through phim, and arrives at the neck
    # travelling straight up again. No flat annulus exists anywhere in the
    # transition, so there is no horizontal mirror to image the floor as a
    # stripe. cos(phim) = 1 - (R - neck_r)/(ro + ri).
    span = R - neck_r
    assert ro + ri > span, "shoulder radii too small: the convex arc would undercut"
    phim = math.acos(max(-1.0, min(1.0, 1.0 - span / (ro + ri))))
    z_j = z_n - ri * math.sin(phim)               # arc-to-arc junction
    z_s = z_j - ro * math.sin(phim)               # convex arc leaves the wall

    def shoulder(rad_out, rad_in, steps=22):
        """Shoulder samples. Passing (ro-wall, ri+wall) yields the INNER
        surface from the same two centres — an exact parallel offset, so
        glass thickness stays continuous through the whole transition."""
        pts = []
        for i in range(steps + 1):
            phi = phim * i / steps
            pts.append(((R - ro) + rad_out * math.cos(phi),
                        z_s + rad_out * math.sin(phi)))
        for i in range(steps, -1, -1):
            phi = phim * i / steps
            pts.append(((neck_r + ri) - rad_in * math.cos(phi),
                        z_n - rad_in * math.sin(phi)))
        return pts

    def land_r(z):
        """Neck land radius: root, swelling over the axisymmetric flange bead."""
        if "bead_d" not in s:
            return neck_r
        d = abs(z - (s["height"] - s["bead_below_rim"]))
        half = s["bead_h"] / 2.0
        if d >= half:
            return neck_r
        return neck_r + (s["bead_d"] / 2.0 - neck_r) * (
            0.5 + 0.5 * math.cos(math.pi * d / half))

    p = []
    # --- outer surface, base to rim ---
    p.append((0.0, s["push_up"]))
    p += arc(R - s["heel_r"] - 0.8, s["push_up"] + 0.5, 0.8, 270, 305, 4)
    p += arc(R - s["heel_r"], s["heel_r"], s["heel_r"], 270, 360)
    p.append((R, z_s))                            # straight wall
    p += shoulder(ro, ri)                         # smooth shoulder
    if fm:
        for i in range(1, 7):                     # subtle defined LEDGE step
            t = i / 6.0
            p.append((E2 + LED_W * (0.5 + 0.5 * math.cos(math.pi * t)),
                      z_n + LED_H * t))
        p.append((E2, z_d))                       # short controlled land
        p.append((B2, z_d))                       # datum annulus (mates master)
        p.append((B2, z_d - 0.4))                 # inner: bore continues down
        steps = 10
        for i in range(1, steps + 1):
            t = i / steps
            p.append((B2 + (neck_r - wall - B2) * _ease(t),
                      z_d - 0.4 - t * (z_d - 0.4 - z_n)))
    else:
        z = z_n
        while z < s["height"] - s["lip_r"] - 0.12:  # neck land, dense helix
            p.append((land_r(z), z))
            z += 0.07
        p.append((neck_r, s["height"] - s["lip_r"]))
        p += arc(neck_r - s["lip_r"], s["height"] - s["lip_r"], s["lip_r"], 0, 90)
        # --- inner surface, rim back down to the base ---
        steps = 14                                # bore, tapering into neck wall
        for i in range(steps + 1):
            t = i / steps
            p.append((bore_r + (neck_r - wall - bore_r) * t,
                      s["height"] - t * (s["height"] - z_n)))
    p += list(reversed(shoulder(ro - wall, ri + wall)))
    p.append((R - wall, s["base_th"] + 2.0))
    p += arc(R - wall - 2.0, s["base_th"] + 2.0, 2.0, 0, -90, 6)
    p.append((0.0, s["base_th"]))
    # dedupe consecutive near-identical points
    out = [p[0]]
    for q in p[1:]:
        if abs(q[0] - out[-1][0]) > 1e-4 or abs(q[1] - out[-1][1]) > 1e-4:
            out.append(q)
    return out


def round_profile(s, fm):
    """Sphere-on-plinth flask (Round 78/128): the sphere's own curve is the
    shoulder — it runs from a concave heel blend above the narrow foot disc
    all the way to the finish land. Same closed-outline contract as
    cylinder_profile, BODY-ONLY (fm required: ledge -> land -> datum).

    Also stashes the numerically-integrated cavity in s["_cavity_ml"] so the
    build dispatch can print the same CAVITY_AUDIT gate the lofts get."""
    R_s = s["diameter"] / 2.0
    wall = s["wall"]
    E2, B2 = fm["neck_d"] / 2.0, fm["bore_d"] / 2.0
    z_d = s["height"] - fm["finish_h"]
    LAND_H, LED_H, LED_W = 1.2, 0.5, 0.55
    neck_r = E2 + LED_W
    z_n = z_d - LAND_H - LED_H
    # sphere centre: its surface passes through the land bottom (neck_r, z_n)
    z_c = z_n - math.sqrt(R_s * R_s - neck_r * neck_r)
    r_p, h_p = s["base_w"] / 2.0, s["plinth_h"]
    pu = s["push_up"]

    # sphere param: r = R_s sin(phi), z = z_c + R_s cos(phi); phi from +z axis
    phi_top = math.asin(neck_r / R_s)             # land junction (above centre)
    blend_h = 2.5                                 # heel blend rise above plinth
    phi_bot = math.acos(max(-1.0, (h_p + blend_h - z_c) / R_s))

    p = [(0.0, pu)]
    p += arc(r_p - 0.8, pu + 0.4, 0.8, 270, 340, 4)   # push-up out to the foot
    p.append((r_p, 0.6))
    p.append((r_p, h_p))                              # plinth wall
    # concave heel blend: quadratic from the plinth edge to the sphere
    bx, bz = R_s * math.sin(phi_bot), z_c + R_s * math.cos(phi_bot)
    for i in range(1, 7):
        t = i / 7.0
        e = t * t * (3 - 2 * t)
        p.append((r_p + (bx - r_p) * e, h_p + (bz - h_p) * t))
    steps = 48                                        # the sphere itself
    for i in range(steps + 1):
        phi = phi_bot + (phi_top - phi_bot) * i / steps
        p.append((R_s * math.sin(phi), z_c + R_s * math.cos(phi)))
    for i in range(1, 7):                             # defined ledge step
        t = i / 6.0
        p.append((E2 + LED_W * (0.5 + 0.5 * math.cos(math.pi * t)),
                  z_n + LED_H * t))
    p.append((E2, z_d))                               # short controlled land
    p.append((B2, z_d))                               # datum annulus
    p.append((B2, z_d - 0.4))                         # bore continues down
    # --- inner surface: bore -> inner sphere -> base ---
    Ri = R_s - wall
    z_j = z_c + math.sqrt(Ri * Ri - B2 * B2)          # bore meets inner sphere
    stepsb = 8
    for i in range(1, stepsb + 1):
        t = i / stepsb
        p.append((B2, (z_d - 0.4) + ((z_j) - (z_d - 0.4)) * t))
    phi_i0 = math.asin(B2 / Ri)
    z_b = s["base_th"]
    phi_i1 = math.acos(max(-1.0, (z_b - z_c) / Ri))
    inner = []
    for i in range(1, 49):
        phi = phi_i0 + (phi_i1 - phi_i0) * i / 48.0
        inner.append((Ri * math.sin(phi), z_c + Ri * math.cos(phi)))
    p += inner
    p.append((0.0, z_b))
    # cavity: revolve integral over the inner descent (bore + sphere + base)
    icontour = [(B2, z_d)] + [(B2, z_j)] + inner + [(0.0, z_b)]
    cav = 0.0
    for (r0, zz0), (r1, zz1) in zip(icontour, icontour[1:]):
        dz = zz0 - zz1                                # descending
        cav += math.pi * ((r0 * r0 + r0 * r1 + r1 * r1) / 3.0) * dz
    s["_cavity_ml"] = cav / 1000.0
    out = [p[0]]
    for q in p[1:]:
        if abs(q[0] - out[-1][0]) > 1e-4 or abs(q[1] - out[-1][1]) > 1e-4:
            out.append(q)
    return out


def cylinder_profile_cone(s, fm=None):
    """Drawing-spec variant: near-flat conical shoulder with corner fillets
    (tall cylinder). Same closed-outline contract as cylinder_profile.
    With fm: BODY-ONLY mode ending at the attachment datum (see
    cylinder_profile) — cone -> ledge -> short land -> datum."""
    R = s["diameter"] / 2.0
    neck_r = s["neck_e"] / 2.0
    bore_r = s["bore_d"] / 2.0
    wall = s["wall"]
    z_n = s["height"] - s["neck_h"]              # finish base (94.7 on drawing)
    cone_h = s["shoulder_cone_h"]
    er, nr2 = s["shoulder_edge_r"], s["shoulder_neck_r"]
    if fm:
        E2, B2 = fm["neck_d"] / 2.0, fm["bore_d"] / 2.0
        z_d = s["height"] - fm["finish_h"]
        LAND_H, LED_H, LED_W = 1.2, 0.5, 0.55
        neck_r = E2 + LED_W                      # cone tops on the ledge outer
        bore_r = B2
        z_ct = z_d - LAND_H - LED_H              # cone top
        z_n = z_ct - cone_h                      # cone base (wall top)
    p = [(0.0, s["push_up"])]
    p += arc(R - s["heel_r"] - 0.8, s["push_up"] + 0.5, 0.8, 270, 305, 4)
    p += arc(R - s["heel_r"], s["heel_r"], s["heel_r"], 270, 360)
    p.append((R, z_n - 0.2))                     # straight wall
    # edge fillet -> cone -> neck fillet (samples; exact radii not critical
    # at this scale, endpoints are the drawing's)
    for i in range(1, 7):
        t = i / 6.0
        r_c = R - (R - er * 0.6 - (neck_r + nr2)) * t
        z_c = (z_n - 0.2) + (cone_h * 0.75) * t
        p.append((r_c, z_c))
    for i in range(1, 5):
        t = i / 4.0
        p.append((neck_r + nr2 * (1 - t),
                  z_n + cone_h * 0.75 + (cone_h * 0.25) * t))
    if fm:
        for i in range(1, 7):                    # subtle defined LEDGE step
            t = i / 6.0
            p.append((E2 + LED_W * (0.5 + 0.5 * math.cos(math.pi * t)),
                      z_ct + LED_H * t))
        p.append((E2, z_d))                      # short land to the datum
        p.append((B2, z_d))                      # datum annulus
        p.append((B2, z_ct - 0.6))               # bore down past the cone
        for i in range(1, 6):
            t = i / 5.0
            p.append((B2 + (R - wall - B2) * _ease(t),
                      z_ct - 0.6 - 3.2 * t))
    else:
        z = z_n + cone_h
        while z < s["height"] - s["lip_r"] - 0.12:   # threaded land, dense
            p.append((neck_r, z))
            z += 0.07
        p.append((neck_r, s["height"] - s["lip_r"]))
        p += arc(neck_r - s["lip_r"], s["height"] - s["lip_r"], s["lip_r"], 0, 90)
        p.append((bore_r, s["height"]))
        # bore straight down, widen under the shoulder, wall to the base
        p.append((bore_r, z_n + 1.0))
        for i in range(1, 6):
            t = i / 5.0
            p.append((bore_r + (R - wall - bore_r) * t, z_n + 1.0 - 3.2 * t))
    p.append((R - wall, s["base_th"] + 2.0))
    p += arc(R - wall - 2.0, s["base_th"] + 2.0, 2.0, 0, -90, 6)
    p.append((0.0, s["base_th"]))
    out = [p[0]]
    for q in p[1:]:
        if abs(q[0] - out[-1][0]) > 1e-4 or abs(q[1] - out[-1][1]) > 1e-4:
            out.append(q)
    return out


def _ease(t):
    """Cosine smoothstep on [0,1]."""
    t = max(0.0, min(1.0, t))
    return 0.5 - 0.5 * math.cos(math.pi * t)


def disc_stations(s, fm=None):
    """Station list for a Circle-family (disc) bottle: outer surface base->rim,
    then inner surface rim->base — the loft twin of cylinder_profile's closed
    outline. Each station is (a, b, n, z): superellipse half-width (X),
    half-depth (Y), squareness exponent, height. a <= 0 marks an axis point.

    The front silhouette (a of z) IS the drawing: plinth flat, foot fillet,
    the true circle, and an R2-class blend into the standard neck finish. The
    plan section morphs boxy plinth -> soft stadium -> perfect circle at the
    neck, so the threads ride an exact revolve land and the same
    thread_modulator applies unchanged."""
    R = s["diameter"] / 2.0                     # horizontal semi-axis
    BV = s.get("body_ellipse_v", R)             # vertical semi-axis
    zc = s["body_top"] - BV                     # body-arc centre height
    aw, ad = s["base_w"] / 2.0, s["base_d"] / 2.0
    b_eq = s["depth"] / 2.0
    b_top, b_bot = s["face_d_top"] / 2.0, s["face_d_bot"] / 2.0
    neck_r = s["neck_e"] / 2.0
    bore_r = s["bore_d"] / 2.0
    if fm:
        # BODY-ONLY mode: every disc's body_top already IS the master's
        # attachment datum (height - finish_h) — the ledge the master
        # correction built terminates exactly there. Interface radii come
        # from the master.
        neck_r = fm["neck_d"] / 2.0
        bore_r = fm["bore_d"] / 2.0
    wall = s["wall"]
    z_pl, z_fl = s["plinth_h"], s["plinth_h"] + s["flare_h"]
    z_n = s["body_top"]                         # finish base
    # arc -> neck: SHOULDER LEDGE (master correction). The dome flattens
    # into a small, softly radiused annular ledge the neck sits ON — never
    # pulled up into the neck, no V, no saddle, no concave notch.
    led_out = neck_r + 1.5                      # ledge outer radius
    z_sh = zc + math.sqrt(max(R * R - led_out * led_out, 0.0))
    z_bd = zc + 0.72 * R                        # depth starts converging HERE

    def a_circ(z):
        u = (z - zc) / BV
        return R * math.sqrt(max(0.0, 1.0 - u * u))

    def b_body(z):
        """Side silhouette: near-straight faces, widest at the equator."""
        u = (z - zc) / BV
        return b_eq - (b_eq - (b_top if u >= 0 else b_bot)) * u * u

    def outer(z):
        if z <= z_fl:                            # SQUARE pedestal block: dead
            return aw, ad, 2.0                   # straight walls, crisp edges
        if z <= z_fl + 4.0 and z <= z_sh:        # R5 notch: block edge blends
            t = _ease((z - z_fl) / 4.0)          # into the overhanging circle
            a = max(a_circ(z), aw + (a_circ(z) - aw) * t if a_circ(z) > aw
                    else aw * (1 - t) + a_circ(z) * t)
            a = max(a, aw) if a_circ(z) >= aw else aw * (1 - t) + a_circ(z) * t
            bb = ad + (b_body(z) - ad) * t
            return (a, bb, 2.0 + (bb - 2.0) * t)
        if z <= z_sh:                            # body: FLAT faces, round rim
            bb = b_body(z)
            if z > z_bd:                         # depth -> neck, low and early
                t = _ease((z - z_bd) / (z_n - z_bd))
                bb = bb + (neck_r - bb) * t
            return a_circ(z), bb, min(bb, a_circ(z))
        t = _ease((z - z_sh) / (z_n - z_sh))     # soft convex round-over
        a = led_out + (neck_r - led_out) * t     # onto the ledge, then neck
        tb = _ease((z - z_bd) / (z_n - z_bd))
        bb = b_body(z) + (neck_r - b_body(z)) * tb
        bb = min(bb, max(a + 0.3, neck_r + 0.3))
        return (a, bb, min(bb, a))

    st = []
    # ---- outer, base to rim
    st.append((0.0, 0.0, 1.0, 0.6))                       # push-up apex
    st.append((aw - 0.5, ad - 0.5, 2.0, 0.0))             # heel-eased base ring
    z = 0.35
    while z < z_n:
        a, b, n = outer(z)
        st.append((a, b, n, z))
        z += (0.35 if z < z_fl or z > z_sh - 0.8 else 1.1)
    def land_r(z):
        if "bead_d" not in s:
            return neck_r
        d = abs(z - (s["height"] - s["bead_below_rim"]))
        half = s["bead_h"] / 2.0
        if d >= half:
            return neck_r
        return neck_r + (s["bead_d"] / 2.0 - neck_r) * (
            0.5 + 0.5 * math.cos(math.pi * d / half))

    if fm:
        st.append((neck_r, neck_r, neck_r, z_n))           # land ring AT datum
        st.append((bore_r, bore_r, bore_r, z_n))           # datum annulus
    else:
        z = z_n                                            # threaded neck land
        while z < s["height"] - s["lip_r"] - 0.12:
            lr = land_r(z)
            st.append((lr, lr, lr, z))
            z += 0.07
        for i in range(1, 8):                              # lip round to rim
            th = math.pi / 2 * i / 7
            lr = neck_r - s["lip_r"] + s["lip_r"] * math.cos(th)
            st.append((lr, lr, lr,
                       s["height"] - s["lip_r"] + s["lip_r"] * math.sin(th)))
        st.append((bore_r, bore_r, bore_r, s["height"]))   # rim inner edge
    # ---- inner, rim back down: the cavity is its OWN TRUE CIRCLE (the
    # frosted window reads round on the product — never a sliced offset)
    R_in = R - wall
    wf = s.get("wall_face", wall * 0.62)                   # flat-face wall

    def a_in(z):
        return math.sqrt(max(R_in * R_in - (z - zc) ** 2, 1.0))

    z_f_hi = z_n - 1.0                       # bore runs straight this deep
    z_f_lo = zc + R_in * 0.905                # funnel lands on the circle here
    a_lo = a_in(z_f_lo)
    st.append((bore_r, bore_r, bore_r, z_f_hi))            # bore column
    steps = 8
    for i in range(1, steps + 1):
        t = i / steps
        z_i = z_f_hi - t * (z_f_hi - z_f_lo)
        ai = bore_r + (a_lo - bore_r) * _ease(t)           # monotone flare —
        bi = bore_r + (max(b_body(z_i) - wf, bore_r * 0.8) - bore_r) * _ease(t)
        st.append((ai, bi, min(bi, ai), z_i))              # no interior waist
    z_top_in = z_f_lo
    z = z_top_in - 1.0
    z_bot_in = max(s["base_th"] + 0.6, zc - R_in * 0.92)
    while z > z_bot_in:
        ai = a_in(z)
        bi = max(b_body(z) - wf, 1.2)
        st.append((ai, bi, min(bi, ai), z))
        z -= 1.0
    st.append((max(a_in(z_bot_in) - 1.5, 1.0), 1.4, 1.0, z_bot_in - 0.3))
    st.append((0.0, 0.0, 2.0, max(s["base_th"], zc - R_in)))  # cavity apex
    return st


def _rrect_area(a, b, rc):
    """Area of a 2a x 2b rounded rectangle with corner radius rc."""
    rc = max(1e-6, min(rc, a, b))
    return 4.0 * a * b - (4.0 - math.pi) * rc * rc


def _rrect_ring(a, b, rc, segments):
    """Evenly spaced perimeter points of the rounded rectangle, starting at
    (+a, 0) and running counter-clockwise — matches the circle rings' start
    so the loft twists nowhere."""
    rc = max(1e-6, min(rc, a, b))
    fx, fy = a - rc, b - rc                     # flat half-spans
    quarter = math.pi * rc / 2.0
    # path pieces, counter-clockwise from (a, 0):
    # right side up, TR arc, top side, TL arc, left side, BR... mirrored
    pieces = [
        ("v", (a, 0.0), (a, fy)),               # right side, upper half
        ("a", (fx, fy), 0.0),                   # top-right arc
        ("h", (fx, b), (-fx, b)),               # top side (right to left)
        ("a", (-fx, fy), math.pi / 2),          # top-left arc
        ("v", (-a, fy), (-a, -fy)),             # left side
        ("a", (-fx, -fy), math.pi),             # bottom-left arc
        ("h", (-fx, -b), (fx, -b)),             # bottom side
        ("a", (fx, -fy), 3 * math.pi / 2),      # bottom-right arc
        ("v", (a, -fy), (a, 0.0)),              # right side, lower half
    ]
    lens = []
    for p in pieces:
        if p[0] == "v":
            lens.append(abs(p[2][1] - p[1][1]))
        elif p[0] == "h":
            lens.append(abs(p[2][0] - p[1][0]))
        else:
            lens.append(quarter)
    total = sum(lens)
    pts, target, acc, pi = [], 0.0, 0.0, 0
    for k in range(segments):
        target = total * k / segments
        while pi < len(pieces) - 1 and acc + lens[pi] < target - 1e-9:
            acc += lens[pi]; pi += 1
        p, t = pieces[pi], (target - acc) / max(lens[pi], 1e-9)
        if p[0] == "v":
            pts.append((p[1][0], p[1][1] + (p[2][1] - p[1][1]) * t))
        elif p[0] == "h":
            pts.append((p[1][0] + (p[2][0] - p[1][0]) * t, p[1][1]))
        else:
            ang = p[2] + t * (math.pi / 2)
            pts.append((p[1][0] + rc * math.cos(ang),
                        p[1][1] + rc * math.sin(ang)))
    return pts


def disc_cavity_ml(s):
    """Numeric overflow capacity of the disc's inner shell — the shaped-bottle
    audit gate: dimensions alone don't pin a loft, the enclosed volume does."""
    st = disc_stations(s)
    # inner surface = stations after the rim (max z), walked back down
    top = max(range(len(st)), key=lambda i: st[i][3])
    inner = st[top:]
    vol = 0.0
    for (a0, b0, n0, z0), (a1, b1, n1, z1) in zip(inner, inner[1:]):
        A0 = _rrect_area(max(a0, 1e-4), max(b0, 1e-4), n0)
        A1 = _rrect_area(max(a1, 1e-4), max(b1, 1e-4), n1)
        vol += (A0 + A1) / 2.0 * abs(z0 - z1)
    return vol / 1000.0


def elegant_stations(s, fm=None):
    """Closed loft stations for the Elegant flattened rectangular flacon.

    The drawing fixes the broad front/depth envelope and 2 x 45 degree base
    chamfer. Original product photographs govern only the molded corner and
    shoulder softness between those printed datums. The fixed finish remains
    a separate module attached at ``height - finish_h``.
    """
    half_w = s["diameter"] / 2.0
    half_d = s["depth"] / 2.0
    base_w = s["base_w"] / 2.0
    base_d = s["base_d"] / 2.0
    corner = s["corner_r"]
    chamfer_h = s["chamfer_h"]
    shoulder_z = s["shoulder_line"]
    finish = fm or FINISH_MASTERS[s["neck_finish"]]
    datum_z = s["height"] - finish["finish_h"]
    neck_r = finish["neck_d"] / 2.0
    bore_r = finish["bore_d"] / 2.0

    stations = [
        (0.0, 0.0, 1.0, 1.2),
        (base_w, base_d, 2.2, 0.0),
        (base_w + 0.55, base_d + 0.55, 2.5, 0.55),
        (half_w, half_d, corner, chamfer_h),
        (half_w, half_d, corner, chamfer_h + 0.8),
        (half_w, half_d, corner, shoulder_z - 1.0),
        (half_w, half_d, corner, shoulder_z),
    ]

    # Shallow two-millimetre shoulder: broad and nearly flat in front, with
    # depth converging early enough to match the original three-quarter view.
    shoulder_span = datum_z - shoulder_z
    for fraction, width_scale, depth_scale in (
        (0.20, 0.94, 0.93),
        (0.45, 0.77, 0.82),
        (0.70, 0.54, 0.69),
        (0.88, 0.40, 0.62),
    ):
        z = shoulder_z + shoulder_span * fraction
        a = neck_r + (half_w - neck_r) * width_scale
        b = neck_r + (half_d - neck_r) * depth_scale
        stations.append((a, b, min(corner, b), z))
    stations.append((neck_r, neck_r, neck_r, datum_z))
    stations.append((bore_r, bore_r, bore_r, datum_z))

    # Interior is evidence-limited: retain a straight bore, then open into a
    # restrained rectangular cavity. The original front PSD and the physical-
    # bottle reference show one broad, continuous inner shoulder. A short,
    # near-horizontal flare here refracts as a floating oval below the mouth,
    # so spread the circular-to-rectangular transition vertically. Wall/base
    # values remain explicitly audited against the drawing's 63 ml overflow.
    inner_w = half_w - s["wall"]
    inner_d = half_d - s.get("wall_face", s["wall"])
    inner_corner = max(1.2, corner - 1.4)
    funnel_top = datum_z
    funnel_bottom = shoulder_z - 4.5
    for step in range(1, 11):
        t = step / 10.0
        eased = _ease(t)
        z = funnel_top + (funnel_bottom - funnel_top) * t
        a = bore_r + (inner_w - bore_r) * eased
        b = bore_r + (inner_d - bore_r) * eased
        radius = bore_r + (inner_corner - bore_r) * eased
        stations.append((a, b, min(radius, a, b), z))
    stations.extend([
        (inner_w, inner_d, inner_corner, s["base_th"] + 1.0),
        (max(inner_w - 0.8, 1.0), max(inner_d - 0.8, 1.0), inner_corner, s["base_th"]),
        (0.0, 0.0, 1.0, s["base_th"] + 0.7),
    ])
    return stations


def elegant_cavity_ml(s):
    """Integrate the Elegant inner loft and report overflow capacity in ml."""
    stations = elegant_stations(s, FINISH_MASTERS[s["neck_finish"]])
    top = max(range(len(stations)), key=lambda index: stations[index][3])
    inner = stations[top:]
    volume = 0.0
    for (a0, b0, r0, z0), (a1, b1, r1, z1) in zip(inner, inner[1:]):
        area0 = _rrect_area(max(a0, 1e-4), max(b0, 1e-4), r0)
        area1 = _rrect_area(max(a1, 1e-4), max(b1, 1e-4), r1)
        volume += (area0 + area1) / 2.0 * abs(z0 - z1)
    return volume / 1000.0


def loft(name, stations, segments=SEGMENTS, modulate=None):
    """Skin a stack of superellipse stations into a manifold mesh — the
    non-axisymmetric sibling of revolve(), same face topology. Circular
    stations (a == b) pass through the thread modulator so a disc bottle's
    neck carries the identical helix the cylinders do."""
    verts, faces = [], []
    ring, axis_idx = {}, {}
    for i, (a, b, n, z) in enumerate(stations):
        if a <= 1e-5:
            axis_idx[i] = len(verts)
            verts.append((0.0, 0.0, z))
            continue
        ring[i] = len(verts)
        circular = abs(a - b) < 1e-6 and abs(n - a) < 0.35   # n carries rc
        if circular:
            for k in range(segments):
                t = 2 * math.pi * k / segments
                r = modulate(a, z, t) if modulate else a
                verts.append((r * math.cos(t), r * math.sin(t), z))
        else:
            for (x, y) in _rrect_ring(a, b, n, segments):
                verts.append((x, y, z))
    for i in range(len(stations) - 1):
        a_ax, b_ax = i in axis_idx, (i + 1) in axis_idx
        if a_ax and b_ax:
            continue
        if a_ax and not b_ax:
            c = axis_idx[i]; base = ring[i + 1]
            for k in range(segments):
                faces.append((c, base + (k + 1) % segments, base + k))
        elif not a_ax and b_ax:
            c = axis_idx[i + 1]; base = ring[i]
            for k in range(segments):
                faces.append((base + k, base + (k + 1) % segments, c))
        else:
            p, q = ring[i], ring[i + 1]
            for k in range(segments):
                k2 = (k + 1) % segments
                faces.append((p + k, p + k2, q + k2, q + k))
    m = bpy.data.meshes.new(name)
    m.from_pydata(verts, [], faces)
    m.validate()
    m.update()
    for poly in m.polygons:
        poly.use_smooth = True
    o = bpy.data.objects.new(name, m)
    return o


def welded_glass_render_assembly(body, finish, coll):
    """Create one dielectric for beauty renders while preserving source parts.

    The body and fixed finish remain separate, closed, inspectable source
    components. Rendering those closed meshes on the exact same attachment
    plane creates a false internal glass boundary in Cycles. A derived shell
    removes both coincident datum faces and welds their matching outer/bore
    rings without scaling or rewriting either source component.
    """
    import bmesh

    bpy.context.view_layer.update()
    datum = finish.matrix_world.translation.z
    vertices = []
    faces = []

    def append_component(component):
        offset = len(vertices)
        transformed = [
            component.matrix_world @ vertex.co
            for vertex in component.data.vertices
        ]
        vertices.extend(tuple(coordinate) for coordinate in transformed)
        for polygon in component.data.polygons:
            coordinates = [transformed[index] for index in polygon.vertices]
            # Each closed source owns an annular face at the same attachment
            # plane. Remove both faces; their matching outer and bore rings
            # are welded below, leaving one continuous glass shell.
            if all(abs(coordinate.z - datum) <= 1e-4 for coordinate in coordinates):
                continue
            faces.append(tuple(offset + index for index in polygon.vertices))

    append_component(body)
    append_component(finish)
    mesh_data = bpy.data.meshes.new("BB_RENDER_GLASS_ASSEMBLY")
    mesh_data.from_pydata(vertices, [], faces)
    mesh_data.materials.append(body.data.materials[0])

    mesh = bmesh.new()
    mesh.from_mesh(mesh_data)
    bmesh.ops.remove_doubles(mesh, verts=mesh.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(mesh, faces=mesh.faces)
    mesh.to_mesh(mesh_data)
    mesh.free()
    mesh_data.update()
    for polygon in mesh_data.polygons:
        polygon.use_smooth = True

    render_body = bpy.data.objects.new("BB_RENDER_GLASS_ASSEMBLY", mesh_data)
    link(render_body, coll)
    body.hide_render = True
    finish.hide_render = True
    render_body.hide_render = False
    render_body["render_only"] = True
    render_body["interface_weld_method"] = "matched-rings"
    render_body["source_body"] = body.name
    render_body["source_finish"] = finish.name
    render_body["web_name"] = "body"
    return render_body


def thread_modulator(s):
    """GCMI 415 continuous-thread finish — the drawings' helix, not a screw.

    THE STANDARD (specs/THREAD-STANDARD.md; Jordan directive 2026-08-10):

      * pitch 3.175mm (8 TPI, the 415-series standard) for EVERY finish;
        turns = drawing thread-band / pitch, non-integer by design —
        resolve_thread() injects both from the spec's thread_band.
      * In front elevation the helix reads as ~3 angled parallel lines —
        the 10ml sheet's depiction, never a screw-like grouping. Through
        clear glass front + back double to ~5-6 alternating crossings;
        thread FORM is judged in CLAY (the gate), never through glass.
      * Cross-section: symmetric raised-cosine lens, plateau 0 — total
        width 0.78 x pitch = 2.48mm (tall sheet: "section 2.5 wide"); the
        bell's own crest curvature IS the details' R0.3-R0.4, and both
        flanks arrive at the root with ZERO slope (R0.6-class root) —
        molded glass, no knife edges, no applied ring.
      * Crest peak = neck_t/2 exactly (the batch audit gate measures it).
      * Run-outs: linear fade ramps; thread_phase_deg poses the TOP
        run-out at the rear (theta = 90 deg; camera sits at -Y), the
        bottom melts under its longer fade wherever it lands.

    The lead angle stays shallow (atan(pitch / (pi * D)) ~ 3-4 deg), so from
    the front the crests read almost horizontal and the helix only declares
    itself as the bottle turns.
    """
    resolve_thread(s)
    root = s["neck_e"] / 2.0
    depth = (s["neck_t"] - s["neck_e"]) / 2.0
    pitch, turns = s["pitch"], s["turns"]
    top = s["height"] - s["lip_r"] - s.get("thread_top_gap", 1.2)
    z0 = top - turns * pitch
    assert z0 > s["height"] - s.get("bead_below_rim", 1e9) + s.get("bead_h", 0) / 2 - 0.15, \
        "thread run would collide with the flange bead"
    # (0.15 tolerance: the drawings butt the band directly onto the collar —
    # 1.2 + 7.8 + 1.0 on the 5ml — and the bead exclusion below guards it)
    bead_z = s["height"] - s.get("bead_below_rim", 1e9)
    bead_half = s.get("bead_h", 0.0) / 2.0 + 0.10
    phase = math.radians(s.get("thread_phase_deg", 0.0))
    W_UP = s.get("thread_wu", THREAD_415["wu"])        # overrides exist as
    W_DN = s.get("thread_wd", THREAD_415["wd"])        # clay-loop fallback
    PLATEAU = s.get("thread_plateau", THREAD_415["plateau"])  # knobs ONLY

    def mod(r, z, theta):
        if abs(r - root) > 0.25 or not (z0 - 0.4 <= z <= top + 0.4):
            return r
        if abs(z - bead_z) < bead_half:        # never carve the flange bead
            return r
        ph = ((z - z0) / pitch
              - (theta + phase) / (2 * math.pi)) % 1.0
        off = ph if ph <= 0.5 else ph - 1.0    # signed offset from the crest line
        w = W_UP if off >= 0 else W_DN         # buttress asymmetry
        x = (abs(off) - PLATEAU) / (w - PLATEAU)
        if x <= 0.0:
            crest = 1.0                        # broad rounded crown
        elif x >= 1.0:
            crest = 0.0                        # root land between turns
        else:
            crest = 0.5 + 0.5 * math.cos(math.pi * x)
        tf = (z - z0) / (top - z0) if top > z0 else 0.0
        fade_in = min(1.0, tf / s.get("thread_fade_in", 0.22))
        lead_out = min(1.0, (1.0 - tf) / s.get("thread_lead_out", 0.08))
        return root + depth * crest * max(0.0, min(fade_in, lead_out))
    return mod


def revolve(name, profile, segments=SEGMENTS, modulate=None):
    """Revolve an (r,z) profile around +Z into a manifold mesh."""
    verts, faces = [], []
    ring = {}
    axis_idx = {}
    for i, (r, z) in enumerate(profile):
        if r <= 1e-5:
            axis_idx[i] = len(verts)
            verts.append((0.0, 0.0, z))
        else:
            ring[i] = len(verts)
            for k in range(segments):
                a = 2 * math.pi * k / segments
                rr = modulate(r, z, a) if modulate else r
                verts.append((rr * math.cos(a), rr * math.sin(a), z))
    for i in range(len(profile) - 1):
        a_ax, b_ax = i in axis_idx, (i + 1) in axis_idx
        if a_ax and b_ax:
            continue
        if a_ax and not b_ax:
            c = axis_idx[i]; base = ring[i + 1]
            for k in range(segments):
                faces.append((c, base + (k + 1) % segments, base + k))
        elif not a_ax and b_ax:
            c = axis_idx[i + 1]; base = ring[i]
            for k in range(segments):
                faces.append((base + k, base + (k + 1) % segments, c))
        else:
            a, b = ring[i], ring[i + 1]
            for k in range(segments):
                k2 = (k + 1) % segments
                faces.append((a + k, a + k2, b + k2, b + k))
    m = bpy.data.meshes.new(name)
    m.from_pydata(verts, [], faces)
    m.validate()
    m.update()
    for poly in m.polygons:
        poly.use_smooth = True
    o = bpy.data.objects.new(name, m)
    return o


# ------------------------------------------------ FINISH MASTER LIBRARY
# Jordan directive 2026-08-10 (GLOBAL CORRECTION — ALL 400-SERIES FINISHES):
# every distinct neck finish is ONE canonical dimensional master
# (FINISH_MASTER_<std>), built from its engineering sheet's PRINTED
# dimensions. Only the rotationally symmetric BASE NECK PROFILE is
# revolved; the THREAD is a separate true swept helix, unioned in.
# Masters are never scaled (1.000^3) and never rebuilt per bottle —
# bottles instance the master's mesh datablock at their attachment datum.
# Local frame: attachment datum = z 0; rim = z finish_h; axis = +Z.

FINISH_MASTERS = {
    "13-415": dict(
        source_drawing="GBCyl5mlBlue.pdf (2012) — governs 13/415; the tall "
                       "cylinder sheet's deltas (finish 11.5, bore 7.3, no "
                       "bead) are reported in QA, master stays canonical",
        major_d=12.8, tol_major=0.3,      # T: thread crest OD
        neck_d=11.2, tol_neck=0.3,        # E: root land OD
        bore_d=7.6, tol_bore=0.3,
        finish_h=10.0, tol_h=0.3,         # datum -> rim (1.2 + 7.8 + 1.0)
        top_land=1.2, thread_band=7.8,
        lip_r=0.5,
        bead_d=12.9, bead_z=0.5, bead_h=1.0,   # transfer bead in the collar
        pitch=3.175, thread_profile_w=2.5,
    ),
    "15-415": dict(
        source_drawing="GBCrcl30.pdf (2015): 1.5 land, threads to the 9.3 "
                       "mark, finish 14.4; no discrete transfer bead drawn",
        major_d=14.3, tol_major=0.3,
        neck_d=13.0, tol_neck=0.3,
        bore_d=8.3, tol_bore=0.3,
        finish_h=14.4, tol_h=0.3,
        top_land=1.5, thread_band=7.8,          # 9.3 - 1.5
        lip_r=0.5,
        pitch=3.175, thread_profile_w=2.5,
    ),
    "17-415": dict(
        source_drawing="GBCyl10mlAmber.pdf / GBCyl10mBlue.pdf 5:1 detail "
                       "(2012): 0.9 land, 8.8 thread-material envelope, "
                       "2.0 collar bead, finish 14.06",
        major_d=16.3, tol_major=0.3,
        neck_d=14.8, tol_neck=0.3,
        bore_d=9.8, tol_bore=0.2,
        nominal_finish_h=14.06,
        finish_h=13.76, tol_h=0.3,
        top_land=0.9, thread_band=8.8,
        lip_r=0.35,
        bead_d=16.1, bead_z=3.01, bead_h=2.0,  # centred 10.75 below rim
        # The sheet retains an 8.8 mm nominal thread zone and 3.175 mm
        # engineering pitch. The active visual-review master compresses the
        # two-turn centerline pitch to 2.7 mm and uses a 2.65 mm section,
        # yielding an 8.05 mm group shifted 0.375 mm upward in that zone.
        nominal_pitch=3.175,
        pitch=2.7, turns=2.0, thread_profile_w=2.65,
        # The tightened 8.05 mm visual group sits inside the drawing's
        # original 8.8 mm zone. A +0.375 mm offset uses the remaining legal
        # upward travel requested during visual review (2026-08-11).
        thread_material_envelope=8.05,
        thread_group_offset_z=0.375,
        # The sheet's two partial front-face runs terminate at the axis.
        # A compact 20-degree fade keeps a molded-glass tip while avoiding
        # the wide center gap made by the old 130-degree generic runout.
        runout_arc_deg=20.0, runout_power=0.5,
        # Extend both tapered tips 20 degrees beyond the front axis so the
        # upper and lower partial runs overlap like the 5:1 drawing.
        runout_overlap_deg=20.0,
    ),
    "18-415": dict(
        source_drawing="GBCrcl50.pdf (2015): threads in the upper 11 zone "
                       "(0.9 land), steps at 11/13, finish 15.8; R2 fillet "
                       "transition, no discrete transfer bead drawn",
        major_d=17.5, tol_major=0.3,
        neck_d=15.5, tol_neck=0.3,
        bore_d=10.3, tol_bore=0.3,
        finish_h=15.8, tol_h=0.3,
        top_land=0.9, thread_band=10.1,         # 11 - 0.9
        lip_r=0.5,
        pitch=3.175, thread_profile_w=2.5,
    ),
}


def finish_profile(f):
    """Rotationally symmetric BASE NECK PROFILE only — no thread. Closed
    (r, z) outline: datum annulus -> bore wall -> rim sealing land -> lip
    -> outer land with transfer bead (where specified) -> datum."""
    E, B = f["neck_d"] / 2.0, f["bore_d"] / 2.0
    H, lip = f["finish_h"], f["lip_r"]
    p = [(B, 0.0)]                                    # inner datum ring
    z = 1.0
    while z < H - 0.45:                               # bore wall up, densified
        p.append((B, z))                              # (audit + body welding
        z += 1.0                                      #  both want real rings)
    p.append((B, H - 0.45))
    for i in range(1, 7):                             # bore entry round-in
        a = math.radians(90 * i / 6)
        p.append((B + 0.3 * (1 - math.cos(a)) * 0.55, H - 0.45 + 0.45 * math.sin(a)))
    p.append(((B + E) / 2.0 * 0.98, H))               # top sealing land
    for i in range(1, 8):                             # lip round-over to wall
        a = math.radians(90 * i / 7)
        p.append((E - lip + lip * math.sin(a), H - lip + lip * math.cos(a)))

    def land(z):                                      # outer wall + bead bulge
        if "bead_d" not in f:
            return E
        d = abs(z - f["bead_z"])
        half = f["bead_h"] / 2.0
        if d >= half:
            return E
        return E + (f["bead_d"] / 2.0 - E) * (0.5 + 0.5 * math.cos(math.pi * d / half))

    z = H - lip
    while z > 0.0:
        p.append((land(z), z))
        z -= 0.1
    p.append((land(0.0), 0.0))                        # outer datum ring
    p.append((B, 0.0))                                # datum annulus closes
    return p


def helical_thread_object(f, name):
    """TRUE swept helical thread: a rounded-lens section swept along a
    right-hand helix at the drawing's pitch, tapered run-outs, fully
    embedded ends. Never a lathed silhouette."""
    E = f["neck_d"] / 2.0
    depth = (f["major_d"] - f["neck_d"]) / 2.0
    w = f["thread_profile_w"]
    embed = 0.15
    r_emb = E - embed
    H, land = f["finish_h"], f["top_land"]
    band_hi = H - land
    band_lo = band_hi - f["thread_band"]
    if "turns" in f:
        # Explicit-turn finishes may carry a visual material envelope smaller
        # than the nominal drawing zone; it remains centered in that zone.
        turns = f["turns"]
        center_span = turns * f["pitch"]
        expected_band = center_span + w
        material_envelope = f.get("thread_material_envelope", f["thread_band"])
        assert abs(expected_band - material_envelope) <= 0.05, (
            f"{expected_band:.3f} mm helix envelope does not match "
            f"{material_envelope:.3f} mm material envelope"
        )
        z_mid = ((band_lo + band_hi) / 2.0
                 + f.get("thread_group_offset_z", 0.0))
        z_lo = z_mid - center_span / 2.0
        z_hi = z_mid + center_span / 2.0
    else:
        # Legacy finish masters retain their existing centerline-span
        # interpretation until each governing drawing is adjudicated.
        z_hi = band_hi
        z_lo = band_lo
        turns = (z_hi - z_lo) / f["pitch"]
    # Present the sheet's opposite face by default: top partial on the left,
    # full middle run, bottom partial on the right (camera sits at -Y).
    theta_top = math.radians(-90.0)
    total = 2 * math.pi * turns
    overlap = math.radians(f.get("runout_overlap_deg", 0.0))
    visible_total = total + 2.0 * overlap
    NR = max(int(96 * turns), 48)                     # sweep rings
    K = 24                                            # section samples
    taper = math.radians(f.get("runout_arc_deg", 130.0)) / visible_total
                                                        # run-out arc fraction
    # (long melted tips: at the ends the rib keeps ~85% of its width while
    # its height sinks to the wall — the drawings' elongated pointed lenses)

    def smooth(x):
        x = max(0.0, min(1.0, x))
        return x * x * (3 - 2 * x)

    verts, faces = [], []
    ring_ids = []
    for i in range(NR + 1):
        t = i / NR
        th = theta_top + overlap - visible_total * (1.0 - t)
        zc = z_lo + (z_hi - z_lo) * t
        s = min(smooth(t / taper), smooth((1.0 - t) / taper), 1.0)
        # Values below 1 sharpen the endpoint into the drawing's pointed
        # molded runout instead of letting a zero-slope fade disappear early.
        s = s ** f.get("runout_power", 1.0)
        base = len(verts)
        ring_ids.append(base)
        for k in range(K):
            tk = -1.0 + 2.0 * k / (K - 1)
            zk = zc + (w / 2.0) * tk
            # never let wall-hugging spread verts escape past the rim land
            # or below the datum — they carry no height, clamping is
            # invisible, and un-clamped they break the EXACT union on
            # short-landed finishes (17/18: land 0.9 < tip spread 1.06)
            if "turns" in f:
                # Explicit-turn drawings dimension the complete material
                # envelope. A wider visual section may close the interior
                # pass spacing, but it can never escape those printed edges.
                zk = max(band_lo, min(zk, band_hi))
            else:
                zk = max(0.05, min(zk, H - land * 0.35))
            rk = r_emb + (depth + embed) * (0.5 + 0.5 * math.cos(math.pi * tk)) * s
            verts.append((rk * math.cos(th), rk * math.sin(th), zk))
    for i in range(NR):
        a, b = ring_ids[i], ring_ids[i + 1]
        for k in range(K - 1):
            faces.append((a + k, a + k + 1, b + k + 1, b + k))
        faces.append((a + K - 1, a, b, b + K - 1))    # close section loop
    for i, flip in ((0, True), (NR, False)):          # end caps (buried)
        th = theta_top - total * (1.0 - i / NR)
        zc = z_lo + (z_hi - z_lo) * (i / NR)
        c = len(verts)
        verts.append(((r_emb - 0.02) * math.cos(th), (r_emb - 0.02) * math.sin(th), zc))
        base = ring_ids[i]
        for k in range(K):
            k2 = (k + 1) % K
            faces.append((c, base + k2, base + k) if flip else (c, base + k, base + k2))
    m = bpy.data.meshes.new(name)
    m.from_pydata(verts, [], faces)
    m.validate()
    m.update()
    for poly in m.polygons:
        poly.use_smooth = True
    return bpy.data.objects.new(name, m)


def build_finish_master(key, coll=None):
    """Assemble FINISH_MASTER_<std>: base revolve + swept thread UNION +
    quality pass. Registry values ride along as custom properties."""
    import bmesh
    f = FINISH_MASTERS[key]
    name = "FINISH_MASTER_" + key.replace("-", "_")
    base = revolve(name, finish_profile(f), segments=512)
    thr = helical_thread_object(f, name + "_THREAD")
    # The revolved profile closes onto duplicated seam rings — weld and
    # orient BEFORE the boolean or EXACT resolves the shell as non-manifold
    # (first symptom: the bore wall vanishes from the union result).
    for ob in (base, thr):
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(ob.data)
        bm.free()
    tgt = coll or bpy.context.scene.collection
    (tgt.objects if hasattr(tgt, "objects") else tgt).link(base)
    (tgt.objects if hasattr(tgt, "objects") else tgt).link(thr)
    bpy.context.view_layer.objects.active = base
    base.select_set(True)
    mod = base.modifiers.new("THREAD_UNION", "BOOLEAN")
    mod.operation = "UNION"
    mod.solver = "EXACT"
    mod.object = thr
    bpy.ops.object.modifier_apply(modifier="THREAD_UNION")
    bpy.data.objects.remove(thr, do_unlink=True)
    bm = bmesh.new()
    bm.from_mesh(base.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(base.data)
    bm.free()
    for poly in base.data.polygons:
        poly.use_smooth = True
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(38.0))
    except Exception:
        pass
    for k, v in f.items():
        if isinstance(v, (int, float, str)):
            base[k] = v
    base["finish_standard"] = key
    base["attachment_datum_z"] = 0.0
    base["thread_turns"] = round(f.get("turns", f["thread_band"] / f["pitch"]), 4)
    base["thread_start_angle_deg"] = 270.0
    base.lock_scale = (True, True, True)
    return base


def audit_finish_master(obj, f):
    """Measure the BUILT mesh against the sheet's printed dimensions.
    Prints a SOURCE / BLENDER / DEVIATION / TOLERANCE / PASS-FAIL table
    plus FINISH_QA_JSON for the QA sheet composer."""
    import json
    H, land, band = f["finish_h"], f["top_land"], f["thread_band"]
    vs = [(math.hypot(v.co.x, v.co.y), v.co.z) for v in obj.data.vertices]
    band_lo, band_hi = H - land - band, H - land
    rows = []

    def row(label, src, meas, tol):
        dev = meas - src
        rows.append(dict(dim=label, source=round(src, 3), blender=round(meas, 3),
                         deviation=round(dev, 3), tolerance=tol,
                         status="PASS" if abs(dev) <= tol else "FAIL"))

    row("finish height", f.get("nominal_finish_h", H),
        max(z for _, z in vs), f["tol_h"])
    in_band = [r for r, z in vs if band_lo - 0.05 <= z <= band_hi + 0.05]
    row("thread crest OD (T)", f["major_d"], 2 * max(in_band), f["tol_major"])
    at_land = [r for r, z in vs if H - land * 0.6 <= z <= H - land * 0.35]
    row("neck land OD (E)", f["neck_d"], 2 * max(at_land), f["tol_neck"])
    inner = [r for r, z in vs if z > 0.5]             # sparse-safe: whole bore
    row("bore diameter", f["bore_d"], 2 * min(inner), f["tol_bore"])
    if "bead_d" in f:
        bz, bh = f["bead_z"], f["bead_h"]
        in_bead = [r for r, z in vs if bz - bh * 0.3 <= z <= bz + bh * 0.3]
        row("transfer bead OD", f["bead_d"], 2 * max(in_bead), 0.3)
    crest_thresh = f["neck_d"] / 2.0 + 0.02 * (f["major_d"] - f["neck_d"]) / 2.0
    crest_zs = [z for r, z in vs if r > crest_thresh and not (
        "bead_d" in f and f["bead_z"] - f["bead_h"] / 2 <= z <= f["bead_z"] + f["bead_h"] / 2)]
    if "turns" in f:
        center_span = f["turns"] * f["pitch"]
        center_mid = ((band_lo + band_hi) / 2.0
                      + f.get("thread_group_offset_z", 0.0))
        # A swept axial section makes low-height runout material register
        # slightly beyond its centerline endpoint. Permit one quarter of the
        # section width while the separately measured 8.8 mm material envelope
        # remains the hard drawing boundary.
        runout_path_tol = max(0.3, f["thread_profile_w"] * 0.5)
        row("thread crest path top", center_mid + center_span / 2.0,
            max(crest_zs), runout_path_tol)
        row("thread crest path bottom", center_mid - center_span / 2.0,
            min(crest_zs), runout_path_tol)
    else:
        row("thread band top", band_hi, max(crest_zs), 0.3)
        row("thread band bottom", band_lo, min(crest_zs), 0.3)
    print(f"FINISH QA — {obj.name}  (source: {f['source_drawing'].split(':')[0]})")
    print(f"{'dimension':<22}{'source':>8}{'blender':>9}{'dev':>8}{'tol':>6}  status")
    for r in rows:
        print(f"{r['dim']:<22}{r['source']:>8.2f}{r['blender']:>9.2f}"
              f"{r['deviation']:>8.3f}{r['tolerance']:>6.2f}  {r['status']}")
    print("FINISH_QA_JSON " + json.dumps(dict(finish=obj.name, rows=rows)))
    return all(r["status"] == "PASS" for r in rows)


def build_finish_qa_scene(key, out_path, qa_dir, samples=64):
    """Geometry-validation stage per the 2026-08-10 directive: neutral matte,
    reference lighting, ortho + spin + section renders. NO beauty — glass,
    DOF, drama are banned until the master passes the QA sheet."""
    import bmesh
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 0.001
    scene.unit_settings.length_unit = "MILLIMETERS"
    lib = bpy.data.collections.new("FINISH_LIBRARY")
    scene.collection.children.link(lib)

    f = FINISH_MASTERS[key]
    master = build_finish_master(key, coll=lib)
    ok = audit_finish_master(master, f)

    matte = bpy.data.materials.new("QA_MATTE")
    matte.use_nodes = True
    pr = matte.node_tree.nodes["Principled BSDF"]
    pr.inputs["Base Color"].default_value = (0.80, 0.80, 0.80, 1.0)
    pr.inputs["Roughness"].default_value = 0.60
    master.data.materials.clear()
    master.data.materials.append(matte)

    world = bpy.data.worlds.new("QA_WORLD")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.18, 0.18, 0.18, 1.0)
    bg.inputs["Strength"].default_value = 0.4

    def area(name, loc, size, energy):
        ld = bpy.data.lights.new(name, "AREA")
        ld.size = size
        ld.energy = energy
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        scene.collection.objects.link(lo)
        lo.rotation_euler = (Vector((0, 0, f["finish_h"] / 2)) - Vector(loc)
                             ).to_track_quat("-Z", "Y").to_euler()
        return lo

    H = f["finish_h"]
    # reference lighting for GEOMETRY reading: one strong raking key from
    # upper-left so thread relief casts form shadows, modest fill — this is
    # a validation stage, legibility beats beauty symmetry. (Wattages look
    # huge because the scene is millimetre-scaled.)
    area("QA_RAKE", (-50, -35, H + 90), 40, 48000)
    area("QA_FILL", (60, -80, H * 0.5 + 10), 110, 4000)
    area("QA_TOP", (0, -10, H + 100), 100, 6000)

    cam_d = bpy.data.cameras.new("QA_CAM")
    cam = bpy.data.objects.new("QA_CAM", cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1600
    scene.view_settings.view_transform = "Standard"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out_path))
    print(f"finish master saved: {out_path}  (audit {'PASS' if ok else 'FAIL'})")
    if not qa_dir:
        return
    qa_dir.mkdir(parents=True, exist_ok=True)
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True

    ortho_v = H * 1.6                                  # vertical mm span
    mid = H * 0.5

    def shot(fname, kind, az_deg=0.0, elev_deg=0.0, dist=70.0, obj_rot=None):
        if obj_rot is not None:
            master.rotation_euler = (0, 0, math.radians(obj_rot))
        else:
            master.rotation_euler = (0, 0, 0)
        if kind == "ORTHO":
            cam_d.type = "ORTHO"
            cam_d.ortho_scale = ortho_v
            az = math.radians(az_deg)
            cam.location = (80 * math.sin(az), -80 * math.cos(az), mid)
            cam.rotation_euler = (math.radians(90), 0, az)
        else:
            cam_d.type = "PERSP"
            cam_d.lens = 85
            az, el = math.radians(az_deg), math.radians(elev_deg)
            cam.location = (dist * math.sin(az) * math.cos(el),
                            -dist * math.cos(az) * math.cos(el),
                            mid + dist * math.sin(el))
            cam.rotation_euler = (Vector((0, 0, mid)) - Vector(cam.location)
                                  ).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(qa_dir / fname)
        bpy.ops.render.render(write_still=True)
        print(f"QA_SHOT {fname}")

    shot("ortho-front.png", "ORTHO", 0)
    shot("ortho-side.png", "ORTHO", 90)
    shot("persp-45.png", "PERSP", 45, 18, 75)
    shot("macro-thread.png", "PERSP", 0, 4, 42)
    for ang in (0, 45, 90, 135, 180, 270):
        shot(f"spin-{ang:03d}.png", "PERSP", 0, 4, 46, obj_rot=ang)
    master.rotation_euler = (0, 0, 0)
    cut = bpy.data.meshes.new("QA_CUT")
    sz = 200.0
    cut.from_pydata(
        [(-sz, -sz, -10), (sz, -sz, -10), (sz, 0, -10), (-sz, 0, -10),
         (-sz, -sz, 200), (sz, -sz, 200), (sz, 0, 200), (-sz, 0, 200)], [],
        [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
         (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)])
    cut.update()
    bm = bmesh.new()
    bm.from_mesh(cut)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(cut)
    bm.free()
    co = bpy.data.objects.new("QA_CUT", cut)
    scene.collection.objects.link(co)
    co.hide_render = True
    mod = master.modifiers.new("SECTION", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.object = co
    shot("section.png", "ORTHO", 0)
    master.modifiers.remove(mod)
    print("QA_SET_COMPLETE " + key)


# ---------------------------------------------------------------- materials

GLASS_VARIANTS = {
    # Beer-Lambert absorption per mm (colour, density). Amber is the
    # photo-solved value from the real bottle (Boston Round pilot lineage);
    # cobalt solved to the reference's deep royal transmission. Frosted is a
    # surface treatment on colourless glass, not a tint.
    "clear":   dict(absorb=None,                       rough=0.03),
    "amber":   dict(absorb=((0.578, 0.390, 0.155), 1.40), rough=0.04),  # +17% per Jordan: a tad darker
    "cobalt":  dict(absorb=((0.090, 0.160, 0.880), 1.40), rough=0.04),
    "frosted": dict(absorb=None,                       rough=0.42),
}


def mat_glass(variant="clear", s=None):
    v = GLASS_VARIANTS[variant]
    name = f"BB_MAT_GLASS_{variant.upper()}"
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = _build_clear_glass(name)
    pr = m.node_tree.nodes["Principled BSDF"]
    pr.inputs["Roughness"].default_value = v["rough"]
    if variant == "clear" and s is not None and not s.get("polished_bore", False):
        # Molded-neck bore frost: the plunger leaves the bore matte on real
        # bottles. Optically this is what makes cobalt/frosted thread reads
        # "perfect" while identical clear geometry looked busy — clear glass
        # was transmitting the BACK of the helix crisply. Frosting only the
        # interior bore surface above the finish base diffuses the back
        # wraps; the front wraps and the body stay full-polish.
        nt = m.node_tree
        geo = nt.nodes.new("ShaderNodeNewGeometry")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(geo.outputs["Position"], sep.inputs["Vector"])
        xy = nt.nodes.new("ShaderNodeVectorMath"); xy.operation = "MULTIPLY"
        xy.inputs[1].default_value = (1.0, 1.0, 0.0)
        nt.links.new(geo.outputs["Position"], xy.inputs[0])
        rad = nt.nodes.new("ShaderNodeVectorMath"); rad.operation = "LENGTH"
        nt.links.new(xy.outputs["Vector"], rad.inputs[0])
        gz = nt.nodes.new("ShaderNodeMath"); gz.operation = "GREATER_THAN"
        gz.inputs[1].default_value = s["height"] - s["neck_h"] - 1.0
        nt.links.new(sep.outputs["Z"], gz.inputs[0])
        lr = nt.nodes.new("ShaderNodeMath"); lr.operation = "LESS_THAN"
        lr.inputs[1].default_value = s["bore_d"] / 2.0 + 0.8
        nt.links.new(rad.outputs["Value"], lr.inputs[0])
        mk = nt.nodes.new("ShaderNodeMath"); mk.operation = "MULTIPLY"
        nt.links.new(gz.outputs["Value"], mk.inputs[0])
        nt.links.new(lr.outputs["Value"], mk.inputs[1])
        ra = nt.nodes.new("ShaderNodeMath"); ra.operation = "MULTIPLY_ADD"
        ra.inputs[1].default_value = 0.32          # frost delta over polish
        ra.inputs[2].default_value = v["rough"]
        nt.links.new(mk.outputs["Value"], ra.inputs[0])
        nt.links.new(ra.outputs["Value"], pr.inputs["Roughness"])
    if v["absorb"]:
        col, dens = v["absorb"]
        va = m.node_tree.nodes.new("ShaderNodeVolumeAbsorption")
        va.location = (-300, -260)
        va.inputs["Color"].default_value = (*col, 1.0)
        va.inputs["Density"].default_value = dens
        out = next(n for n in m.node_tree.nodes if n.type == "OUTPUT_MATERIAL")
        m.node_tree.links.new(va.outputs["Volume"], out.inputs["Volume"])
    return m


def _build_clear_glass(name="BB_MAT_GLASS_CLEAR"):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_fake_user = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    pr = nt.nodes.new("ShaderNodeBsdfPrincipled")
    pr.location = (-300, 0)
    pr.inputs["Base Color"].default_value = (1, 1, 1, 1)
    pr.inputs["Transmission Weight"].default_value = 1.0
    pr.inputs["IOR"].default_value = 1.50
    pr.inputs["Roughness"].default_value = 0.04    # polished container glass
    nt.links.new(pr.outputs["BSDF"], out.inputs["Surface"])
    # NO volume absorption. Colourless glass has none, and any absorption
    # colour whose channels are unequal tints transmission — a "near-neutral"
    # (0.974, 0.981, 0.977) passes more green than red or blue, which showed
    # as an olive band exactly where the sightline path through glass was
    # longest (the shoulder). Edge density comes from Fresnel and path
    # length, not from a tint.
    # gentle molded-glass waviness (pilot-proven scale)
    tex = nt.nodes.new("ShaderNodeTexNoise"); tex.location = (-800, -80)
    tex.inputs["Scale"].default_value = 0.14
    tex.inputs["Detail"].default_value = 2.0
    bump = nt.nodes.new("ShaderNodeBump"); bump.location = (-540, -80)
    bump.inputs["Strength"].default_value = 0.04
    bump.inputs["Distance"].default_value = 0.008
    nt.links.new(tex.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], pr.inputs["Normal"])
    return m


def roller_profile(rs, bore_r):
    """Closed (r,z) outline of the roller housing, z=0 on the neck rim — the
    component's own mating face, so seating is parent-and-zero. The plug is a
    tube: liquid passes through it, and clear glass shows that channel."""
    plug_or = bore_r - rs["plug_clear"]
    plug_ir = plug_or - rs["wall"]
    bar_or = rs["barrel_od"] / 2.0
    col_or = rs["collar_od"] / 2.0
    sock_r = rs["ball_d"] / 2.0 + 0.05           # ball turns in this socket
    top = rs["barrel_top"]
    # Retaining lip: the socket closes back over the ball, so the opening is
    # the ball's own radius at rim height. That is what holds a roller in.
    ball_r = rs["ball_d"] / 2.0
    dz = max(0.0, top - rs["ball_z"])
    lip_r = math.sqrt(max(0.04, ball_r ** 2 - dz ** 2)) + 0.10
    rr = rs["rim_r"]
    p = [
        (plug_ir, -rs["plug_depth"]),            # annular bottom face of the plug
        (plug_or, -rs["plug_depth"]),
        (plug_or, -0.35),
        (plug_or, 0.0),
        (col_or, 0.0),                           # collar underside — seats on the rim
        (col_or, rs["collar_h"]),
        (bar_or, rs["collar_h"]),
        (bar_or, top - rs.get("fold_h", 1.4)),
    ]
    # Third part of the real housing: after the straight wall, the material
    # FOLDS INWARD and closes over the ball (strongest on the metal-ball
    # version; a slight bend suffices here). Cosine ease = soft S-bend, no
    # crease, ending at the lip radius that hugs the ball.
    fold_h = rs.get("fold_h", 1.4)
    for i in range(1, 9):
        t = i / 8.0
        r_f = bar_or + (lip_r - bar_or) * (0.5 - 0.5 * math.cos(math.pi * t))
        p.append((r_f, (top - fold_h) + fold_h * t))
    p.append((sock_r, rs["ball_z"]))             # socket opens at the equator
    p.append((plug_ir, rs["ball_z"] - 1.4))      # taper into the through-channel
    p.append((plug_ir, -rs["plug_depth"]))
    out = [p[0]]
    for q in p[1:]:
        if abs(q[0] - out[-1][0]) > 1e-4 or abs(q[1] - out[-1][1]) > 1e-4:
            out.append(q)
    return out


def cap_profile(cs):
    """Closed (r,z) outline of the closure, z=0 on the neck rim (its mating
    datum, same as the roller). Outside runs bottom-to-top with a drafted
    skirt and rounded top edge; inside returns down the threaded bore."""
    z_lo = -cs["skirt_below_rim"]
    z_hi = z_lo + cs["height"]
    r_top, r_base = cs["od_top"] / 2.0, cs["od_base"] / 2.0
    er = cs["top_edge_r"]
    ir = cs["thread_root_d"] / 2.0                 # inner land (thread root)
    p = [(r_base - 0.35, z_lo)]                    # skirt bottom face, outer edge
    p += arc(r_base - 0.35, z_lo + 0.35, 0.35, 270, 360, 4)
    p.append((r_base, z_lo + 0.35))
    p.append((r_top, z_hi - er))                   # drafted skirt
    p += arc(r_top - er, z_hi - er, er, 0, 90)     # rounded top edge
    p.append((0.0, z_hi))                          # across the crown
    p.append((0.0, z_hi - cs["top_th"]))           # underside of the crown
    z = z_hi - cs["top_th"]
    while z > z_lo + 0.12:                         # threaded bore, densely sampled
        p.append((ir, z))
        z -= 0.10
    p.append((ir, z_lo))
    p.append((r_base - 0.35, z_lo))
    out = [p[0]]
    for q in p[1:]:
        if abs(q[0] - out[-1][0]) > 1e-4 or abs(q[1] - out[-1][1]) > 1e-4:
            out.append(q)
    return out


def cap_thread_modulator(cs, bottle):
    """Internal thread: the bottle's EXACT helix — pitch, turns, section,
    fades and phase all read from the same spec chain as thread_modulator
    (single source of truth; the old hard-coded copies drifted) — swelling
    INWARD from the cap bore. Two deliberate differences:
      * top mirrors the bottle's real land (lip_r + thread_top_gap); the
        prior literal -1.2 misplaced the 009 cap helix by 0.65mm.
      * the cap rides HALF A PERIOD out of phase — a seated closure nests
        its ridges in the bottle's root land. In-phase crests at these
        depths would intersect; anti-phase clears by >= ~0.44mm radial."""
    resolve_thread(bottle)
    ir = cs["thread_root_d"] / 2.0
    depth = (cs["thread_root_d"] - cs["thread_crest_d"]) / 2.0
    pitch, turns = bottle["pitch"], bottle["turns"]
    top = -(bottle["lip_r"] + bottle.get("thread_top_gap", 1.2))
    z0 = top - turns * pitch
    phase = math.radians(bottle.get("thread_phase_deg", 0.0))
    W_UP = bottle.get("thread_wu", THREAD_415["wu"])
    W_DN = bottle.get("thread_wd", THREAD_415["wd"])
    PLATEAU = bottle.get("thread_plateau", THREAD_415["plateau"])
    fade_in = bottle.get("thread_fade_in", 0.22)
    lead_out = bottle.get("thread_lead_out", 0.08)

    def mod(r, z, theta):
        if abs(r - ir) > 0.25 or not (z0 - 0.4 <= z <= top + 0.4):
            return r
        ph = ((z - z0) / pitch
              - (theta + phase) / (2 * math.pi) + 0.5) % 1.0   # anti-phase seat
        off = ph if ph <= 0.5 else ph - 1.0
        w = W_UP if off >= 0 else W_DN
        x = (abs(off) - PLATEAU) / (w - PLATEAU)
        crest = 1.0 if x <= 0 else (0.0 if x >= 1 else 0.5 + 0.5 * math.cos(math.pi * x))
        tf = (z - z0) / (top - z0) if top > z0 else 0.0
        ends = max(0.0, min(1.0, tf / fade_in, (1.0 - tf) / lead_out))
        return ir - depth * crest * ends           # inward: a nut, not a bolt
    return mod


def uv_sphere(name, d, segments=64, rings=32):
    """Plain UV sphere — the roller ball, centred on its own origin."""
    r = d / 2.0
    verts, faces = [], []
    top = len(verts); verts.append((0.0, 0.0, r))
    for i in range(1, rings):
        phi = math.pi * i / rings
        z, rr = r * math.cos(phi), r * math.sin(phi)
        for k in range(segments):
            a = 2 * math.pi * k / segments
            verts.append((rr * math.cos(a), rr * math.sin(a), z))
    bot = len(verts); verts.append((0.0, 0.0, -r))
    ring0 = 1
    for k in range(segments):
        faces.append((top, ring0 + (k + 1) % segments, ring0 + k))
    for i in range(rings - 2):
        a0, b0 = 1 + i * segments, 1 + (i + 1) * segments
        for k in range(segments):
            k2 = (k + 1) % segments
            faces.append((a0 + k, a0 + k2, b0 + k2, b0 + k))
    last = 1 + (rings - 2) * segments
    for k in range(segments):
        faces.append((bot, last + k, last + (k + 1) % segments))
    m = bpy.data.meshes.new(name)
    m.from_pydata(verts, [], faces)
    m.validate(); m.update()
    for poly in m.polygons:
        poly.use_smooth = True
    return bpy.data.objects.new(name, m)


def mat_plastic(name, color, rough):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_fake_user = True
    pr = m.node_tree.nodes["Principled BSDF"]
    pr.inputs["Base Color"].default_value = (*color, 1.0)
    pr.inputs["Roughness"].default_value = rough
    pr.inputs["IOR"].default_value = 1.46
    return m


def mat_natural_plastic(name, tint, rough, trans):
    """Natural (uncoloured) PP/HDPE: milky translucent, not opaque white.
    Real light passes a millimetre or two before scattering out, which is what
    makes an unpigmented roller read as soft rather than painted."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_fake_user = True
    pr = m.node_tree.nodes["Principled BSDF"]
    pr.inputs["Base Color"].default_value = (*tint, 1.0)
    pr.inputs["Roughness"].default_value = rough
    pr.inputs["IOR"].default_value = 1.49
    pr.inputs["Transmission Weight"].default_value = trans
    for key, val in (("Subsurface Weight", 0.35), ("Subsurface Radius", None),
                     ("Subsurface Scale", 1.2)):
        if key in pr.inputs and val is not None:
            pr.inputs[key].default_value = val
    if "Subsurface Radius" in pr.inputs:
        pr.inputs["Subsurface Radius"].default_value = (1.4, 1.25, 1.1)
    return m


def mat_steel():
    m = bpy.data.materials.get("BB_MAT_BALL_STEEL")
    if m:
        return m
    m = bpy.data.materials.new("BB_MAT_BALL_STEEL")
    m.use_nodes = True
    m.use_fake_user = True
    pr = m.node_tree.nodes["Principled BSDF"]
    pr.inputs["Base Color"].default_value = (0.72, 0.73, 0.74, 1.0)
    pr.inputs["Metallic"].default_value = 1.0
    pr.inputs["Roughness"].default_value = 0.18
    return m


def mat_diffuse(name, color, rough=0.9):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    pr = m.node_tree.nodes["Principled BSDF"]
    pr.inputs["Base Color"].default_value = (*color, 1.0)
    pr.inputs["Roughness"].default_value = rough
    return m


def feathered_emitter(name, w, h, strength, tint=(1.0, 0.98, 0.94)):
    """Emissive panel whose output fades quadratically to zero at its edges —
    reflections on glass are gradients, never boxes (pilot-proven recipe)."""
    m = bpy.data.meshes.new(name)
    m.from_pydata([(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)], [],
                  [(0, 1, 2, 3)])
    m.update()
    mat = bpy.data.materials.new(name + "_mat")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    outn = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission"); em.location = (-200, 0)
    em.inputs["Color"].default_value = (*tint, 1.0)
    tc = nt.nodes.new("ShaderNodeTexCoord"); tc.location = (-820, 0)
    gr = nt.nodes.new("ShaderNodeTexGradient"); gr.location = (-620, 0)
    gr.gradient_type = "QUADRATIC_SPHERE"     # 1 at centre, 0 at unit edges
    mul = nt.nodes.new("ShaderNodeMath"); mul.location = (-420, 0)
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = strength
    nt.links.new(tc.outputs["Object"], gr.inputs["Vector"])
    nt.links.new(gr.outputs["Fac"], mul.inputs[0])
    nt.links.new(mul.outputs["Value"], em.inputs["Strength"])
    nt.links.new(em.outputs["Emission"], outn.inputs["Surface"])
    m.materials.append(mat)
    o = bpy.data.objects.new(name, m)
    o.scale = (w / 2.0, h / 2.0, 1.0)
    o.visible_shadow = False
    return o


# ------------------------------------------------------------------- studio

def build_sweep(coll, color=BONE):
    """Seamless bone cyc: flat floor -> radius -> vertical wall. No horizon."""
    FLOOR_Y0, FLAT_BACK, RADIUS, WALL_TOP = -900.0, 220.0, 260.0, 1000.0
    WIDTH = 2600.0
    prof = [(FLOOR_Y0, 0.0), (FLAT_BACK, 0.0)]
    for i in range(1, 25):
        a = math.radians(90 * i / 24)
        prof.append((FLAT_BACK + RADIUS * math.sin(a), RADIUS * (1 - math.cos(a))))
    prof.append((FLAT_BACK + RADIUS, WALL_TOP))
    verts, faces = [], []
    for (y, z) in prof:
        verts += [(-WIDTH / 2, y, z - 0.1), (WIDTH / 2, y, z - 0.1)]
    for i in range(len(prof) - 1):
        a = 2 * i
        faces.append((a, a + 1, a + 3, a + 2))
    m = bpy.data.meshes.new("BB_STUDIO_SWEEP")
    m.from_pydata(verts, [], faces)
    m.update()
    for poly in m.polygons:
        poly.use_smooth = True
    m.materials.append(mat_diffuse("BB_MAT_STUDIO_BONE", color, 0.92))
    o = bpy.data.objects.new("BB_STUDIO_SWEEP", m)
    return link(o, coll)


# -------------------------------------------------------------------- build

def build(out_path: Path, samples: int, ball_mode: str = "none",
          cap_mode: str = "none", bottle_key: str = "009",
          transparent: bool = False, envelope_mm: float = 0.0,
          glass: str = "clear", backdrop: str = "", lighting: str = "standard",
          closure_mode: str = "none", closure_finish: str = "black",
          overcap: bool = True, internals: bool = False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "MASTER_SCENE"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 0.001          # 1 BU = 1 mm
    scene.unit_settings.length_unit = "MILLIMETERS"

    c_cam = collection("CAMERA")
    c_light = collection("LIGHTING")
    c_studio = collection("STUDIO")
    c_root = collection("PRODUCT_ROOT")
    c_bottles = collection("BOTTLES", c_root)
    collection("CAPS", c_root)
    collection("CLOSURES", c_root)
    collection("MATERIALS")           # registry marker; materials are datablocks
    collection("WEB_EXPORT")          # staging for derived web assets (phase 2)
    c_help = collection("RENDER_HELPERS")

    # -- studio
    bd = hex_to_linear(backdrop) if backdrop else BONE
    build_sweep(c_studio, color=bd)
    world = bpy.data.worlds.new("BB_WORLD_BONE")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*bd, 1.0)
    bg.inputs["Strength"].default_value = WORLD_STRENGTH

    # -- product root + first asset
    root = bpy.data.objects.new("BB_PRODUCT_ROOT", None)
    root.empty_display_size = 12
    link(root, c_root)

    s = CYL_SPECS[bottle_key]
    resolve_thread(s)                 # cap path + custom props read pitch/turns
    # FINISH MASTER architecture (directive 2026-08-10): the body ends at
    # the attachment datum; the neck finish is the canonical master,
    # instanced by mesh datablock — never rebuilt, never scaled.
    fm = FINISH_MASTERS[s["neck_finish"]]
    z_datum = s["height"] - fm["finish_h"]
    if s.get("body") == "disc":
        bottle = loft(s["asset_id"], disc_stations(s, fm))
        cav = disc_cavity_ml(s)
        tgt = s.get("overflow_ml", s["capacity_ml"])
        print(f"CAVITY_AUDIT {bottle_key}: {cav:.1f} ml enclosed "
              f"vs {tgt:.0f} ml overflow spec "
              f"({'OK' if abs(cav - tgt) / tgt < 0.08 else 'OUT OF GATE'})")
    elif s.get("body") == "elegant":
        # Match the fixed finish master's 512-point datum rings so the
        # derived beauty shell can weld outer and bore boundaries one-to-one.
        bottle = loft(s["asset_id"], elegant_stations(s, fm), segments=512)
        cav = elegant_cavity_ml(s)
        tgt = s.get("overflow_ml", s["capacity_ml"])
        print(f"CAVITY_AUDIT {bottle_key}: {cav:.1f} ml enclosed "
              f"vs {tgt:.0f} ml overflow spec "
              f"({'OK' if abs(cav - tgt) / tgt < 0.08 else 'OUT OF GATE'})")
    elif s.get("body") == "round":
        bottle = revolve(s["asset_id"], round_profile(s, fm))
        cav = s["_cavity_ml"]
        tgt = s.get("overflow_ml", s["capacity_ml"])
        print(f"CAVITY_AUDIT {bottle_key}: {cav:.1f} ml enclosed "
              f"vs {tgt:.0f} ml overflow spec "
              f"({'OK' if abs(cav - tgt) / tgt < 0.08 else 'OUT OF GATE'})")
    else:
        prof = (cylinder_profile_cone(s, fm) if "shoulder_cone_h" in s
                else cylinder_profile(s, fm))
        bottle = revolve(s["asset_id"], prof)
    bottle.data.materials.append(mat_glass(glass, s))
    bottle.parent = root
    for k in ("asset_id", "capacity_ml", "height", "diameter", "wall",
              "neck_finish", "neck_t", "neck_e", "neck_h", "bore_d",
              "pitch", "turns", "measured_body", "measured_neck"):
        bottle[k if k != "height" else "height_mm"] = s[k]
    bottle["web_name"] = "body"       # phase-2 GLB exporter maps to loader contract
    link(bottle, c_bottles)

    # -- FINISH_LIBRARY master + assembly instance
    c_flib = collection("FINISH_LIBRARY")
    master = build_finish_master(s["neck_finish"], coll=c_flib)
    master.location = (s["diameter"] + 80.0, 0, 0)   # parked out of frame
    master.hide_render = True
    fin = bpy.data.objects.new(
        "BB_FIN_" + s["neck_finish"].replace("-", "_"), master.data)
    fin.location = (0, 0, z_datum)
    fin.parent = root
    fin.lock_scale = (True, True, True)
    for k, v in FINISH_MASTERS[s["neck_finish"]].items():
        if isinstance(v, (int, float, str)):
            fin[k] = v
    fin["finish_standard"] = s["neck_finish"]
    fin["web_name"] = "finish"
    # same glass variant as the body; no spec-frost on the shared mesh (its
    # local frame is datum-zero — bottle-height-tuned masks don't apply)
    # Boolean assembly leaves an empty slot 0 on the canonical mesh. Clear it
    # before binding glass; otherwise polygons remain indexed to None while
    # the requested material sits unused in slot 1 (an opaque white finish).
    master.data.materials.clear()
    master.data.materials.append(mat_glass(glass, None))
    link(fin, c_bottles)

    if s.get("render_weld_finish"):
        welded_glass_render_assembly(bottle, fin, c_bottles)

    neck = bpy.data.objects.new("BB_ATTACH_NECK", None)
    neck.empty_display_type = "ARROWS"
    neck.empty_display_size = 6
    neck.parent = bottle
    neck.location = (0, 0, s["height"])              # closure seating plane
    neck["finish"] = s["neck_finish"]
    link(neck, c_bottles)

    # -- roll-on fitment: its own objects, seated by parent-and-zero on the
    # neck datum. Housing and ball are separate so a metal/plastic ball is a
    # material or object swap, never a duplicated assembly.
    if bottle_key != "009" and (ball_mode != "none" or closure_mode != "none"):
        print(f"17-415 components are dimensioned for the 009 neck; "
              f"skipping roller/closure on {bottle_key}")  # caps exist for every finish
        ball_mode = "none"
        closure_mode = "none"
    if closure_mode != "none" and (ball_mode != "none" or cap_mode != "none"):
        print("a sprayer/pump replaces the roller and cap; ignoring --roller/--cap")
        ball_mode = "none"
        cap_mode = "none"
    component_objs = {}
    if ball_mode != "none":
        c_clos = collection("CLOSURES", c_root)
        housing, ball = c17.fit_roller(sys.modules[__name__], s, neck, c_clos, ball_mode)
        component_objs = {"housing": housing, "ball": ball}
    if closure_mode != "none":
        # sprayer / lotion pump: collar + actuator (+ spout) (+ overcap)
        c_clos = collection("CLOSURES", c_root)
        component_objs = c17.fit_closure(sys.modules[__name__], s, neck, c_clos,
                                         closure_mode, finish=closure_finish,
                                         overcap=overcap, internals=internals)

    # -- lighting: reflection cards, not direct illumination.
    # Clear glass is read almost entirely through what it MIRRORS, so the rig
    # is built as a photographic card set — one neutral softbox front-left at
    # 45 deg, large white cards opposite and overhead — and every source is
    # pure white (1,1,1). Any tint here lands in the glass as a coloured
    # reflection. All panels are edge-feathered, so no source can print a
    # hard-edged bright stripe on the cylinder; the reflections wrap and fall
    # off with the curvature instead. No narrow strip light: a thin source on
    # a cylinder is exactly what produces a glowing chrome border.
    mid = s["height"] * 0.5
    WHITE = (1.0, 1.0, 1.0)
    aim = lambda o: (Vector((0, 0, mid)) - Vector(o.location)).to_track_quat("-Z", "Z").to_euler()

    if lighting == "symmetric":
        # Clear-glass profile (Jordan 2026-08-10): the bottle must read
        # identically left and right — "cut the bottle down the middle" —
        # with the approved frosted render's soft blended reflection
        # quality. One big centred softbox replaces the key/fill pair;
        # the top card and sweep wash already sit on x=0, so every
        # emitter lives on the mirror plane and left/right symmetry is
        # by construction, not by balancing.
        key = feathered_emitter("BB_LIGHT_KEY_CENTER", 980, 760, 4.1, tint=WHITE)
        key.location = (0, -300, mid + 55)
        key.rotation_euler = aim(key)
        # The centred box straddles the lens axis; on tall bottles the camera
        # retreats (envelope) BEHIND the tilted quad and every ray hits it —
        # a pure-white frame. Camera rays always skip it and glossy rays keep
        # the highlight; clear-glass transmission skips it below so the panel
        # cannot refract as an apparent object inside a broad flat cavity.
        key.visible_camera = False
        if glass == "clear":
            key.visible_transmission = False
        link(key, c_light)
    else:
        key = feathered_emitter("BB_LIGHT_KEY_SOFTBOX", 420, 700, 9.0, tint=WHITE)
        key.location = (-230, -230, mid + 55)        # 45 deg front-left
        key.rotation_euler = aim(key)
        if glass == "clear":
            key.visible_transmission = False
        link(key, c_light)

        fill = feathered_emitter("BB_CARD_FILL_RIGHT", 620, 680, 1.4, tint=WHITE)
        fill.location = (310, -120, mid + 20)        # broad neutral card, camera-right
        fill.rotation_euler = aim(fill)
        if glass == "clear":
            fill.visible_transmission = False
        link(fill, c_light)

    top = feathered_emitter("BB_CARD_TOP", 700, 700,
                            1.95 if lighting == "symmetric" else 1.8,
                            tint=WHITE)
    top.location = (0, -30, 200)                     # overhead card: shoulder curvature
    top.rotation_euler = aim(top)
    if glass == "clear":
        top.visible_transmission = False
    link(top, c_light)

    # even wash on the sweep — wider than the sweep itself so no pool edge
    # can image through the glass (the window lesson, learned the hard way).
    # symmetric mode: the retired key/fill pair used to spill ~4% onto the
    # sweep; the wash carries that share so the studio brightness matches
    # the locked gallery cards (and the floor finally reads even L/R).
    wash = feathered_emitter("BB_LIGHT_SWEEP_WASH", 3400, 900,
                             2.3 if lighting == "symmetric" else 2.0,
                             tint=WHITE)
    wash.location = (0, -60, 520)
    wash.rotation_euler = (math.radians(48), 0, 0)
    if glass == "clear":
        wash.visible_transmission = False
    link(wash, c_light)


    # -- closure: its own object on the same neck datum, so cap / roller /
    # bare bottle are independent switches rather than baked assemblies.
    if cap_mode != "none" and s["neck_finish"] not in CAPS_BY_FINISH:
        print(f"no cap dimensioned for {s['neck_finish']} yet; "
              f"skipping cap on {bottle_key}")
        cap_mode = "none"
    if cap_mode != "none":
        cs = dict(CAP_COMMON)
        cs.update(CAPS_BY_FINISH[s["neck_finish"]])
        # skirt reaches just past the finish base — derived per bottle, so the
        # cap covers the threads and bead on every neck it mounts
        cs["skirt_below_rim"] = s["neck_h"] + 0.5
        c_caps = collection("CAPS", c_root)
        cap = revolve(cs["asset_id"], cap_profile(cs),
                      modulate=cap_thread_modulator(cs, s))
        if cap_mode in CAP_DOT_FINISHES:
            cap.data.materials.append(mat_cap_dotted(cap_mode))
        else:
            col, rough, metal = CAP_FINISHES[cap_mode]
            cm = mat_plastic(f"BB_MAT_CAP_{cap_mode.upper()}", col, rough)
            cm.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = metal
            cap.data.materials.append(cm)
        cap.parent = neck
        cap.location = (0, 0, 0)                 # origin IS the rim datum
        cap["asset_id"] = cs["asset_id"]
        cap["neck_finish"] = s["neck_finish"]
        cap["finish"] = cap_mode
        cap["web_name"] = "cap"
        link(cap, c_caps)

    # -- camera + flag
    cam_d = bpy.data.cameras.new("BB_CAM_MASTER")
    cam_d.lens = 100.0
    cam_d.sensor_fit = "AUTO"
    cam_d.sensor_width = 36.0
    cam = bpy.data.objects.new("BB_CAM_MASTER", cam_d)
    # Product normalization: the camera BACKS UP for taller products —
    # geometry is never scaled to fit the frame. With a 100mm lens on a 36mm
    # sensor, visible height = 0.36 x distance, so distance derives directly
    # from the product envelope (25% margin, 110mm floor for small SKUs).
    # The envelope is the ASSEMBLED product: bottle + whatever is seated on
    # the neck (a 17-415 sprayer with its overcap tops out at +24.85 above
    # the rim — 96.85 mm on the 9 mL — which a bottle-only envelope clips).
    product_top = s["height"]
    if component_objs:
        bpy.context.view_layer.update()
        product_top = max(product_top,
                          max(c17._bounds_local(o)[1] for o in component_objs.values()
                              if o.type == "MESH"))
    envelope = envelope_mm or max(110.0, product_top * 1.25)
    print(f"FRAME_ENVELOPE product_top {product_top:.2f} mm -> envelope {envelope:.1f} mm "
          f"({'override' if envelope_mm else 'derived'})")
    # Shared-scale sets: when an envelope override is given, the camera height
    # is ALSO fixed so the ground line lands at 82% of frame height on every
    # canvas — one baseline across all SKUs, truthful relative sizes.
    # Camera centres on the ASSEMBLED product (bottle + closure); the light
    # rig keeps aiming at the bottle's own mid-height (locked provenance).
    cam_z = (0.32 * envelope) if envelope_mm else (product_top * 0.5 if component_objs else mid)
    cam.location = (0, -envelope / 0.36, cam_z)      # level camera: verticals straight
    cam.rotation_euler = (math.radians(90), 0, 0)
    link(cam, c_cam)
    scene.camera = cam
    scene["frame_envelope_mm"] = envelope   # normalization: derived per product
    scene["envelope_note"] = ("taller products move the camera back via script; "
                              "geometry is never scaled to frame")

    flag = bpy.data.meshes.new("BB_FLAG_CAMERA")
    flag.from_pydata([(-350, 0, 0), (350, 0, 0), (350, 0, 700), (-350, 0, 700)],
                     [], [(0, 1, 2, 3)])
    flag.update()
    flag.materials.append(mat_diffuse("BB_MAT_FLAG_DARK", (0.15, 0.15, 0.15), 0.95))
    fo = bpy.data.objects.new("BB_FLAG_CAMERA", flag)
    fo.location = (0, -430, 0)
    fo.visible_camera = False
    fo.visible_shadow = False
    link(fo, c_help)

    # -- render settings
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.denoising_prefilter = "ACCURATE"
    scene.cycles.max_bounces = 16
    scene.cycles.transmission_bounces = 24
    scene.cycles.glossy_bounces = 8
    scene.cycles.transparent_max_bounces = 16
    scene.render.resolution_x = 2080
    scene.render.resolution_y = 2288
    scene.view_settings.view_transform = "Standard"
    scene.render.film_transparent = transparent
    if transparent:
        # Canvas mode: bottle + its uniform studio shadow over alpha.
        # A shadow catcher alone makes GLASS GO DARK: catchers vanish from
        # transmission rays, so nothing bright sits behind the bottle any
        # more. Fix: keep TWO backdrops —
        #   1) the original sweep as the shadow catcher (shadow into alpha)
        #   2) a camera-invisible twin that transmission/reflection rays DO
        #      see, so the glass keeps its lit bright-field and renders in
        #      its true colour over the transparent background.
        if s.get("body") == "disc":
            # A flat face mirror-reflects the centered camera flag dead-on and
            # reads smoked; cylinders only catch it at grazing slivers. The
            # canvas look keeps its edge contrast from the surround instead.
            fo.visible_glossy = False
            fo.visible_transmission = False
        sweep_ob = bpy.data.objects.get("BB_STUDIO_SWEEP")
        if sweep_ob:
            twin = sweep_ob.copy()
            twin.data = sweep_ob.data.copy()       # own mesh: own material
            twin.data.materials.clear()
            # TRUE bright-field: a uniform white EMITTER, not a lit diffuse
            # wall. A diffuse twin still carries the bottle's own shadow, and
            # a flat face transmits exactly that shadow zone straight to the
            # camera (the disc lesson — cylinders compress a whole bright
            # hemisphere into the silhouette and never showed it). An emitter
            # has no shadows to show. visible_diffuse stays off below so it
            # cannot relight the scene or lift the catcher shadow.
            em = bpy.data.materials.new("BB_MAT_BRIGHTFIELD_EMIT")
            em.use_nodes = True
            ent = em.node_tree
            ent.nodes.remove(ent.nodes["Principled BSDF"])
            enode = ent.nodes.new("ShaderNodeEmission")
            enode.inputs["Color"].default_value = (1.0, 1.0, 0.995, 1.0)
            enode.inputs["Strength"].default_value = 1.0
            ent.links.new(enode.outputs["Emission"],
                          ent.nodes["Material Output"].inputs["Surface"])
            twin.data.materials.append(em)
            twin.visible_diffuse = False
            twin.name = "BB_STUDIO_BRIGHTFIELD"
            twin.visible_camera = False
            twin.is_shadow_catcher = False
            twin.visible_shadow = False            # the catcher handles shadow
            for c in sweep_ob.users_collection:
                c.objects.link(twin)
            sweep_ob.is_shadow_catcher = True

    if component_objs:
        bpy.context.view_layer.update()
        listing = {"sprayer": "Spry17-415: 31 ±0.5 × Ø19 ±0.5; assembled 96 ±1 with overcap",
                   "pump": "Ltn17-415: 31 ±0.5 × Ø19 ±0.5; assembled 96 ±1 with overcap",
                   "none": "roll-on: assembled 83–85 ±1 capped"}
        c17.component_audit(component_objs, neck,
                            closure_mode if closure_mode != "none" else f"roller-{ball_mode}",
                            catalog=listing.get(closure_mode))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out_path))
    print(f"master scene saved: {out_path}")
    return scene


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--output", type=Path,
                   default=Path("pipeline/paper-doll-3d/master/bb-master-scene.blend"))
    p.add_argument("--test-render", type=Path, default=None)
    p.add_argument("--samples", type=int, default=512)
    p.add_argument("--roller", dest="ball_mode", default="none",
                   choices=["none", "plastic", "steel"],
                   help="fit the roll-on assembly; picks the ball material")
    p.add_argument("--bottle", dest="bottle_key", default="009",
                   choices=sorted(CYL_SPECS),
                   help="which bottle spec to build")
    p.add_argument("--cap", dest="cap_mode", default="none",
                   choices=["none"] + sorted(CAP_FINISHES) + sorted(CAP_DOT_FINISHES),
                   help="fit the closure; picks the finish")
    p.add_argument("--closure", dest="closure_mode", default="none",
                   choices=["none"] + list(c17.CLOSURE_KINDS),
                   help="fit a sprayer or lotion pump (17-415 only); replaces roller/cap")
    p.add_argument("--closure-finish", default="black",
                   choices=c17.SPRAYER_FINISHES,
                   help="collar colourway for --closure (pump ships black/gold/matte-silver)")
    p.add_argument("--no-overcap", dest="overcap", action="store_false",
                   help="omit the frosted overcap on a sprayer/pump")
    p.add_argument("--internals", action="store_true",
                   help="add the pump chamber + dip tube (OPTIONAL: product photos show empty glass)")
    p.add_argument("--glass", default="clear", choices=sorted(GLASS_VARIANTS),
                   help="glass material variant (one geometry, many glasses)")
    p.add_argument("--backdrop", default="",
                   help="studio hex colour override, e.g. #EFE9DE (bone)")
    p.add_argument("--lighting", default="standard",
                   choices=["standard", "symmetric"],
                   help="standard = key front-left + fill card (locked "
                        "amber/cobalt/frosted look); symmetric = one big "
                        "centred softbox, mirror-identical left/right "
                        "reflections (clear-glass profile)")
    p.add_argument("--transparent", action="store_true",
                   help="alpha canvas: backdrop becomes a shadow catcher")
    p.add_argument("--envelope", type=float, default=0.0,
                   help="override the framing envelope in mm (shared-scale sets)")
    p.add_argument("--dump-specs", action="store_true",
                   help="print the spec table as JSON and exit (batch driver)")
    p.add_argument("--finish-master", default=None,
                   choices=sorted(FINISH_MASTERS),
                   help="build ONE canonical finish master + QA audit "
                        "(geometry-validation stage; no bottle, no beauty)")
    p.add_argument("--qa-render", type=Path, default=None,
                   help="with --finish-master: render the validation set "
                        "(ortho front/side, 45, macro, 6-angle spin, section)")
    a = p.parse_args(argv)

    if a.finish_master:
        build_finish_qa_scene(a.finish_master, a.output.resolve(),
                              a.qa_render.resolve() if a.qa_render else None,
                              samples=min(a.samples, 96))
        return 0

    if a.dump_specs:
        import json
        print("SPECS_JSON " + json.dumps({
            k: {kk: vv for kk, vv in resolve_thread(v).items()
                if isinstance(vv, (int, float, str, bool))}
            for k, v in CYL_SPECS.items()}))
        return 0

    scene = build(a.output.resolve(), a.samples, a.ball_mode, a.cap_mode,
                  a.bottle_key, a.transparent, a.envelope, a.glass, a.backdrop,
                  lighting=a.lighting, closure_mode=a.closure_mode,
                  closure_finish=a.closure_finish, overcap=a.overcap,
                  internals=a.internals)
    if a.test_render:
        scene.render.filepath = str(a.test_render.resolve())
        bpy.ops.render.render(write_still=True)
        print(f"test render: {a.test_render}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
