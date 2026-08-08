#!/usr/bin/env python3
"""
Paper Doll 3D — Boston Round body builder.

Generates a real-world-scale Boston Round glass bottle BODY as a solid of
revolution, with the interior cavity modelled so refractive glass reads
correctly. The body is the shared base that swappable components (caps,
droppers, roller fitments) seat onto in later runs.

Every dimension is a parameter. Capacity presets carry the verified figures
from the live-site scrape, but each can be overridden on the command line —
so a dimension correction is a re-run, never a remodel, and the 15 ml / 60 ml
derives cost nothing.

The neck finish is an INDEPENDENT parameter, never scaled with the body.
30 ml and 60 ml share the 20-400 finish and must stay dimensionally identical
at the neck or no real closure will fit. Because each capacity is built from
its own parameter set rather than scaled from a base, that hazard cannot occur.

Geometry is emitted vertex-by-vertex rather than through bpy.ops, so output is
deterministic and independent of mode, selection, and operator defaults.

Usage:
  # Headless (canonical — this is the reproducible path):
  blender --background --python scripts/paper-doll-3d/build-boston-round.py -- \\
      --capacity 30 \\
      --output pipeline/paper-doll-3d/pilot/subject-boston-round/01_body/bsr-30ml_body_v001.blend

  # Report computed geometry + volume checks, write nothing:
  blender --background --python scripts/paper-doll-3d/build-boston-round.py -- \\
      --capacity 30 --dry-run

  # Override a dimension without touching the preset:
  blender --background --python scripts/paper-doll-3d/build-boston-round.py -- \\
      --capacity 30 --height 68 --dry-run

  # Inside a running Blender (via MCP / scripting tab): exec this file with no
  # argv and it builds the 30 ml preset into the current scene without saving.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    import bpy
except ImportError:
    print(
        "ERROR: this script must run inside Blender.\n"
        "  blender --background --python <this file> -- --capacity 30 --dry-run",
        file=sys.stderr,
    )
    raise SystemExit(2)


# ─── Neck finish registry (SPI 400 series) ──────────────────────────────────
# T = thread major diameter, I = bore diameter, finish_h = height of the
# finish measured down from the sealing surface.
#
# Standard SPI/GPI table values, NOT measured from a sample.
#
# These are FITMENT-CRITICAL, not cosmetic. The bottle, the roll-on/dropper
# fitment and the cap are separate pieces that must assemble seamlessly in the
# configurator, so:
#   I  (bore)   — roll-on and dropper fitments press-fit INTO this. Wrong bore
#                 makes a fitment visibly float or intersect the glass.
#   T  (thread) — the cap skirt closes over this.
# 15 ml is 18-400 while 30/60 ml are 20-400, so every fitment and cap needs a
# variant per finish. The datum carries its finish spec so invalid pairings can
# be rejected rather than rendered.
#
# Verify against a closure supplier drawing before modelling any mating part.

#   T = thread major (crest) dia, E = thread root dia, I = bore,
#   finish_h = height of the thread land below the rim,
#   pitch = axial rise per turn, turns = how many the land carries.
#
# 20-400 T/E are MEASURED off the bare-bottle reference (crest 20.92, root
# 17.78) and deliberately override the standard table, which gave T = 19.53.
# The measurement, and the fact that the "20" in 20-400 is nominally T in mm,
# both say the table value was ~1 mm low. Carries ~2-3% scale uncertainty until
# a caliper confirms it (see 09_notes/measurement-protocol.md §2.1).
#
# 18-400 is STILL the unverified table value — no reference measured yet.

# A single-start helix shows (T+E)/2 in silhouette, NOT 2x the crest — one side
# sits at crest while the other is half a turn out of phase at root. The
# reference's thread band averages ~19.0, so with E = 17.78 the real crest is
# T ~ 20.2. An earlier reading of 20.9 was the TRANSFER BEAD, an axisymmetric
# ring at the base of the neck, misidentified as a thread crest — the bead
# bulges equally on both sides, which is how it is told apart from a helix.
#
# bead_T / bead_h / bead_below_rim describe that ring. It is real moulded
# geometry, plainly visible on the reference, and its absence was a 3.2 mm
# diameter error at z~67.

NECK_FINISHES: Dict[str, Dict[str, float]] = {
    "18-400": {"T": 17.53, "E": 16.03, "I": 13.51, "finish_h": 9.65,
               "pitch": 4.23, "turns": 2.0,
               "bead_T": 18.60, "bead_h": 1.80, "bead_below_rim": 10.20,
               "measured": False},
    "20-400": {"T": 20.20, "E": 17.78, "I": 15.49, "finish_h": 10.00,
               "pitch": 4.23, "turns": 1.6,
               "bead_T": 20.92, "bead_h": 3.00, "bead_below_rim": 10.80,
               "measured": True},
}


# ─── Capacity presets ───────────────────────────────────────────────────────
# height / diameter / neck are VERIFIED from the live-site scrape
# (docs/reviews/audit-2026-08-06/live-site-full-scrape.json) and recorded in
# pipeline/paper-doll-3d/pilot/subject-boston-round/09_notes/dimensions.md.
#
# wall / shoulder_h / base_th / heel_r are MODELLING CHOICES — no published
# source. They are tuned so the computed fill-to-shoulder volume lands near
# the labelled capacity; the script reports that check on every run.

# shoulder_h / neck_straight / heel_r for 30 ml are MEASURED from the reference
# photograph via extract-silhouette.py (GB-BSR-AMB-30ML-RON-GLD, scaled on the
# 78 mm bare height). 15 ml and 60 ml are still estimated — re-run extraction on
# their own references, or take the caliper sheet in 09_notes, to promote them.
#
# label_w/h/offset come from packaging-saas src/lib/presets.ts (bb-boston-30).

CAPACITY_SPECS: Dict[int, Dict[str, object]] = {
    15: {
        "height": 68.0, "diameter": 25.0, "neck": "18-400",
        "wall": 2.10, "wall_shoulder": 2.40, "shoulder_h": 8.5, "neck_straight": 5.0,
        "base_th": 4.5, "heel_r": 5.5, "push_up_h": 1.6, "contact_w": 2.0, "lip_r": 0.4,
        "label_w": 60.0, "label_h": 26.0, "label_off": 11.0,
        "ref_sku": "GBBstn15BlkCapSht", "shape_measured": False,
    },
    30: {
        "height": 78.0, "diameter": 33.0, "neck": "20-400",
        "wall": 1.80, "wall_shoulder": 2.00, "shoulder_h": 11.22, "neck_straight": 5.52,
        "base_th": 4.5, "heel_r": 7.5, "push_up_h": 2.0, "contact_w": 2.5, "lip_r": 0.4,
        "label_w": 72.0, "label_h": 32.0, "label_off": 14.0,
        "ref_sku": "GBBstn1ozBlkCapSht", "shape_measured": True,
    },
    60: {
        "height": 94.0, "diameter": 39.0, "neck": "20-400",
        "wall": 2.60, "wall_shoulder": 2.95, "shoulder_h": 11.5, "neck_straight": 8.0,
        "base_th": 6.0, "heel_r": 8.5, "push_up_h": 2.4, "contact_w": 3.0, "lip_r": 0.4,
        "label_w": 84.0, "label_h": 38.0, "label_off": 16.0,
        "ref_sku": "GBBstnAmb2ozBlkCapSht", "shape_measured": False,
    },
}

FAMILY_CODE = "bsr"          # matches the graceSku family segment (GB-BSR-*)
RADIAL_SEGMENTS = 128        # MODELS.md asks 10-40k tris; 128 lands ~11k and kills faceting
SHOULDER_STEPS = 20
HEEL_STEPS = 14              # the heel is a large radius on this family — needs steps
# Shoulder bezier handles, as fractions of the shoulder height. ASYMMETRIC by
# measurement: least-squares fit against the bare-bottle reference gives
# 0.45 / 0.125, RMS 0.204 mm. A symmetric 0.45/0.45 (the first guess) scored
# 1.012 mm and pulled the shoulder in far too fast — it was the single largest
# shape error in the model, up to 5.7 mm of diameter at z~58.
SHOULDER_TENSION_BODY = 0.45   # handle at the wall end — holds the full diameter
SHOULDER_TENSION_NECK = 0.125  # handle at the neck end — arrives quickly

# --- packaging-studio contract (packaging-saas/public/models/MODELS.md) --------
# The studio loader matches meshes by case-insensitive SUBSTRING and applies its
# own live materials. Names below are chosen to hit exactly one category each.
# Match order in the loader is: label_front, label_back, liquid, collar, cap,
# body — so a name must not contain an earlier category's keyword by accident.
LABEL_ARC_FRACTION = 0.38    # src/lib/label-sizes.ts:80 — curved face = circumference * 0.38
LABEL_PROUD_MM = 0.3         # shell sits this far off the glass
LABEL_SEGMENTS = 48
LIQUID_INSET_MM = 0.1        # keeps the fill from z-fighting the interior wall
NECK_STEPS_PER_MM = 3.0      # vertical sampling on the neck — must resolve the thread
THREAD_FADE_MM = 1.2         # thread tapers in/out over this, so it blends into the neck


# ─── Profile construction ───────────────────────────────────────────────────

def _arc(cr: float, cz: float, radius: float,
         a0_deg: float, a1_deg: float, steps: int) -> List[Tuple[float, float]]:
    """Points along a circular arc in the (r, z) plane. Endpoints included."""
    a0, a1 = math.radians(a0_deg), math.radians(a1_deg)
    return [
        (cr + radius * math.cos(a0 + (a1 - a0) * i / steps),
         cz + radius * math.sin(a0 + (a1 - a0) * i / steps))
        for i in range(steps + 1)
    ]


def _bezier(p0: Tuple[float, float], p1: Tuple[float, float],
            p2: Tuple[float, float], p3: Tuple[float, float],
            steps: int) -> List[Tuple[float, float]]:
    """Cubic bezier in the (r, z) plane. Endpoints included."""
    out = []
    for i in range(steps + 1):
        t = i / steps
        u = 1.0 - t
        b0, b1, b2, b3 = u**3, 3 * u**2 * t, 3 * u * t**2, t**3
        out.append((
            b0 * p0[0] + b1 * p1[0] + b2 * p2[0] + b3 * p3[0],
            b0 * p0[1] + b1 * p1[1] + b2 * p2[1] + b3 * p3[1],
        ))
    return out


def _shoulder(r_from: float, z_from: float, r_to: float, z_to: float,
              steps: int) -> List[Tuple[float, float]]:
    """
    Boston Round shoulder: leaves the cylindrical wall vertically, curves in,
    and arrives at the neck vertically. Vertical tangents at both ends are what
    give the family its characteristic rounded shoulder rather than a cone.

    The two handles are deliberately unequal — see SHOULDER_TENSION_*. The real
    bottle holds its full diameter well up the shoulder and then turns in
    sharply, which a symmetric curve cannot reproduce.
    """
    span = z_to - z_from
    return _bezier((r_from, z_from), (r_from, z_from + SHOULDER_TENSION_BODY * span),
                   (r_to, z_to - SHOULDER_TENSION_NECK * span), (r_to, z_to), steps)


def build_profile(spec: Dict[str, float]) -> Dict[str, object]:
    """
    Build the closed (r, z) cross-section of the glass.

    Traversal order is: outer surface bottom-to-top, across the finish rim,
    then inner surface top-to-bottom. A single winding rule then yields
    outward normals on the outer wall and cavity-facing normals on the bore,
    which is what a solid glass shell requires.
    """
    height = spec["height"]
    r_body = spec["diameter"] / 2.0
    wall = spec["wall"]
    base_th = spec["base_th"]
    heel_r = spec["heel_r"]
    finish_h = spec["finish_h"]
    # The neck cylinder is authored at the thread ROOT; the helix rises from it
    # to the crest. Below the finish the plain neck sits at root diameter too,
    # which is what the reference measures (root ~17.8 vs crest ~20.9).
    r_neck = spec["neck_E"] / 2.0
    r_crest = spec["neck_T"] / 2.0
    r_bore = spec["neck_I"] / 2.0

    # The neck is a straight run at r_neck made of two documented parts: the
    # SPI finish (thread land, what a closure engages) and a plain straight
    # section below it. Geometrically they are one cylinder; the split matters
    # because only the finish portion is fitment-critical.
    neck_straight = float(spec.get("neck_straight", 0.0))
    z_finish_bottom = height - finish_h
    z_neck_bottom = z_finish_bottom - neck_straight
    z_shoulder_start = z_neck_bottom - spec["shoulder_h"]
    r_body_in = r_body - wall

    if z_shoulder_start <= base_th + heel_r:
        raise ValueError(
            f"geometry collapses: shoulder would start at z={z_shoulder_start:.2f} mm, "
            f"at or below the base/heel at z={base_th + heel_r:.2f} mm. "
            f"Height {height} mm is too short for a {spec['shoulder_h']} mm shoulder "
            f"plus a {finish_h} mm finish."
        )
    if r_bore >= r_body_in:
        raise ValueError(
            f"geometry collapses: neck bore r={r_bore:.2f} mm is not smaller than "
            f"the body cavity r={r_body_in:.2f} mm."
        )

    # Base: a shallow internal push-up ringed by a flat contact land. The bottle
    # stands on that ring, not on the whole base — standard for moulded glass,
    # and it is why the foot reads darkest: the glass there is thickest.
    push_h = float(spec.get("push_up_h", 0.0) or 0.0)
    contact_w = float(spec.get("contact_w", 2.5) or 2.5)
    r_heel_start = r_body - heel_r
    r_contact_in = max(0.5, r_heel_start - contact_w)

    outer: List[Tuple[float, float]] = []
    if push_h > 0.0:
        dome_steps = 16
        for i in range(dome_steps + 1):
            t = i / dome_steps
            outer.append((r_contact_in * t,
                          push_h * 0.5 * (1.0 + math.cos(math.pi * t))))
        outer.append((r_heel_start, 0.0))
    else:
        outer += [(0.0, 0.0), (r_heel_start, 0.0)]
    outer += _arc(r_heel_start, heel_r, heel_r, -90.0, 0.0, HEEL_STEPS)[1:]
    outer.append((r_body, z_shoulder_start))
    outer += _shoulder(r_body, z_shoulder_start, r_neck, z_neck_bottom, SHOULDER_STEPS)[1:]
    # Subdivide the neck finely enough to resolve the thread helix. A coarse
    # neck would alias the thread into a lumpy ring.
    # Transfer bead: an axisymmetric ring at the base of the neck. It belongs in
    # the PROFILE (it is a full ring), unlike the thread, which is a helix and
    # therefore applied as angular modulation during the revolve.
    z_bead = height - float(spec.get("bead_below_rim", 0.0) or 0.0)
    bead_h = float(spec.get("bead_h", 0.0) or 0.0)
    r_bead = float(spec.get("bead_T", 0.0) or 0.0) / 2.0

    def neck_radius(z: float) -> float:
        if bead_h > 0.0 and r_bead > r_neck and abs(z - z_bead) <= bead_h / 2.0:
            t = (z - z_bead) / (bead_h / 2.0)
            return r_neck + (r_bead - r_neck) * 0.5 * (1.0 + math.cos(math.pi * t))
        return r_neck

    lip_r = float(spec.get("lip_r", 0.0) or 0.0)
    z_neck_top = height - lip_r
    neck_steps = max(2, int((z_neck_top - z_neck_bottom) * NECK_STEPS_PER_MM))
    for i in range(1, neck_steps + 1):
        z = z_neck_bottom + (z_neck_top - z_neck_bottom) * i / neck_steps
        outer.append((neck_radius(z), z))
    if lip_r > 0.0:
        # rounded outer lip rolling onto the flat sealing land
        r_top = neck_radius(z_neck_top)
        outer += _arc(r_top - lip_r, height - lip_r, lip_r, 0.0, 90.0, 6)[1:]
    outer_count = len(outer)

    # Inner surface, ascending. Kept separately for the volume integration and
    # for the liquid solid, then reversed into the closed loop.
    # Variable wall: shoulder carries more glass than the body wall, as moulded
    # containers do. Thickness drives the volumetric absorption, so this is what
    # makes the foot read espresso while the shoulder stays lighter.
    wall_sh = float(spec.get("wall_shoulder", wall))
    r_shoulder_in = r_body - wall_sh
    taper = min(6.0, max(0.0, (z_shoulder_start - base_th) * 0.4))

    inner: List[Tuple[float, float]] = [(0.0, base_th), (r_body_in, base_th)]
    if taper > 0.05 and abs(r_shoulder_in - r_body_in) > 1e-6:
        inner.append((r_body_in, z_shoulder_start - taper))
        for i in range(1, 7):
            t = i / 6.0
            sm = 0.5 * (1.0 - math.cos(math.pi * t))
            inner.append((r_body_in + (r_shoulder_in - r_body_in) * sm,
                          z_shoulder_start - taper * (1.0 - t)))
    else:
        inner.append((r_body_in, z_shoulder_start))
    inner += _shoulder(r_shoulder_in, z_shoulder_start, r_bore, z_neck_bottom, SHOULDER_STEPS)[1:]
    if lip_r > 0.0:
        inner.append((r_bore, height - lip_r))
        inner += _arc(r_bore + lip_r, height - lip_r, lip_r, 180.0, 90.0, 6)[1:]
    else:
        inner.append((r_bore, height))

    return {
        "loop": outer + list(reversed(inner)),
        "inner": inner,
        "outer_count": outer_count,
        "z_neck_bottom": z_neck_bottom,
        "z_finish_bottom": z_finish_bottom,
        "z_shoulder_start": z_shoulder_start,
        "r_body": r_body,
        "r_neck": r_neck,
        "r_crest": r_crest,
        "r_bore": r_bore,
        "r_body_in": r_body_in,
        "z_bead": z_bead,
        "bead_h": bead_h,
        "r_bead": r_bead,
    }


def make_thread_modulator(prof: Dict[str, object], spec: Dict[str, object]):
    """
    Build a radius modulator that turns the plain neck cylinder into a real
    single-start helix during the revolve.

    Doing it here rather than as a separate swept mesh keeps the bottle one
    manifold shell — no booleans, no seams, no non-manifold edges where a
    thread solid would meet the glass.

    Radius rises from the thread root to the crest following a raised cosine,
    which matches moulded glass threads (they are rounded, not sharp V). The
    phase advances with height AND with angle, which is what makes it a helix
    rather than a stack of rings:  phase = z/pitch - theta/2pi
    """
    r_root = prof["r_neck"]
    r_crest = prof["r_crest"]
    pitch = float(spec["neck_pitch"])
    turns = float(spec["neck_turns"])
    outer_count = prof["outer_count"]

    z_top = float(spec["height"])
    z_thread_lo = z_top - min(float(spec["finish_h"]), turns * pitch)
    # Never let the helix run down into the transfer bead — they are separate
    # features and overlapping them would compound both radii.
    bead_top = prof["z_bead"] + prof["bead_h"] / 2.0
    if prof["r_bead"] > r_root:
        z_thread_lo = max(z_thread_lo, bead_top)
    depth = r_crest - r_root

    def modulate(index: int, r: float, z: float, theta: float) -> float:
        # Outer surface only — the bore must stay smooth or no fitment inserts.
        if index >= outer_count or depth <= 0.0:
            return r
        if z < z_thread_lo or z > z_top:
            return r
        # taper in at the bottom of the land and out just under the rim, so the
        # thread runs out smoothly instead of ending in a cliff
        fade = min(1.0, (z - z_thread_lo) / THREAD_FADE_MM,
                   (z_top - z) / THREAD_FADE_MM)
        if fade <= 0.0:
            return r
        phase = ((z - z_thread_lo) / pitch) - (theta / (2.0 * math.pi))
        bump = 0.5 * (1.0 - math.cos(2.0 * math.pi * (phase % 1.0)))
        return r + depth * bump * fade

    return modulate


def liquid_profile(inner: List[Tuple[float, float]], fill_z: float,
                   inset: float) -> List[Tuple[float, float]]:
    """
    Closed profile of the liquid solid: the interior cavity up to fill_z,
    pulled in by `inset` so it never z-fights the glass it sits inside.
    """
    pts: List[Tuple[float, float]] = []
    for (r0, z0), (r1, z1) in zip(inner, inner[1:]):
        if z0 > fill_z:
            break
        pts.append((max(0.0, r0 - inset), z0))
        if z1 > fill_z:                              # clip the straddling segment
            t = (fill_z - z0) / (z1 - z0)
            pts.append((max(0.0, (r0 + (r1 - r0) * t) - inset), fill_z))
            break
    if not pts or pts[-1][1] < fill_z:
        pts.append((max(0.0, inner[-1][0] - inset), fill_z))
    # cap the surface: run back to the axis at the fill plane, closing the loop
    pts.append((0.0, fill_z))
    return pts


def revolve_volume(inner: List[Tuple[float, float]],
                   z_max: Optional[float] = None) -> float:
    """
    Interior volume in ml, by disc integration of the inner profile:
    V = pi * integral r(z)^2 dz, trapezoidal over the profile segments.
    Horizontal segments contribute nothing. Optionally truncate at z_max to
    measure a fill level rather than brim capacity.
    """
    total = 0.0
    for (r0, z0), (r1, z1) in zip(inner, inner[1:]):
        if z_max is not None:
            if z0 >= z_max:
                break
            if z1 > z_max:                      # clip the straddling segment
                t = (z_max - z0) / (z1 - z0)
                r1, z1 = r0 + (r1 - r0) * t, z_max
        total += math.pi * 0.5 * (r0 * r0 + r1 * r1) * (z1 - z0)
    return total / 1000.0                        # mm^3 -> ml


# ─── Mesh generation ────────────────────────────────────────────────────────

def revolve_mesh(loop: List[Tuple[float, float]], segments: int,
                 modulate=None) -> Tuple[List[Tuple[float, float, float]], List[List[int]]]:
    """
    Revolve a closed (r, z) loop around +Z into a manifold mesh.

    Profile points on the axis (r == 0) collapse to a single shared pole vertex
    and fan into triangles; every other span becomes a quad ring. That keeps
    the wall free of n-gons and free of coincident duplicate vertices at the
    poles.
    """
    verts: List[Tuple[float, float, float]] = []
    rings: List[List[int]] = []          # per profile point: vertex indices
    on_axis: List[bool] = []

    for idx, (r, z) in enumerate(loop):
        if abs(r) < 1e-9:
            rings.append([len(verts)] * segments)
            verts.append((0.0, 0.0, z))
            on_axis.append(True)
        else:
            base = len(verts)
            for j in range(segments):
                a = 2.0 * math.pi * j / segments
                rr = modulate(idx, r, z, a) if modulate else r
                verts.append((rr * math.cos(a), rr * math.sin(a), z))
            rings.append([base + j for j in range(segments)])
            on_axis.append(False)

    faces: List[List[int]] = []
    n = len(loop)
    for i in range(n):
        i2 = (i + 1) % n                  # loop is closed — wrap the last span
        a_axis, b_axis = on_axis[i], on_axis[i2]
        if a_axis and b_axis:
            continue                      # degenerate: both on the axis
        ra, rb = rings[i], rings[i2]
        for j in range(segments):
            j2 = (j + 1) % segments
            if a_axis:
                faces.append([ra[0], rb[j2], rb[j]])
            elif b_axis:
                faces.append([ra[j], ra[j2], rb[0]])
            else:
                faces.append([ra[j], ra[j2], rb[j2], rb[j]])
    return verts, faces


def label_shell(radius: float, z0: float, z1: float, arc_rad: float,
                facing: float, segments: int):
    """
    A partial-cylinder label surface with flat 0-1 UVs.

    MODELS.md calls the UVs "the one thing worth getting exactly right": U runs
    across the width, V up the height, filling 0-1 so the studio's canvas label
    maps on without stretch or rotation.

    `facing` is the compass direction (radians in the XY plane) the shell is
    centred on. Blender -Y is the viewer-facing side once the glTF exporter
    converts +Z-up to +Y-up, so the front label faces -Y.
    """
    a0, a1 = facing - arc_rad / 2.0, facing + arc_rad / 2.0
    verts, faces, uvs = [], [], []
    for i in range(segments + 1):
        a = a0 + (a1 - a0) * i / segments
        verts.append((radius * math.cos(a), radius * math.sin(a), z0))
        verts.append((radius * math.cos(a), radius * math.sin(a), z1))
    for i in range(segments):
        b0, b1 = 2 * i, 2 * (i + 1)
        # winding chosen so normals point away from the axis (outward)
        faces.append([b0, b1, b1 + 1, b0 + 1])
        u0, u1 = i / segments, (i + 1) / segments
        uvs.append([(u0, 0.0), (u1, 0.0), (u1, 1.0), (u0, 1.0)])
    return verts, faces, uvs


def make_label_object(name: str, radius: float, z0: float, z1: float,
                      arc_rad: float, facing: float) -> bpy.types.Object:
    verts, faces, uvs = label_shell(radius, z0, z1, arc_rad, facing, LABEL_SEGMENTS)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate(verbose=False)
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for poly, quad_uv in zip(mesh.polygons, uvs):
        for li, uv in zip(poly.loop_indices, quad_uv):
            uv_layer.data[li].uv = uv
    mesh.update()
    return bpy.data.objects.new(name, mesh)


# ─── Materials ──────────────────────────────────────────────────────────────

def _principled(mat: bpy.types.Material) -> bpy.types.Node:
    mat.use_nodes = True
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def _set(node: bpy.types.Node, key: str, value) -> bool:
    """Set a Principled input by name. Blender renames these between versions."""
    if key in node.inputs:
        node.inputs[key].default_value = value
        return True
    return False


# Glass colours are VOLUMETRIC, not surface tints. Amber and cobalt container
# glass are coloured by absorption through the thickness, which is why a real
# bottle reads near-black at the edges (long light path through the curved wall)
# and glows in the middle (short path). A flat base-colour tint cannot produce
# that and always looks like plastic.
#
# This only works because the interior cavity is modelled: the closed shell
# encloses the glass itself, so Volume Absorption acts over the true wall
# thickness. Density is per Blender unit, and 1 BU = 1 mm here.
#
# The three tints match the catalog: amber 43 SKUs, clear 39, cobalt 39.

# Blender's Volume Absorption coefficient per channel is  density * (1 - color),
# and transmission over a path x is  exp(-coeff * x).  So the values below are
# solved BACKWARDS from the target transmission of Type III pharmaceutical amber
# at a 2.5 mm wall (~45% R, ~15% G, ~2% B), not eyeballed:
#
#     coeff_R = -ln(0.45)/2.5 = 0.32     color_R = 1 - 0.32/1.60 = 0.80
#     coeff_G = -ln(0.15)/2.5 = 0.76     color_G = 1 - 0.76/1.60 = 0.52
#     coeff_B = -ln(0.02)/2.5 = 1.56     color_B = 1 - 1.56/1.60 = 0.02
#
# Because absorption is volumetric, the thick base (5-6 mm) darkens to espresso
# and the thin rim glows honey with NO extra authoring — that falls out of
# Beer-Lambert over the modelled wall thickness.
#
# Surface Base Color stays near-white: all colour must come from the volume, or
# it double-tints and reads as plastic.

GLASS_TINTS: Dict[str, Dict[str, object]] = {
    "clear":  {"volume": None,                    "density": 0.00,
               "surface": (0.97, 0.99, 0.98, 1.0), "roughness": 0.005},
    # Re-solved from the REAL bottle (17. GBBstnAmb1ozBlkCapSht.psd). Measured
    # transmission through 2 walls (4.9 mm) at the body centre is R 0.176 /
    # G 0.082 / B 0.0088, giving coefficients 0.355 / 0.511 / 0.966. The first
    # pass over-absorbed green and blue, which made the glass read orange rather
    # than the reference's brown-amber.
    # v3: solved from the reference's centre-of-body transmission ratios
    # (R:G ~2.4, G:B ~3.0). Zero blue in v2 pushed the hue olive; real amber
    # transmits a little blue.
    "amber":  {"volume": (0.578, 0.390, 0.155, 1.0), "density": 0.97,
               "surface": (0.99, 0.99, 0.99, 1.0), "roughness": 0.03},
    "cobalt": {"volume": (0.04, 0.22, 0.86, 1.0), "density": 1.85,
               "surface": (0.99, 0.99, 0.99, 1.0), "roughness": 0.005},
}


def make_glass_material(name: str, tint: str = "clear") -> bpy.types.Material:
    spec = GLASS_TINTS.get(tint, GLASS_TINTS["clear"])
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    bsdf = _principled(mat)
    _set(bsdf, "Base Color", spec["surface"])
    _set(bsdf, "Roughness", spec.get("roughness", 0.005))   # fire-polished container glass
    _set(bsdf, "Metallic", 0.0)
    _set(bsdf, "IOR", 1.52)                       # soda-lime silica
    # Abbe 58 -> dispersion. Present as a Principled input from Blender 4.x.
    _set(bsdf, "Dispersion", 0.02)
    # Transmission moved from a float to a "Transmission Weight" socket in 4.x.
    if not _set(bsdf, "Transmission Weight", 1.0):
        _set(bsdf, "Transmission", 1.0)

    nt = mat.node_tree
    out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
    # clear anything a previous build of this material added
    for n in [n for n in nt.nodes
              if n.type in ("VOLUME_ABSORPTION", "TEX_NOISE", "BUMP", "MAP_RANGE", "TEX_COORD")]:
        nt.nodes.remove(n)

    # ---- moulded-glass imperfection stack (procedural) ----------------------
    # Real container glass is never optically flat: the mould leaves ~5-10 mm
    # waviness that makes highlights wobble, and fire-polish leaves micro
    # variation in roughness. Perfectly straight highlights on a perfect
    # revolve are the single loudest CGI tell. Object-space coordinates keep
    # the pattern stable under transforms. (This is the part a Substance
    # glass .sbsar would contribute; procedural = no asset dependency.)
    coord = nt.nodes.new("ShaderNodeTexCoord")
    coord.location = (bsdf.location.x - 900, bsdf.location.y - 150)

    wavy = nt.nodes.new("ShaderNodeTexNoise")
    wavy.location = (bsdf.location.x - 700, bsdf.location.y - 60)
    wavy.inputs["Scale"].default_value = 0.14          # ~7 mm features (1 BU = 1 mm)
    wavy.inputs["Detail"].default_value = 1.5
    bump = nt.nodes.new("ShaderNodeBump")
    bump.location = (bsdf.location.x - 420, bsdf.location.y - 60)
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.035      # tens of microns of wobble
    nt.links.new(coord.outputs["Object"], wavy.inputs["Vector"])
    nt.links.new(wavy.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    micro = nt.nodes.new("ShaderNodeTexNoise")
    micro.location = (bsdf.location.x - 700, bsdf.location.y - 320)
    micro.inputs["Scale"].default_value = 1.8          # ~0.5 mm patches
    micro.inputs["Detail"].default_value = 2.0
    rng = nt.nodes.new("ShaderNodeMapRange")
    rng.location = (bsdf.location.x - 420, bsdf.location.y - 320)
    base_rough = float(spec.get("roughness", 0.03))
    rng.inputs["To Min"].default_value = max(0.004, base_rough - 0.013)
    rng.inputs["To Max"].default_value = base_rough + 0.015
    nt.links.new(coord.outputs["Object"], micro.inputs["Vector"])
    nt.links.new(micro.outputs["Fac"], rng.inputs["Value"])
    if "Roughness" in bsdf.inputs:
        nt.links.new(rng.outputs["Result"], bsdf.inputs["Roughness"])
    if spec["volume"] and out is not None:
        vol = nt.nodes.new("ShaderNodeVolumeAbsorption")
        vol.location = (out.location.x - 300, out.location.y - 260)
        vol.inputs["Color"].default_value = spec["volume"]
        vol.inputs["Density"].default_value = spec["density"]
        nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])

    mat.use_backface_culling = False
    if hasattr(mat, "blend_method"):
        mat.blend_method = "BLEND"
    return mat


def make_gold_material(name: str) -> bpy.types.Material:
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    bsdf = _principled(mat)
    _set(bsdf, "Base Color", (1.000, 0.766, 0.336, 1.0))   # measured Au reflectance
    _set(bsdf, "Metallic", 1.0)
    _set(bsdf, "Roughness", 0.15)
    # OPEN-2: no carrier geometry this run (components are out of scope).
    # Fake user keeps it in the file through save/load so the cap run inherits it.
    mat.use_fake_user = True
    return mat


# ─── Scene assembly ─────────────────────────────────────────────────────────

def configure_units(scene: bpy.types.Scene) -> None:
    """Metric, millimetre display, 1 Blender unit = 1 mm. +Z up."""
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 0.001
    scene.unit_settings.length_unit = "MILLIMETERS"


def get_collection(name: str, parent: bpy.types.Collection) -> bpy.types.Collection:
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
    if coll.name not in {c.name for c in parent.children}:
        parent.children.link(coll)
    return coll


def purge_previous(names: List[str]) -> None:
    """Remove prior build output so a re-run overwrites rather than accumulates."""
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj is not None:
            data = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            if isinstance(data, bpy.types.Mesh) and data.users == 0:
                bpy.data.meshes.remove(data)


def build(spec: Dict[str, object], clear_scene: bool = True) -> Dict[str, object]:
    """Build the body + neck datum into the current scene. Returns a report dict."""
    scene = bpy.context.scene
    configure_units(scene)

    stem = f"bb_{FAMILY_CODE}{int(spec['capacity'])}"
    body_name = f"{stem}_body_v001"
    liquid_name = f"{stem}_liquid_v001"
    lfront_name = f"{stem}_label_front_v001"
    lback_name = f"{stem}_label_back_v001"
    datum_name = f"{stem}_neckdatum_v001"
    all_names = [body_name, liquid_name, lfront_name, lback_name, datum_name]

    if clear_scene:
        for obj in list(bpy.data.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
    else:
        purge_previous(all_names)

    prof = build_profile(spec)
    threader = make_thread_modulator(prof, spec) if spec.get("threads", True) else None
    verts, faces = revolve_mesh(prof["loop"], RADIAL_SEGMENTS, threader)

    mesh = bpy.data.meshes.new(body_name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate(verbose=False)
    mesh.update()
    for poly in mesh.polygons:
        poly.use_smooth = True

    body = bpy.data.objects.new(body_name, mesh)
    # Origin is already at base centre (0,0,0) by construction — the profile is
    # authored in object space with z=0 at the base, so the bottle sits on the
    # world XY plane with no transform to apply. scale stays (1,1,1).
    body.location = (0.0, 0.0, 0.0)

    tint = str(spec.get("glass", "clear"))
    glass = make_glass_material(f"bb_mat_glass_{tint}", tint)
    gold = make_gold_material("bb_mat_gold_shiny")
    mesh.materials.append(glass)

    # --- liquid solid: the interior cavity up to the fill plane ---------------
    fill_z = spec.get("fill_z") or prof["z_shoulder_start"]
    lq_prof = liquid_profile(prof["inner"], fill_z, LIQUID_INSET_MM)
    lq_verts, lq_faces = revolve_mesh(lq_prof, RADIAL_SEGMENTS)
    lq_mesh = bpy.data.meshes.new(liquid_name)
    lq_mesh.from_pydata(lq_verts, [], lq_faces)
    lq_mesh.validate(verbose=False)
    lq_mesh.update()
    for poly in lq_mesh.polygons:
        poly.use_smooth = True
    liquid = bpy.data.objects.new(liquid_name, lq_mesh)

    # --- label shells ---------------------------------------------------------
    # Arc is derived from the label stock width wrapped on the body radius
    # (arc = width / radius), not guessed. bb-boston-30's 72 mm label on a
    # 33 mm body is a 250 deg wrap; a narrower panel label yields a smaller arc.
    r_label = prof["r_body"] + LABEL_PROUD_MM
    arc = min(math.radians(350.0), float(spec["label_w"]) / r_label)
    lz0 = float(spec["label_off"])
    lz1 = lz0 + float(spec["label_h"])
    label_front = make_label_object(lfront_name, r_label, lz0, lz1, arc, -math.pi / 2)
    label_back = make_label_object(lback_name, r_label, lz0, lz1, arc, math.pi / 2)

    datum = bpy.data.objects.new(datum_name, None)
    datum.empty_display_type = "PLAIN_AXES"
    datum.empty_display_size = spec["diameter"] / 3.0
    # Seating plane = top of the finish. Every closure in this family (screw
    # cap, dropper, roller housing) seals on the finish rim, so a component
    # whose own origin sits at its mating face seats with a zeroed transform.
    datum.location = (0.0, 0.0, spec["height"])
    datum.parent = body

    body_coll = get_collection("BSR_BODY", scene.collection)
    for obj in (body, liquid, label_front, label_back, datum):
        body_coll.objects.link(obj)

    brim_ml = revolve_volume(prof["inner"])
    shoulder_ml = revolve_volume(prof["inner"], z_max=prof["z_shoulder_start"])

    meta = {
        "family": FAMILY_CODE,
        "capacity_ml": spec["capacity"],
        "ref_sku": spec.get("ref_sku", ""),
        "height_bare_mm": spec["height"],
        "diameter_mm": spec["diameter"],
        "neck_finish": spec["neck"],
        "neck_T_mm": spec["neck_T"],
        "neck_I_mm": spec["neck_I"],
        "finish_height_mm": spec["finish_h"],
        "wall_mm": spec["wall"],
        "shoulder_height_mm": spec["shoulder_h"],
        "base_thickness_mm": spec["base_th"],
        "heel_radius_mm": spec["heel_r"],
        "neck_E_mm": spec["neck_E"],
        "neck_measured": bool(spec.get("neck_measured", False)),
        "threads": bool(spec.get("threads", True)),
        "thread_pitch_mm": spec["neck_pitch"],
        "thread_turns": spec["neck_turns"],
        "neck_straight_mm": float(spec.get("neck_straight", 0.0)),
        "z_neck_bottom_mm": round(prof["z_neck_bottom"], 4),
        "z_finish_bottom_mm": round(prof["z_finish_bottom"], 4),
        "z_shoulder_start_mm": round(prof["z_shoulder_start"], 4),
        "datum_z_mm": spec["height"],
        "shape_measured": bool(spec.get("shape_measured", False)),
        "radial_segments": RADIAL_SEGMENTS,
        "verts": len(mesh.vertices),
        "faces": len(mesh.polygons),
        "tris": sum(len(p.vertices) - 2 for p in mesh.polygons),
        "brim_volume_ml": round(brim_ml, 2),
        "fill_to_shoulder_ml": round(shoulder_ml, 2),
        "liquid_fill_z_mm": round(fill_z, 3),
        "liquid_volume_ml": round(revolve_volume(prof["inner"], z_max=fill_z), 2),
        "label_arc_deg": round(math.degrees(arc), 1),
        "label_w_mm": spec["label_w"], "label_h_mm": spec["label_h"],
        "label_off_mm": spec["label_off"],
        "meshes": {"body": body_name, "liquid": liquid_name,
                   "label_front": lfront_name, "label_back": lback_name},
    }
    # Custom properties make the .blend self-documenting and feed the JSON
    # handoff without re-deriving anything. Nested values are JSON-encoded
    # because Blender ID properties only take flat scalars reliably.
    for k, v in meta.items():
        body[k] = json.dumps(v) if isinstance(v, dict) else v
    datum["seating_plane"] = "top_of_finish"
    datum["neck_finish"] = spec["neck"]
    datum["neck_bore_mm"] = spec["neck_I"]
    datum["neck_thread_mm"] = spec["neck_T"]
    datum["neck_base_z_mm"] = round(prof["z_neck_bottom"], 4)

    return {
        "meta": meta,
        "body": body,
        "liquid": liquid,
        "label_front": label_front,
        "label_back": label_back,
        "datum": datum,
        "export_objects": [body, liquid, label_front, label_back, datum],
        "materials": [glass.name, gold.name],
    }


def export_glb(path: Path, objects: List[bpy.types.Object]) -> Dict[str, object]:
    """
    Export the given objects as GLB per packaging-saas/public/models/MODELS.md:
    GLB binary, +Y up, modifiers applied, no lights or cameras.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    for obj in bpy.data.objects:
        obj.select_set(False)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]

    kwargs = dict(filepath=str(path), export_format="GLB", use_selection=True,
                  export_yup=True, export_apply=True, export_cameras=False,
                  export_lights=False)
    try:
        bpy.ops.export_scene.gltf(**kwargs, export_draco_mesh_compression_enable=True)
        draco = True
    except (TypeError, RuntimeError):
        # Draco is optional and absent in some builds — a plain GLB is still valid.
        bpy.ops.export_scene.gltf(**kwargs)
        draco = False
    return {"path": str(path), "draco": draco,
            "bytes": path.stat().st_size if path.exists() else 0}


# ─── Validation ─────────────────────────────────────────────────────────────

def validate(body: bpy.types.Object, spec: Dict[str, object]) -> List[Tuple[bool, str]]:
    """Phase 4 checks. Returns (passed, message) pairs."""
    mesh = body.data
    checks: List[Tuple[bool, str]] = []

    zs = [v.co.z for v in mesh.vertices]
    rs = [math.hypot(v.co.x, v.co.y) for v in mesh.vertices]

    # Blender stores vertex coordinates as float32, so representation error at
    # these magnitudes is ~2e-6 mm. Tolerance is 1 micron: four orders of
    # magnitude tighter than any glass moulding tolerance, but safely above
    # float32 noise. A tighter bound produces false failures on the larger sizes.
    TOL = 1e-3

    checks.append((abs(min(zs)) < TOL, f"base sits on Z=0 (min z = {min(zs):.4f} mm)"))
    checks.append((abs(max(zs) - spec["height"]) < TOL,
                   f"height = {max(zs):.3f} mm (target {spec['height']} mm)"))
    checks.append((abs(max(rs) * 2 - spec["diameter"]) < TOL,
                   f"max diameter = {max(rs) * 2:.3f} mm (target {spec['diameter']} mm)"))
    checks.append((tuple(round(s, 6) for s in body.scale) == (1.0, 1.0, 1.0),
                   f"scale applied {tuple(round(s, 3) for s in body.scale)}"))
    checks.append((tuple(round(c, 6) for c in body.location) == (0.0, 0.0, 0.0),
                   f"origin at base centre {tuple(round(c, 3) for c in body.location)}"))

    ngons = [p for p in mesh.polygons if len(p.vertices) > 4]
    checks.append((not ngons, f"no n-gons ({len(ngons)} found)"))

    used = {vi for p in mesh.polygons for vi in p.vertices}
    loose = [v for v in mesh.vertices if v.index not in used]
    checks.append((not loose, f"no loose vertices ({len(loose)} found)"))

    # Non-manifold check: every edge in a closed solid borders exactly 2 faces.
    edge_count: Dict[Tuple[int, int], int] = {}
    for p in mesh.polygons:
        vs = list(p.vertices)
        for a, b in zip(vs, vs[1:] + vs[:1]):
            edge_count[(min(a, b), max(a, b))] = edge_count.get((min(a, b), max(a, b)), 0) + 1
    bad = [e for e, c in edge_count.items() if c != 2]
    checks.append((not bad, f"manifold: all edges border 2 faces ({len(bad)} bad)"))

    # Directional capacity check. A bottle must physically hold AT LEAST its
    # labelled volume when filled to the shoulder — under-capacity is not a
    # tolerance question, it is an impossible product and means a dimension is
    # wrong. Over-capacity is normal headspace, but beyond ~40% suggests the
    # body is too tall for its label.
    #
    # This is what catches a bad height automatically: the 30 ml at the
    # previously-recorded 68 mm yields 27.9 ml, and fails here.
    # Capacity is gated on BRIM volume, not fill-to-shoulder.
    #
    # Earlier this checked fill-to-shoulder >= label. That only passed because
    # the walls were too thin (2.0 mm). At the real moulded thickness (2.45 mm
    # body, 5.5 mm base) a 78 x 33 mm Boston Round holds ~28 ml to the shoulder
    # — and real bottles are filled slightly into the shoulder, so that is
    # correct, not a defect. Brim capacity is the honest physical constraint:
    # the bottle must hold at least its label, with normal headspace above.
    brim = body.get("brim_volume_ml", 0.0)
    shoulder = body.get("fill_to_shoulder_ml", 0.0)
    target = float(spec["capacity"])
    head = (brim - target) / target * 100.0
    if brim < target:
        msg = (f"brim {brim:.1f} ml is BELOW the {target:.0f} ml label ({head:+.0f}%) "
               f"— bottle cannot hold its stated capacity")
    else:
        msg = (f"brim {brim:.1f} ml vs {target:.0f} ml label ({head:+.0f}% headspace); "
               f"fill-to-shoulder {shoulder:.1f} ml")
    checks.append((0.0 <= head <= 60.0, msg))

    if spec.get("threads", True):
        # The helix must actually reach the crest diameter, and the bore must
        # stay smooth or no fitment will insert.
        z_top = float(spec["height"])
        z_lo = z_top - min(float(spec["finish_h"]),
                           float(spec["neck_turns"]) * float(spec["neck_pitch"]))
        band = [math.hypot(v.co.x, v.co.y) for v in mesh.vertices
                if z_lo + THREAD_FADE_MM < v.co.z < z_top - THREAD_FADE_MM]
        if band:
            crest = max(band) * 2
            root = min(band) * 2
            checks.append((abs(crest - spec["neck_T"]) < 0.15,
                           f"thread crest {crest:.2f} mm (target {spec['neck_T']})"))
            checks.append((abs(root - spec["neck_E"]) < 0.6,
                           f"thread root {root:.2f} mm (target {spec['neck_E']})"))
        else:
            checks.append((False, "thread band contains no vertices"))
    return checks


# Mirrors packaging-saas src/components/three/bottle-model.tsx NAME, in the same
# order — the loader takes the FIRST match, so order is part of the contract.
STUDIO_MATCHERS = [
    ("label_front", r"label[_-]?front|front[_-]?label"),
    ("label_back", r"label[_-]?back|back[_-]?label"),
    ("liquid", r"liquid|fill|juice"),
    ("collar", r"collar|crimp|ferrule"),
    ("cap", r"cap|sprayer|pump|roller|dropper|closure|actuator|overcap|atomizer|nozzle"),
    ("body", r"body|glass|bottle|flacon"),
]


def categorise(name: str) -> Optional[str]:
    for cat, pattern in STUDIO_MATCHERS:
        if re.search(pattern, name, re.I):
            return cat
    return None


def validate_studio_contract(result: Dict[str, object]) -> List[Tuple[bool, str]]:
    """Check the build against the packaging studio's loader expectations."""
    checks: List[Tuple[bool, str]] = []
    want = {"body": "body", "liquid": "liquid",
            "label_front": "label_front", "label_back": "label_back"}
    for key, expect in want.items():
        obj = result[key]
        got = categorise(obj.name)
        checks.append((got == expect,
                       f"'{obj.name}' -> studio category '{got}' (want '{expect}')"))

    for key in ("label_front", "label_back"):
        mesh = result[key].data
        uv = mesh.uv_layers.active
        if uv is None:
            checks.append((False, f"{key}: no UV layer"))
            continue
        us = [d.uv[0] for d in uv.data]
        vs = [d.uv[1] for d in uv.data]
        ok = (abs(min(us)) < 1e-6 and abs(max(us) - 1) < 1e-6
              and abs(min(vs)) < 1e-6 and abs(max(vs) - 1) < 1e-6)
        checks.append((ok, f"{key}: UVs fill 0-1 "
                           f"(u {min(us):.3f}-{max(us):.3f}, v {min(vs):.3f}-{max(vs):.3f})"))

    tris = result["meta"]["tris"]
    checks.append((10_000 <= tris <= 40_000,
                   f"body {tris} tris (MODELS.md wants 10k-40k)"))
    lq = result["meta"]["liquid_volume_ml"]
    checks.append((lq > 0, f"liquid solid holds {lq} ml"))
    return checks


# ─── CLI ────────────────────────────────────────────────────────────────────

def resolve_spec(args: argparse.Namespace) -> Dict[str, object]:
    """Preset for the capacity, with any explicit override applied on top."""
    preset = dict(CAPACITY_SPECS[args.capacity])
    spec: Dict[str, object] = {"capacity": args.capacity, **preset}

    for key in ("height", "diameter", "wall", "shoulder_h", "base_th", "heel_r", "fill_z"):
        val = getattr(args, key, None)
        if val is not None:
            spec[key] = val
    if args.neck is not None:
        spec["neck"] = args.neck

    finish = NECK_FINISHES[str(spec["neck"])]
    spec["neck_T"] = args.neck_t if args.neck_t is not None else finish["T"]
    spec["neck_E"] = args.neck_e if args.neck_e is not None else finish["E"]
    spec["neck_I"] = args.neck_i if args.neck_i is not None else finish["I"]
    spec["finish_h"] = args.finish_h if args.finish_h is not None else finish["finish_h"]
    spec["neck_pitch"] = args.pitch if args.pitch is not None else finish["pitch"]
    spec["neck_turns"] = args.turns if args.turns is not None else finish["turns"]
    spec["bead_T"] = args.bead_t if args.bead_t is not None else finish.get("bead_T", 0.0)
    spec["bead_h"] = finish.get("bead_h", 0.0)
    spec["bead_below_rim"] = finish.get("bead_below_rim", 0.0)
    if args.no_bead:
        spec["bead_T"] = 0.0
    spec["neck_measured"] = finish.get("measured", False)
    spec["threads"] = not args.no_threads
    spec["glass"] = args.glass
    return spec


def parse_args(argv: List[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="build-boston-round.py",
        description="Build a parametric Boston Round bottle body in Blender.",
    )
    p.add_argument("--capacity", type=int, choices=sorted(CAPACITY_SPECS),
                   default=30, help="capacity preset in ml (default: 30)")
    p.add_argument("--output", type=Path, default=None,
                   help="path to save the .blend (omit to build without saving)")
    p.add_argument("--dry-run", action="store_true",
                   help="report computed geometry and volumes, write nothing")
    p.add_argument("--json", action="store_true",
                   help="emit the handoff metadata block as JSON on stdout")
    p.add_argument("--glass", choices=sorted(GLASS_TINTS), default="clear",
                   help="glass tint (volumetric absorption); default clear")
    p.add_argument("--keep-scene", action="store_true",
                   help="build into the current scene instead of clearing it")
    p.add_argument("--glb", type=Path, default=None,
                   help="also export a GLB for the packaging studio")
    p.add_argument("--fill-level", dest="fill_z", type=float, default=None,
                   help="liquid fill height in mm (default: the shoulder)")

    g = p.add_argument_group("dimension overrides (default: capacity preset)")
    g.add_argument("--height", type=float, help="bare height, mm")
    g.add_argument("--diameter", type=float, help="body outer diameter, mm")
    g.add_argument("--neck", choices=sorted(NECK_FINISHES), help="neck finish")
    g.add_argument("--wall", type=float, help="wall thickness, mm")
    g.add_argument("--shoulder-h", dest="shoulder_h", type=float, help="shoulder height, mm")
    g.add_argument("--base-th", dest="base_th", type=float, help="base glass thickness, mm")
    g.add_argument("--heel-r", dest="heel_r", type=float, help="heel fillet radius, mm")

    n = p.add_argument_group("neck finish overrides (default: NECK_FINISHES table)")
    n.add_argument("--neck-t", dest="neck_t", type=float, help="thread crest diameter, mm")
    n.add_argument("--neck-e", dest="neck_e", type=float, help="thread root diameter, mm")
    n.add_argument("--neck-i", dest="neck_i", type=float, help="bore diameter, mm")
    n.add_argument("--finish-h", dest="finish_h", type=float, help="finish height, mm")
    n.add_argument("--pitch", type=float, help="thread pitch (axial rise per turn), mm")
    n.add_argument("--turns", type=float, help="thread turns carried on the land")
    n.add_argument("--no-threads", action="store_true",
                   help="smooth thread land instead of a modelled helix")
    n.add_argument("--bead-t", dest="bead_t", type=float,
                   help="transfer bead outer diameter, mm")
    n.add_argument("--no-bead", action="store_true",
                   help="omit the transfer bead at the base of the neck")

    return p.parse_args(argv)


def main() -> int:
    # Blender passes everything after "--" to the script.
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = parse_args(argv)
    spec = resolve_spec(args)

    print(f"Boston Round body — {spec['capacity']} ml")
    print(f"  ref SKU      {spec.get('ref_sku', '-')}")
    print(f"  height bare  {spec['height']} mm")
    print(f"  diameter     {spec['diameter']} mm")
    print(f"  neck finish  {spec['neck']}  crest {spec['neck_T']} / root {spec['neck_E']} / "
          f"bore {spec['neck_I']} / h {spec['finish_h']} mm"
          f"   [{'MEASURED' if spec.get('neck_measured') else 'table, UNVERIFIED'}]")
    print(f"  thread       {'helix' if spec.get('threads', True) else 'smooth land'} · "
          f"pitch {spec['neck_pitch']} mm · {spec['neck_turns']} turns")
    if spec.get("bead_T"):
        print(f"  transfer bead Ø{spec['bead_T']} × {spec['bead_h']} mm, "
              f"{spec['bead_below_rim']} mm below the rim")
    print(f"  wall {spec['wall']} · shoulder {spec['shoulder_h']} · "
          f"base {spec['base_th']} · heel {spec['heel_r']} mm")
    print()

    try:
        result = build(spec, clear_scene=not args.keep_scene)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    meta = result["meta"]
    print(f"  shape source {'MEASURED (photo silhouette)' if meta['shape_measured'] else 'ESTIMATED'}")
    print(f"  mesh         {meta['verts']} verts · {meta['faces']} faces · "
          f"{meta['tris']} tris · {RADIAL_SEGMENTS} radial segments")
    print(f"  neck datum   z = {meta['datum_z_mm']} mm (top of finish)")
    print(f"  liquid       {meta['liquid_volume_ml']} ml to z={meta['liquid_fill_z_mm']} mm")
    print(f"  labels       {meta['label_arc_deg']}° arc · "
          f"{meta['label_w_mm']}x{meta['label_h_mm']} mm @ z={meta['label_off_mm']}")
    print(f"  brim volume  {meta['brim_volume_ml']} ml")
    print(f"  fill/shoulder {meta['fill_to_shoulder_ml']} ml "
          f"(labelled {spec['capacity']} ml)")
    print(f"  glass tint   {spec.get('glass','clear')}"
          f"{'  (volumetric absorption)' if spec.get('glass','clear') != 'clear' else ''}")
    print(f"  materials    {', '.join(result['materials'])}  "
          f"[gold: fake-user, unassigned]")
    print()

    print("Validation — geometry:")
    ok = True
    for passed, msg in validate(result["body"], spec):
        print(f"  {'PASS' if passed else 'FAIL'}  {msg}")
        ok = ok and passed
    print()
    print("Validation — packaging-studio contract:")
    for passed, msg in validate_studio_contract(result):
        print(f"  {'PASS' if passed else 'FAIL'}  {msg}")
        ok = ok and passed
    print()

    if args.json:
        print(json.dumps(meta, indent=2))
        print()

    if not args.dry_run and args.glb:
        info = export_glb(Path(args.glb).resolve(), result["export_objects"])
        print(f"GLB: {info['path']}  ({info['bytes'] / 1024:.0f} KB, "
              f"draco={'on' if info['draco'] else 'off'})")

    if args.dry_run:
        print("[DRY RUN] Nothing written.")
    elif args.output:
        out = Path(args.output).resolve()
        out.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(out))
        print(f"Saved: {out}")
    else:
        print("Built in-scene (no --output given, nothing saved).")

    return 0 if ok else 1


if __name__ == "__main__":
    _code = main()
    # Only hard-exit when headless. Inside a running Blender (MCP / scripting
    # tab) a SystemExit would abort the caller, so just leave the build in place.
    if bpy.app.background:
        sys.exit(_code)
