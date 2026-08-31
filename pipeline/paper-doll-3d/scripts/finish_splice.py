#!/usr/bin/env python3
"""Replace a traced neck with its drawing-exact finish.

WHY
---
Bodies are lathed from a photograph, and a photograph gets the neck wrong. On
the 9 ml cylinder the silhouette traced 11.5 mm of neck where GBCyl10mlAmber
draws 13.76 mm, so a correct 17-415 cap seated on a correct BB_ATTACH_NECK
buried 4.12 mm of skirt in the shoulder. The cap was never the problem.

The house hierarchy settles which one yields: THREAD-STANDARD.md — "truth =
drawings + specs"; "photos, PSD measurements and prior renders are history,
not authority". So the drawing sets the finish and the trace keeps the body.

WHAT IT DOES
------------
Given the traced (r, z) silhouette and a FINISH_MASTERS entry:

  1. the finish datum is pinned at `rim - finish_h`. Catalogue height is
     untouched and BB_ATTACH_NECK does not move — every closure that already
     parents to the rim keeps working.
  2. everything above the datum is discarded and rebuilt from the drawing:
     a straight land at E/2, then the lip round into the rim.
  3. the BLEND_MM below the datum is eased from the traced radius to E/2 with
     a smoothstep, so the shoulder still belongs to this bottle instead of
     ending in a machined shelf. A hard cut here leaves a 2.5 mm flat ledge on
     the 9 ml — technically "shoulder -> ledge -> land at E/2" as the thread
     standard describes, but nothing like the glass.

THE THREAD IS NOT OPTIONAL
--------------------------
THREAD-STANDARD.md §0 is explicit about the construction method: every finish
is ONE canonical component, and "bottles never rebuild or scale a finish:
bodies terminate at the attachment datum (shoulder -> subtle ledge -> short
land at E/2) and INSTANCE the master's mesh datablock."

So this module only produces the BODY side — everything up to the datum. The
neck itself comes from build_finish_master(), which revolves the sheet's base
profile and EXACT-unions a true swept helix onto it (raised-cosine lens,
8 TPI, height-tapered run-outs). An earlier draft of this file synthesised a
smooth land at E/2 instead. That was wrong: it is not the drawing, it skips
the audited master, and §5's clay gate has nothing to grade.

Never tunable (§5): pitch, section widths, depth, band.
"""

from __future__ import annotations

import math

MM = 0.001
# Shoulder blend length. A FIXED 8 mm was wrong: on the 9 ml cylinder the
# radius only has to come in 2.5 mm (9.9 -> 7.40), so easing that over 8 mm
# produced a ~17 deg cone where GBCyl10mlAmber.pdf draws a straight Ø19.7 wall
# turning over an R2.2 corner — Jordan: "the shoulder needs to be more square".
#
# Scaling with the radial change keeps the slope roughly constant instead:
# the cylinder gets ~3 mm (steep, square), while a wide flask like Elegant 100
# (27.19 -> 7.75, a 19.4 mm drop) still gets the full 8 mm it genuinely needs.
# A fixed slope cannot serve both — that is why this is a ratio with a cap.
# Shoulder height, calibrated against LIVE PRODUCT PHOTOS.
#
# Two hand-measured bottles (scaled by their catalogue width):
#   9 ml cylinder  GBCyl9MtlRollBlkDot   1.21 mm on a 20 mm body  -> 0.061
#   Elegant 60     GBElg60SpryCu         3.03 mm on a 54 mm body  -> 0.056
#
# Shoulder height therefore tracks BODY WIDTH, not radial change. Scaling with
# radial change instead gave the Elegant 8.0 mm against a real 3.03 — 2.6x too
# tall — because a wide flask has a huge radial drop but still turns it in a
# short, near-flat shelf. Real glass shoulders are a mould radius, roughly
# proportional to the bottle, not to how far the wall has to come in.
BLEND_FRAC_OF_WIDTH = 0.06
BLEND_MIN_MM = 1.0
BLEND_MAX_MM = 8.0
LIP_STEPS = 6           # quarter-arc segments on the rim lip (diagnostic path)
LAND_MM = 1.5           # short land at E/2 the master's base overlaps into
LAND_TUCK_MM = 0.25     # taper tucking that land inside the master's wall



def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def blend_length_mm(across_mm):
    """Shoulder height from the bottle's WIDTH (see the calibration above)."""
    return max(BLEND_MIN_MM, min(BLEND_MAX_MM, across_mm * BLEND_FRAC_OF_WIDTH))


def splice_profile(profile_m, finish, rim_z_m, blend_mm=None,
                   terminate_at_datum=True):
    """Return (new_profile, datum_z_m). Profile is (r, z) in metres, ascending.

    `finish` is a FINISH_MASTERS entry: neck_d (E), finish_h, lip_r.

    terminate_at_datum=True (the production path, §0): the profile ENDS at the
    attachment datum on a short land at E/2, and build_finish_master() supplies
    the threaded neck above it.

    terminate_at_datum=False: append a smooth land and lip instead. Diagnostic
    only — it is not the drawing and must never ship.
    """
    finish_h = finish["finish_h"] * MM
    r_neck = finish["neck_d"] / 2.0 * MM
    lip_r = finish.get("lip_r", 0.5) * MM
    datum_z = rim_z_m - finish_h

    if blend_mm is None:
        across_mm = 2.0 * max(r for r, _z in profile_m) / MM
        blend_mm = blend_length_mm(across_mm)
    blend = blend_mm * MM

    if datum_z <= profile_m[0][1]:
        raise ValueError(
            f"finish {finish_h / MM:.2f} mm is taller than the whole bottle")

    out = []
    for r, z in profile_m:
        if z >= datum_z:
            break                       # the drawing owns everything above
        if z > datum_z - blend:
            w = smoothstep((z - (datum_z - blend)) / blend)
            r = r * (1.0 - w) + r_neck * w
        out.append((r, z))

    out.append((r_neck, datum_z))                  # the finish datum itself

    if terminate_at_datum:
        # §0: "short land at E/2", which the master's base overlaps, giving the
        # boolean real volume to resolve.
        #
        # The land TAPERS INWARD by LAND_TUCK_MM. Held straight at E/2 it is
        # exactly the master's own base radius, and two coincident cylindrical
        # walls leave the union an interior shell: 172 edges with THREE faces
        # at r=7.40 across the overlap. Tucking it inside makes the master's
        # surface the only skin there.
        #
        # This was hard to see because a much larger artefact hid it. glTF
        # SPLITS VERTICES AT SHARP EDGES, so a threaded finish round-trips as
        # ~6000 phantom "non-manifold" edges and drowns the real 187. Only
        # after verify_glb.py welded before counting did the true signal show.
        out.append((r_neck - LAND_TUCK_MM * MM, datum_z + LAND_MM * MM))
        return _dedupe(out), datum_z

    out.append((r_neck, rim_z_m - lip_r))          # straight land
    for k in range(1, LIP_STEPS + 1):
        a = (math.pi / 2.0) * k / LIP_STEPS
        out.append((r_neck - lip_r + lip_r * math.cos(a),
                    rim_z_m - lip_r + lip_r * math.sin(a)))

    return _dedupe(out), datum_z


def _dedupe(p, eps=1e-9):
    out = [p[0]]
    for q in p[1:]:
        if abs(q[0] - out[-1][0]) > eps or abs(q[1] - out[-1][1]) > eps:
            out.append(q)
    return out


def report(profile_m, spliced, finish, rim_z_m, datum_z):
    """Numbers for the build log — what actually changed, in millimetres."""
    def radius_at(prof, z):
        best, bd = None, 1e9
        for r, zz in prof:
            d = abs(zz - z)
            if d < bd:
                best, bd = r, d
        return best

    traced_neck = None
    r_neck = finish["neck_d"] / 2.0 * MM
    for r, z in reversed(profile_m):                # walk down from the rim
        if r > r_neck * 1.02:
            traced_neck = rim_z_m - z
            break

    return {
        "finish": f"{finish['neck_d']:.1f}E x {finish['finish_h']:.2f}h",
        "datum_z_mm": datum_z / MM,
        "traced_neck_len_mm": (traced_neck / MM) if traced_neck else float("nan"),
        "drawing_neck_len_mm": finish["finish_h"],
        "radius_at_datum_before_mm": radius_at(profile_m, datum_z) / MM,
        "radius_at_datum_after_mm": radius_at(spliced, datum_z) / MM,
        "blend_mm": blend_length_mm(2.0 * max(r for r, _z in profile_m) / MM),
    }
