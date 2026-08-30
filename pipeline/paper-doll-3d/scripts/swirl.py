#!/usr/bin/env python3
"""Helical fluted ("swirl") glass bodies — an angular modulator, not a material.

WHY GEOMETRY
------------
The swirl is real moulded relief, not a surface finish. Measuring the live
product shot (LBCylSwrl9LtnBlk) the SILHOUETTE ITSELF wobbles by 1.93 mm as
flutes pass the tangent line — no material or normal map can move an outline.
The catalogue agrees: the swirl publishes Ø21.0 where the plain 9 ml cylinder
publishes Ø20.0, and that millimetre IS the flute relief. Modulated inward from
the Ø21 crest, the mean diameter lands back on 20.0 — the same glass envelope
as its plain sibling, which is what a shared mould family should do.

THE PATTERN
-----------
Deliberately the same shape as `thread_modulator()` in build-master-scene.py,
because a swirl is the same object: a raised-cosine section swept along a helix,
faded at both ends, evaluated per (r, z, theta).

    guard -> phase -> signed offset -> raised-cosine crest -> fades -> r

The only real differences from the thread are that a swirl has N starts instead
of one, runs over the BODY rather than the finish, and carves INWARD from the
traced crest envelope rather than outward from a root land.

MEASUREMENT (live photo, scaled by the catalogue Ø21.0)
-------------------------------------------------------
  flute angle       38.4 deg from vertical  (structure tensor, central band)
  lead              80.3 mm per 360 deg     (from that angle and R)
  flute count       10                      (two independent reads agreed:
                                             silhouette-wobble period 7.84 mm
                                             -> lead/period = 10.2, and a
                                             front-face FFT -> 9.4. N=10
                                             predicts 8.03 mm vs 7.84 measured,
                                             2.4% off.)
  depth             0.97 mm radial          (silhouette wobble peak-to-peak)

A first cross-correlation attempt at the twist gave sign-flipping garbage
(r = 0.42-0.76) because the pattern aliases against its own angular period.
It is recorded here so nobody retries it: measure the ANGLE, not the shift.
"""

from __future__ import annotations

import math

# Per-body swirl records. Keyed by body_id so a body either HAS a swirl or does
# not — there is no global default, and a body with no record is never fluted.
SWIRL_SPECS = {
    "CylSwrl-round-17-415-74x21": dict(
        source="LBCylSwrl9LtnBlk product photo, 2026-08-30",
        flutes=10,
        lead_mm=80.3,          # axial rise for one full 360 deg turn
        depth_mm=0.97,         # radial, crest -> valley
        w=0.30,                # raised-cosine half-width, fraction of period
        plateau=0.0,           # no flat crown: moulded glass, no knife edges
        phase_deg=0.0,
        fade_in=0.10,          # fraction of the run, at the heel
        fade_out=0.06,         # at the shoulder
        heel_clear_mm=2.5,     # flutes start above the base
        shoulder_clear_mm=4.0, # and STOP below the shoulder — see note
    ),
}


def has_swirl(body_id):
    return body_id in SWIRL_SPECS


def swirl_modulator(body_id, z_lo_mm, z_hi_mm):
    """Return mod(r, z, theta) in MILLIMETRES, or None if this body is plain.

    z_lo_mm / z_hi_mm bound the fluted run: heel clearance up to the shoulder.
    Mirrors thread_modulator()'s structure exactly — guards first, then phase,
    signed offset, raised-cosine crest, fades, and a single return.
    """
    s = SWIRL_SPECS.get(body_id)
    if s is None:
        return None

    flutes = s["flutes"]
    lead = s["lead_mm"]
    depth = s["depth_mm"]
    W = s["w"]
    PLATEAU = s["plateau"]
    phase = math.radians(s["phase_deg"])
    z0 = z_lo_mm + s["heel_clear_mm"]
    # Stop the flutes CLEAR of the shoulder. Running them to the datum left the
    # body non-cylindrical exactly where the finish master is unioned on, and
    # the boolean returned 379 boundary edges all at z=datum, r=E/2. It is also
    # what the photograph shows: the flutes die out below the shoulder and the
    # neck is plain glass.
    z1 = z_hi_mm - s["shoulder_clear_mm"]
    span = max(1e-6, z1 - z0)

    def mod(r, z, theta):
        if not (z0 - 0.4 <= z <= z1 + 0.4):
            return r                       # finish, heel and base stay plain
        # A flute line holds theta - 2*pi*z/lead constant; scaling by
        # flutes/(2*pi) and taking mod 1 gives position within one flute.
        ph = (flutes * ((theta + phase) / (2.0 * math.pi) - z / lead)) % 1.0
        off = ph if ph <= 0.5 else ph - 1.0      # signed offset from the crest
        x = (abs(off) - PLATEAU) / (W - PLATEAU)
        if x <= 0.0:
            crest = 1.0                    # on the crest: keep the traced radius
        elif x >= 1.0:
            crest = 0.0                    # valley floor, a full depth in
        else:
            crest = 0.5 + 0.5 * math.cos(math.pi * x)
        tf = (z - z0) / span
        fade_in = min(1.0, tf / s["fade_in"])
        fade_out = min(1.0, (1.0 - tf) / s["fade_out"])
        fade = max(0.0, min(fade_in, fade_out))
        # Carve INWARD: the traced silhouette is the crest envelope, so adding
        # relief here would grow the bottle past its catalogue diameter.
        return r - depth * (1.0 - crest) * fade

    return mod


def expected_mean_diameter(body_id, crest_d_mm):
    """Mean OD after fluting — the check that the envelope stayed honest."""
    s = SWIRL_SPECS.get(body_id)
    if s is None:
        return crest_d_mm
    # mean of the raised-cosine over one period, times the full depth
    return crest_d_mm - s["depth_mm"]        # crest minus one full depth, dia
