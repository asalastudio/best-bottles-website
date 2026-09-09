#!/usr/bin/env python3
"""
THE UNIVERSAL LIGHT CONE — one continuous source, nothing you can count.

    python3 scripts/make_universal_softbox.py [--check]

WHY THIS REPLACES THE HYBRID RIG
--------------------------------
The shipping studio was a photographed HDRI (Poly Haven studio_small_08) with
two feathered quads composited over it in-scene. Jordan: "There are too many
lines. It needs to be a softbox, not individual. NO CARDS."

Both halves were printing lines, and the cards were only the half we could see
in the source:

  * the CARDS were flat quads. Feathering the texture softens a quad's EDGE,
    but the quad is still a small bright rectangle floating in a dark room, so
    a cylinder mirrors it as a discrete band. You cannot feather your way out
    of a source being small.
  * the PHOTOGRAPHED HDRI underneath carried a real studio's ceiling — bare
    fixtures, a window, a doorway. Every one of those is its own bright patch,
    and every bright patch is another line down the glass. Removing the cards
    alone would have left those.

So the environment is now SYNTHESISED END TO END. No photographic base, no
in-scene geometry: the dome IS the softbox.

THE SHAPE IS A CONE (Jordan: "think of it like a light cone — it really is")
---------------------------------------------------------------------------
This is the tabletop rig for shiny things: a truncated cone of diffusion
standing around the subject, open at the bottom, lit from outside. It is what
you reach for on chrome and glass precisely BECAUSE it erases individual
sources — the fabric integrates every lamp behind it into one continuous wall
of light.

That geometry is the fix, and it is stronger than "make the panels bigger":

    a source that is CONTINUOUS IN AZIMUTH has no azimuth to be AT.

A cylinder mirrors a vertical slice of the world, so a discrete source appears
as a line at whichever orbit angle faces it — that is what every failed rig
here has been, cards included. Wrap the source through all 360 deg and no such
angle exists. The lines cannot come back, at any orbit position, because there
is no longer anything discrete to reflect. Softness stops being a value to
tune and becomes a property of the shape.

The cone is defined by three things, all below:

  1. THE WALL, in elevation. Brightest in the upper band and grading away both
     ways — down toward the open bottom, up toward the apex. That vertical
     grade is the drape: the sheen runs DOWN the body (Jordan: "lower, more
     wrapped down the body, not on the cap") instead of capping the shoulder.
  2. THE KEY, in azimuth. A cone lit from one side is brighter on that side.
     This is a single gentle cosine — no edges anywhere in it — which is what
     gives form and "a little gloss when needed". Turn KEY_AMOUNT to 0 and the
     rig goes perfectly symmetric: flawless, and completely flat. The whole
     art is that this stays SMALL.
  3. THE FLOOR, the sweep the cone stands on. Broad, dim, axially symmetric.

WHY THIS DOES NOT VIOLATE [[glass-env-no-horizon-sources]]
----------------------------------------------------------
That law says punch must come from above, because a source at bottle height
mirrors at the silhouette and paints a full-height line. It was written about
NARROW sources — five rigs died on exactly that. An azimuthally COMPLETE band
is immune by construction: it has no bright azimuth and no dark azimuth, so
the thing the law prohibits cannot form. That is why this cone may reach down
the body where a panel may not, and it is the reason the wrap finally works.

ONE ENVIRONMENT, EVERY FINISH. Glass needs transmission, metal needs full
mirror coverage with no black quadrant to orbit into, matte needs level. A
closed cone gives all three from one shape. Per-finish variation lives in the
material recipes, never in swapping environments.

--check reports how many distinct bright regions a cylinder can mirror, and
how wide each one is. That is the acceptance test for "not too many lines":
few regions, each broad.
"""
import math, pathlib, sys
import numpy as np

W, H = 2048, 1024                      # 2k: the panels are smooth, so this is
                                       # about gradient quality, not detail
OUT_NAME = "studio-universal-softbox.hdr"
ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT_PIPE = pathlib.Path(__file__).resolve().parents[1] / OUT_NAME
OUT_WEB  = ROOT / "public" / "env" / OUT_NAME

# theta = azimuth, 0 = toward camera, +ve = camera-left. phi = polar, 0 = up.
#
# HOW A CYLINDER ACTUALLY SAMPLES THIS SPHERE — the geometry that decides
# every number below, and that the first three versions of this file got
# wrong by guessing instead of deriving.
#
# Take a vertical cylinder, a level camera, and a point on the wall at angle
# psi around it (psi = 0 faces the camera). The wall normal is horizontal,
# n = (sin psi, 0, cos psi), so the reflected view ray is
#
#     r = 2(n.v)n - v = (sin 2psi, -v_y, cos 2psi)
#
# Two consequences, and they are the whole design:
#
#   1. r's ELEVATION is -v_y — it does not depend on psi at all. Every point
#      across the bottle's width reflects the environment at essentially the
#      SAME elevation, near the horizon. That is why a band placed 40 deg up
#      lit only cap tops and left the bodies dead: the body cannot see it.
#   2. r's AZIMUTH is 2psi. As the eye travels across the visible face, it
#      sweeps the environment's azimuth at DOUBLE rate — the full 360 deg is
#      compressed into the bottle's width.
#
# So structure across a bottle IS azimuthal structure at horizon elevation.
# Which means the two failures chased through this whole rig are one
# phenomenon seen twice:
#
#     a "line" and a "beautiful sheen" are BOTH a bright azimuthal feature.
#     Many narrow ones read as lines. ONE broad soft one reads as the
#     reflection. Zero of them reads as matte.
#
# That is the entire story of this file. v0 (photographed room + two quads)
# had six or seven narrow features: Jordan, "there are too many lines". v1-v3
# were azimuthally UNIFORM, which is the opposite error and cost the gloss:
# Jordan, "the light cone drains out the beautiful reflection". Neither was a
# tuning problem; both were this geometry.
#
# The rig therefore splits cleanly in two, and the two halves do not compete:
#
#   ELEVATION (the cone wrap) — broad, low, axially complete. Decides WHICH
#       PARTS get lit: body, shoulder, cap top. Cannot create lines, because
#       lines are azimuthal.
#   AZIMUTH (the key lobe)    — ONE soft, wide, bright lobe on a dark floor.
#       This is the reflection itself. Its WIDTH is the whole game: wide
#       enough to read as a softbox draping the glass, never narrow enough to
#       read as a stripe, and never more than one of it.
#
CONE_PEAK   = 1.20   # rad from vertical where the wall is brightest (~69 deg,
                     # i.e. LOW — only ~21 deg above the horizon).
                     #
                     # This is the number the first three attempts got wrong,
                     # and the reason is geometry, not taste. A vertical
                     # cylinder is a vertical mirror: viewed from a level
                     # camera, its body shows you what sits at ROUGHLY CAMERA
                     # ELEVATION. Put the band at 40 deg from vertical and it
                     # reflects off nothing but cap tops — which is exactly
                     # what the previous render did, silver cap reading black.
                     # To lay a sheen down the BODY the band has to sit near
                     # the horizon. Jordan asked for precisely this in words
                     # before I had the geometry: "a softbox light lower, more
                     # wrapped down the body, not on the cap."
                     #
                     # This is also the one place the cone earns its keep over
                     # a panel. [[glass-env-no-horizon-sources]] bans sources
                     # here because a NARROW one prints a full-height line at
                     # whichever azimuth faces it. A band that is complete in
                     # azimuth has no such azimuth, so it may go exactly where
                     # a panel may not — and low is where the light has to be.
CONE_UP     = 0.45   # falloff toward the apex — generous, merging into DOME so
                     # there is no seam between band and overhead fill.
CONE_DOWN   = 0.28   # falloff toward the open bottom — TIGHT on purpose. This
                     # is the softbox's bottom edge, and that edge is the
                     # single most valuable feature in the whole environment:
                     # it is the defined boundary the glass holds and shows as
                     # a bright sheen dying into shadow. Widen it and the
                     # bottle goes matte again (v2's mistake).
                     #
                     # THESE TWO ARE WHY v2 LOOKED MATTE. v1 ran them at
                     # 0.62/0.78 — +/-40 deg — which smears the wall across
                     # most of the sky. A glossy surface MIRRORS the world, so
                     # if the world is a gentle gradient everywhere, the mirror
                     # shows a gentle gradient everywhere, and that is
                     # indistinguishable from matte shading. Jordan: "the light
                     # cone drains out the beautiful reflection."
                     #
                     # The reflection you actually want IS the softbox's edge:
                     # a defined bright band with dark above and below it, so
                     # the glass has a boundary to hold. Tight here does NOT
                     # bring the lines back, because lines are a function of
                     # AZIMUTH (see KEY_DARK) and this is elevation. A band
                     # that is tight in elevation and complete in azimuth reads
                     # as a sheen wrapping the bottle — which is the thing a
                     # real light cone shows you from the inside.
CONE_I      = 1.0    # the wall is now shaped by the azimuth lobes above,
                     # which carry the radiance; this stays 1.0 unless the
                     # elevation profile itself needs re-weighting.

DOME_I      = 0.70   # broad overhead fill, axially symmetric. Required once
                     # the band went tight: at CONE_UP 0.23 the sky straight
                     # up is essentially black, which leaves cap TOPS dead —
                     # and cap tops are most of what you see on a closure.
                     # Wide and dim, so it lifts the top without softening the
                     # band's edge or adding anything countable.

# ---- AZIMUTH: the reflection ------------------------------------------------
KEY_AZIMUTH = -0.62  # where the cone is lit from — camera-left, per Jordan's
                     # "nice key light at the left corner".
KEY_WIDTH   = 0.60   # Gaussian sigma of the lobe, radians. THE ONE NUMBER
                     # THAT TRADES JORDAN'S TWO COMPLAINTS AGAINST EACH OTHER,
                     # because of the 2psi doubling above: the lobe's apparent
                     # width on the bottle is HALF its width in the
                     # environment. At 0.60 rad sigma the sheen covers roughly
                     # a third of the visible face — a softbox draping the
                     # glass.
                     #   narrower than ~0.3  -> a stripe. The lines come back.
                     #   wider than ~1.2     -> it wraps the whole face, there
                     #                          is no dark left to contrast
                     #                          against, and the bottle goes
                     #                          matte again.
KEY_PEAK    = 9.0    # radiance at the lobe centre, against a dark surround.
                     # HIGH ON PURPOSE. A specular highlight is a RATIO, not a
                     # level: real softboxes run 50-200x the room around them,
                     # and v3 shipped a peak only 5x its own mean, which is why
                     # it read as diffuse shading no matter where the band sat.
                     # The retired environment ran 32x — its reflections were
                     # genuinely beautiful, and its only real sin was having
                     # six of them.
KEY_DARK    = 0.110  # THE MOST IMPORTANT NUMBER IN THE FILE. How dark the far
                     # side of the cone goes, as a fraction of the lit side.
                     #
                     # v1 shipped this as a +/-0.34 wobble about 1.0 — a 2:1
                     # range — and Jordan: "the light cone drains out the
                     # beautiful reflection." That is the classic light-tent
                     # failure on chrome, and it is not a flaw in the cone, it
                     # is a flaw in its contrast. A mirror shows you the world;
                     # if the world is uniformly bright the mirror is uniformly
                     # bright, which is grey mush. What reads as a beautiful
                     # reflection is the EDGE BETWEEN BRIGHT AND DARK, so the
                     # rig must supply real darkness for the glass to hold.
                     #
                     # That is why product shooters flag a light tent with
                     # black card. Here the flag is built in: the back of the
                     # cone runs ~9:1 down on the front, a genuine dark field —
                     # but it arrives as one smooth cosine over 180 deg, so it
                     # grades and never prints an edge.
                     #
                     # Held at 0.110 rather than pushed lower because the far
                     # side of the cone is what amber and cobalt TRANSMIT. Take
                     # it to near-zero and the dark glass reads black, which
                     # the acceptance criteria forbid. The body's contrast is
                     # carried mostly by the band's lower edge in ELEVATION
                     # anyway, so azimuth can afford to stay generous — and a
                     # dark back also keeps the old white-halo artefact from
                     # forming behind the bottle.
                     #
                     # The two failure directions, so this is tunable later:
                     #   toward 1.0 -> flat, dead, "drained" (v1's mistake)
                     #   toward 0.0 -> the lit lobe narrows into something that
                     #                 reads as a discrete source again, and
                     #                 the lines come back.
RIM_OFFSET  = 2.55   # a SECOND, much weaker lobe, well round from the key —
                     # the rim light of a two-light glass setup. It is what
                     # puts a bright edge on the far side of the bottle so the
                     # silhouette reads. Deliberately the only other azimuthal
                     # feature in the environment: two soft sheens is a studio,
                     # six is the artefact Jordan rejected.
RIM_WIDTH   = 0.52
RIM_PEAK    = 2.3    # ~1/4 of the key. Any stronger and it stops reading as an
                     # edge and starts reading as a second light.

EXPOSURE    = 0.338  # ONE overall level, so every number above stays a
                     # description of the CONE'S SHAPE and none of them is
                     # secretly doing exposure. Calibrated: the outgoing
                     # environment measures 0.746 sin-weighted mean radiance,
                     # and this lands the cone at the same level. That matters
                     # right now because every material was just reset to
                     # envMapIntensity 1.0 — swapping in a brighter world
                     # would silently re-tune all 45 of them, and the black cap
                     # would go milky exactly as it did under the old boosts.
                     # Change the studio's BRIGHTNESS here; never by editing
                     # CONE_I, which would change its shape too.

AMBIENT     = 0.030  # the dome floor. Its only job is that a metal never
                     # orbits into a black void. Cut from 0.10 with KEY_DARK:
                     # an ambient lift is contrast subtracted from every
                     # surface at once, so it undoes the dark field everywhere
                     # rather than in the one place you meant. It also blankets
                     # the glass in face sheen and washes amber toward neutral
                     # — the failure the room profile documents at length.
FLOOR_I     = 0.17   # sweep bounce under the cone. Broad, smooth, symmetric.
WARM        = (1.000, 0.988, 0.962)  # the sweep, barely warm. The WALL is
                     # strictly neutral: silver only stays silver under
                     # neutral light, and this one env serves every finish.

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def build():
    phi = (np.arange(H) + 0.5) / H * math.pi
    theta = (np.arange(W) + 0.5) / W * 2 * math.pi - math.pi
    P, T = np.meshgrid(phi, theta, indexing="ij")
    up = np.cos(P)

    # ELEVATION — the cone wall. Broad and low, so the sheen lands on the BODY
    # (see the geometry note: the body can only see near-horizon elevations).
    # Axially complete, so nothing here can print.
    d = P - CONE_PEAK
    wall = np.exp(-(d ** 2) / (2 * np.where(d < 0, CONE_UP, CONE_DOWN) ** 2))
    # broad overhead fill so cap TOPS have something to catch — they face up,
    # so the wall alone never reaches them. Smooth, symmetric, cannot print.
    dome = DOME_I * np.clip(up, 0, 1) ** 1.5

    # AZIMUTH — the reflection itself. One wide soft key lobe plus one much
    # weaker rim, on a dark floor. Wrapped angular distance so both are
    # continuous across the +/-pi seam.
    def lobe(centre, width):
        a = (T - centre + math.pi) % (2 * math.pi) - math.pi
        return np.exp(-(a ** 2) / (2 * width ** 2))
    key = (KEY_DARK
           + KEY_PEAK * lobe(KEY_AZIMUTH, KEY_WIDTH)
           + RIM_PEAK * lobe(KEY_AZIMUTH + RIM_OFFSET, RIM_WIDTH))

    # the wall carries the azimuthal structure; the dome only leans toward the
    # key side, so cap tops are modelled without becoming a third feature.
    cone = CONE_I * wall * key + dome * (0.30 + 0.70 * np.clip(key / KEY_PEAK, 0, 1))

    floor = FLOOR_I * smoothstep(0.05, -1.00, up)
    base = AMBIENT + 0.06 * smoothstep(-0.90, 0.95, up)

    img = np.stack([(base + cone) * 1.000 + floor * WARM[0],
                    (base + cone) * 0.998 + floor * WARM[1],
                    (base + cone) * 1.000 + floor * WARM[2]], axis=-1)
    return (img * EXPOSURE).astype(np.float32)


def check(img):
    """Acceptance test for 'too many lines'.

    A vertical cylinder mirrors the environment: at each camera azimuth it
    shows a vertical slice of the sphere, so what the eye counts as LINES is
    the number of separate bright regions in azimuth. Sum the sphere down to
    an azimuth profile and count runs above half-peak — that is the number of
    distinct sheens a bottle can show, and each run's width is how broad they
    are. Few and wide passes; many or narrow is the artefact.
    """
    lum = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    # weight by sin(phi): equirect over-samples the poles
    w = np.sin((np.arange(H) + 0.5) / H * math.pi)[:, None]
    prof = (lum * w).sum(0) / w.sum()
    hot = prof > 0.5 * prof.max()
    runs, i = [], 0
    while i < W:
        if hot[i]:
            j = i
            while j < W and hot[j]:
                j += 1
            runs.append((i, j - i))
            i = j
        else:
            i += 1
    # wrap-around merge: azimuth is a circle
    if len(runs) > 1 and hot[0] and hot[-1]:
        s, n = runs.pop(0)
        runs[-1] = (runs[-1][0], runs[-1][1] + n)
    print(f"  peak luminance      {lum.max():6.2f}   (keep under 24: above that "
          f"the peak-clamp exists because hot texels speckle as fireflies)")
    print(f"  mean luminance      {lum.mean():6.3f}")
    contrast = prof.max() / max(prof.min(), 1e-6)
    print(f"  azimuth contrast   {contrast:6.1f}:1  <- bright side vs dark side. "
          f"THIS is the reflection.")
    print(f"                              a cone with no contrast is a light tent: "
          f"no lines, and no")
    print(f"                              reflection either. Want >= 8:1; "
          f"v1 shipped 2:1 and read dead.")
    print(f"  bright regions      {len(runs)}  <- how many sheens a cylinder can show")
    for s, n in runs:
        print(f"    - {n / W * 360:5.1f} deg wide, centred {(s + n / 2) / W * 360 - 180:+6.1f} deg")
    narrow = [n for _, n in runs if n / W * 360 < 25]
    if narrow:
        print(f"  FAIL: {len(narrow)} region(s) under 25 deg — narrow sources print hard lines")
    else:
        print("  PASS: every bright region is broad; reflections grade, they do not stripe")


def write_hdr(path, img):
    """Radiance RGBE, written by hand so this needs nothing but numpy."""
    h, w, _ = img.shape
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n")
        f.write(f"-Y {h} +X {w}\n".encode())
        m = img.max(axis=2)
        e = np.zeros_like(m, dtype=np.int32)
        nz = m > 1e-32
        mant, ex = np.frexp(m[nz])
        e[nz] = ex + 128
        scale = np.zeros_like(m)
        scale[nz] = mant * 256.0 / m[nz]
        rgbe = np.zeros((h, w, 4), dtype=np.uint8)
        for k in range(3):
            rgbe[..., k] = np.clip(img[..., k] * scale, 0, 255).astype(np.uint8)
        rgbe[..., 3] = np.clip(e, 0, 255).astype(np.uint8)
        f.write(rgbe.tobytes())


if __name__ == "__main__":
    img = build()
    print(f"universal softbox  {W}x{H}")
    check(img)
    if "--check" not in sys.argv:
        for p in (OUT_PIPE, OUT_WEB):
            write_hdr(p, img)
            print(f"  wrote {p}")
