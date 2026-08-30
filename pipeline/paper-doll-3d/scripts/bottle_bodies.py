"""
bottle_bodies.py - Best Bottles: automated 3D bottle-body generation
====================================================================

WHAT THIS IS
------------
We own a straight-on, white-background photo of nearly every bottle we sell.
That photo's OUTLINE is the true profile. Combined with real millimetre
dimensions, an outline is enough to rebuild the bottle in 3D automatically.

  ROUND (cylinder, tapered, bulb)  -> LATHE:   spin the outline 360 degrees.
  BOXY  (square, rectangular)      -> EXTRUDE: sweep the top-down footprint
                                                upward along the same outline.

Everything else is identical: tracing, forcing true millimetres, the mount
point, export, and the validation gate.

Blender is the geometry engine only, headless. No materials, no lighting, no
rendering - the web configurator draws glass/frost/metal live, assigned by mesh
name. That is why the wall that stopped the manual Blender effort does not
exist here.

NOT IN SCOPE - sculpted bodies (Diva-type, faceted, embossed, asymmetric) are
not buildable from one silhouette: the outline describes the front view and
says nothing about the sides. shape_class=sculpted is reported as deferred.

HOW TO RUN
----------
    blender --background --python scripts/bottle_bodies.py -- \
        --ledger  pipeline/paper-doll-3d/bodies-3d.csv \
        --psd-root ~/Projects/.../Best-Bottles-Original-Photoshop-Sources \
        --out     pipeline/paper-doll-3d/glb

    ... -- --sku GBCyl9MtlRollMattSl        # one body
    ... -- --sku GBSqr15BlkSht --shape boxy # force a shape

CORRECTIONS APPLIED TO THE ORIGINAL PLAN (each one is load-bearing)
-------------------------------------------------------------------
1. SCREW merge_threshold. The plan set use_merge_vertices=True but left
   merge_threshold at its default, which Blender 5.2 reports as 0.01 m = 10 mm.
   A 9 ml bottle has a ~10 mm RADIUS, so the default would weld the entire body
   into its own axis. Now set explicitly to 1 micron.

2. Source is the PSD LAYER, not a PNG cutout. The layered sources carry true
   per-layer alpha, and the body is its own layer - no keying, no background,
   and no "cap sitting beside the bottle" problem to solve. The PNG path is
   kept as a fallback. (Cutouts also barely exist: the cutouts folder holds 10
   pilot files, not 2,290.)

3. Depth is NOT unobtainable. The plan skipped boxy bodies lacking a calipered
   depth. The live PDPs publish "Item Width" and "Item Depth" separately -
   1,840 of 2,288 SKUs are dimensionally complete - and the live site is the
   founder-designated tie-breaker. harvest_live_dims.py collects them.

4. Shape class comes from the data, not a new hand-filled column. A PDP that
   prints Diameter is round; one that prints Width and Depth is boxy. The
   source of truth already classifies every bottle.

5. Profile smoothing no longer shrinks the ends. np.convolve(mode="same") pads
   with ZEROS, so the 5-row average pulled the foot and mouth radii toward
   nothing - exactly the two places the silhouette must stay true. Now
   edge-padded.

6. Boxy necks are ROUND. A threaded finish is always circular, but sweeping a
   rounded rectangle all the way up leaves a square neck that no cap can seat
   on. Sections at and above the neck seat are forced circular, with a blend
   across the shoulder.

7. Datablocks are freed. The original removed the object but left its mesh
   behind; across a 2,000-row batch that is an unbounded leak.

8. Dimensions are read after a depsgraph update, so validation measures the
   evaluated mesh rather than a stale bound box.
"""

import argparse
import csv
import math
import os
import sys

import numpy as np
import bpy

MM = 0.001                  # ledger millimetres -> Blender/GLB metres
DEFAULT_CORNER_FRAC = 0.18  # boxy corner radius default: 18% of smaller side
MERGE_EPS = 1e-6            # 1 micron - see correction 1


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser(description="Batch-build bottle bodies to GLB")
    p.add_argument("--ledger", required=True, help="CSV of bodies to build")
    p.add_argument("--psd-root", default=None, help="Photoshop sources root (preferred outline source)")
    p.add_argument("--cutouts", default=None, help="fallback folder of {grace_sku}.png cutouts")
    p.add_argument("--out", required=True, help="output folder for .glb files")
    p.add_argument("--sku", default=None, help="process just one grace_sku")
    p.add_argument("--shape", choices=["round", "boxy"], default=None,
                   help="override shape_class for processed rows")
    p.add_argument("--segments", type=int, default=96,
                   help="points around the body (96 ~ smooth + lightweight)")
    p.add_argument("--profile-points", type=int, default=140,
                   help="points along the outline")
    p.add_argument("--tolerance-pct", type=float, default=0.5,
                   help="max allowed mismatch between model and ledger mm, in %%")
    p.add_argument("--keep-scene", action="store_true",
                   help="skip cleanup (single-SKU debugging: open the .blend after)")
    p.add_argument("--save-blend", default=None, help="write a .blend for inspection")
    return p.parse_args(argv)


# ---------------------------------------------------------------------------
# Stage 1 - read the body list
# ---------------------------------------------------------------------------

# Column aliases: the paper-doll ledger and the harvested live-dims table use
# different headers for the same measurement. Accepting both means the 3D lane
# does not need its own duplicate of the catalogue.
ALIASES = {
    "grace_sku":   ("grace_sku", "graceSku", "sku", "body_key"),
    "neck_finish": ("neck_finish", "neck_finishes", "finish"),
    "shape_class": ("shape_class", "shape"),
    "height_mm":   ("height_mm", "height_bare_mm", "bare_height_mm"),
    "diameter_mm": ("diameter_mm",),
    "width_mm":    ("width_mm",),
    "depth_mm":    ("depth_mm",),
    "corner_radius_mm": ("corner_radius_mm",),
    "neck_seat_mm":     ("neck_seat_mm",),
    "psd_path":         ("psd_path", "psd"),
}


def pick(row, key):
    for name in ALIASES[key]:
        if name in row and str(row[name]).strip():
            return str(row[name]).strip()
    return ""


def read_ledger(path, only_sku=None):
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            sku = pick(row, "grace_sku")
            if not sku or (only_sku and sku != only_sku):
                continue
            rows.append(row)
    return rows


def get_mm(row, key):
    try:
        v = float(pick(row, key))
        return v if v > 0 else None
    except ValueError:
        return None


def classify(row, override):
    """Correction 4 - the live catalogue already states the shape.

    A PDP that publishes a Diameter is describing a body of revolution; one
    that publishes Width and Depth is describing a box. No new hand-maintained
    column, and no guessing from the family name."""
    if override:
        return override
    declared = pick(row, "shape_class").lower()
    if declared in ("round", "boxy", "sculpted", "unknown"):
        # "unknown" is a RECORDED DECISION (the catalogue publishes a width but
        # no depth and no diameter), not a missing field to re-derive. Falling
        # through to the dims check would coerce it back to round.
        return declared
    if get_mm(row, "width_mm") and get_mm(row, "depth_mm"):
        return "boxy"
    if get_mm(row, "diameter_mm"):
        return "round"
    return "unknown"


# ---------------------------------------------------------------------------
# Stage 2 - trace the outline
# ---------------------------------------------------------------------------

def alpha_from_psd(psd_path):
    """Correction 2 - take the outline straight from the PSD's body layer.

    The layered sources store the bottle on its own layer with real alpha, so
    the silhouette is exact. The body is the tallest non-backdrop layer, which
    is also how the 2D compositor identifies it - one definition, both lanes."""
    from psd_tools import PSDImage
    psd = PSDImage.open(psd_path)
    best, best_area = None, 0
    for lyr in psd:
        im = lyr.composite()
        if im is None or im.mode != "RGBA":
            continue
        a = np.array(im)
        if a[..., 3].max() == 0:
            continue
        lit = a[..., :3][a[..., 3] > 128]
        if lit.size == 0 or (lit.mean() > 248 and lit.std() < 6):
            continue                      # flat white backdrop layer
        h = lyr.bottom - lyr.top
        w = lyr.right - lyr.left
        if w < 12 or h < 12:
            continue
        # greatest opaque AREA, not height - a sprayer dip tube out-heights a
        # squat body but never out-areas it.
        area = int((a[..., 3] > 128).sum())
        if area > best_area:
            best, best_area = a[..., 3] > 128, area
    if best is None:
        return None
    return np.flipud(best)                # PSD is top-down; we want foot-first


def alpha_from_png(png_path):
    """Fallback source. Blender's image.pixels are bottom-up already, so row 0
    is the foot."""
    img = bpy.data.images.load(png_path)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bpy.data.images.remove(img)
    return px[:, :, 3] > 0.5


def isolate_bottle(alpha):
    """Cap-off reference images can show the cap BESIDE the bottle. Group the
    occupied pixel columns into bands separated by empty gaps and keep the
    tallest - the bottle is always the tallest thing in frame.

    Not needed for the PSD path (the body is its own layer), but harmless
    there and essential for the PNG fallback."""
    col = alpha.any(axis=0)
    bands, start = [], None
    for x, occ in enumerate(col):
        if occ and start is None:
            start = x
        elif not occ and start is not None:
            bands.append((start, x)); start = None
    if start is not None:
        bands.append((start, len(col)))
    if not bands:
        return None

    def band_height(b):
        rows = np.where(alpha[:, b[0]:b[1]].any(axis=1))[0]
        return rows.max() - rows.min() if rows.size else 0

    x0, x1 = max(bands, key=band_height)
    mask = np.zeros_like(alpha)
    mask[:, x0:x1] = alpha[:, x0:x1]
    return mask


def trace_profile(alpha, n_points):
    """Walk the bottle foot-to-mouth; per pixel row record the HALF-WIDTH of
    the opaque span. Smooth lightly, then resample.

    Returns (y01, r01) with y01 = 0 at the foot, r01 normalised to the widest
    half-width. The photo contributes SHAPE ONLY; size is applied in stage 3."""
    rows = np.where(alpha.any(axis=1))[0]
    if rows.size == 0:
        return None
    y_lo, y_hi = rows.min(), rows.max()

    radii = []
    for y in range(y_lo, y_hi + 1):
        xs = np.where(alpha[y])[0]
        if xs.size == 0:
            radii.append(radii[-1] if radii else 0.0)
            continue
        radii.append((xs.max() - xs.min()) / 2.0)

    radii = np.array(radii, dtype=np.float64)
    if radii.size >= 5:
        # Correction 5: mode="same" zero-pads, which drags the foot and the
        # mouth toward zero radius - the two places the silhouette must stay
        # honest. Pad with the edge value instead.
        pad = 2
        padded = np.pad(radii, pad, mode="edge")
        radii = np.convolve(padded, np.ones(5) / 5.0, mode="valid")

    ys = np.linspace(0.0, 1.0, radii.size)
    ys_new = np.linspace(0.0, 1.0, n_points)
    radii_new = np.interp(ys_new, ys, radii)
    r_max = radii_new.max()
    if r_max <= 0:
        return None
    return [(float(y), float(r / r_max)) for y, r in zip(ys_new, radii_new)]


# ---------------------------------------------------------------------------
# Stage 3 - force TRUE millimetre size
# ---------------------------------------------------------------------------

def scale_profile(profile01, height_mm, across_mm):
    return [(r01 * (across_mm / 2.0) * MM, y01 * height_mm * MM)
            for y01, r01 in profile01]


# ---------------------------------------------------------------------------
# Stage 4 - build the solid
# ---------------------------------------------------------------------------

def _shade_smooth(obj):
    obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))
    obj.data.update()


def _revolve(name, profile_m, segments):
    """ROUND: a vertex chain in the X/Z plane, revolved about Z."""
    verts = [(0.0, 0.0, profile_m[0][1])]
    verts += [(r, 0.0, z) for r, z in profile_m]
    verts += [(0.0, 0.0, profile_m[-1][1])]
    edges = [(i, i + 1) for i in range(len(verts) - 1)]

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, edges, [])
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    screw = obj.modifiers.new("lathe", "SCREW")
    screw.axis = "Z"
    screw.angle = math.tau
    screw.steps = segments
    screw.use_merge_vertices = True
    screw.merge_threshold = MERGE_EPS     # correction 1 - default is 10 mm
    screw.use_normal_calculate = True

    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier="lathe")
    _shade_smooth(obj)
    return obj


def _rounded_rect_ring(hw, hd, r, n):
    """n points evenly spaced by arc length around a rounded rectangle, walked
    counter-clockwise from (hw, 0). r is clamped so it can never exceed either
    half-side; at full clamp the section becomes a circle, which is what lets a
    neck be round."""
    r = max(1e-9, min(r, hw, hd))
    sw, sd = 2.0 * (hw - r), 2.0 * (hd - r)
    q = math.pi * r / 2.0
    pieces = [
        (sd / 2, lambda s: (hw, s)),
        (q, lambda s: (hw - r + r * math.cos(s / r), hd - r + r * math.sin(s / r))),
        (sw, lambda s: (hw - r - s, hd)),
        (q, lambda s: (-hw + r + r * math.cos(math.pi / 2 + s / r),
                       hd - r + r * math.sin(math.pi / 2 + s / r))),
        (sd, lambda s: (-hw, hd - r - s)),
        (q, lambda s: (-hw + r + r * math.cos(math.pi + s / r),
                       -hd + r + r * math.sin(math.pi + s / r))),
        (sw, lambda s: (-hw + r + s, -hd)),
        (q, lambda s: (hw - r + r * math.cos(1.5 * math.pi + s / r),
                       -hd + r + r * math.sin(1.5 * math.pi + s / r))),
        (sd / 2, lambda s: (hw, -hd + r + s)),
    ]
    total = sum(length for length, _ in pieces)
    pts = []
    for k in range(n):
        t = total * k / n
        for length, pos in pieces:
            if t <= length + 1e-12:
                pts.append(pos(min(t, length))); break
            t -= length
        else:
            pts.append(pieces[-1][1](pieces[-1][0]))
    return pts


def _extrude(name, profile_m, depth_over_width, corner_r_m, ring_points,
             seat_z_m=None, blend_mm=6.0, max_hd=None):
    """BOXY: stack rounded-rectangle rings along the traced profile and skin
    them, fan-capping foot and mouth.

    Depth follows width proportionally (half_depth = half_width * D/W).

    Correction 6: a threaded neck is ROUND. Sweeping the rectangle all the way
    up leaves a square neck that no cap can seat on, so at and above the neck
    seat the section is forced circular (r = min(hw, hd)), blended over the
    last few millimetres of the shoulder so the transition is not a crease."""
    n = max(8, ring_points)
    verts, faces, ring_starts = [], [], []
    blend_m = blend_mm * MM
    if max_hd is None:
        max_hd = max(hw * depth_over_width for hw, _z in profile_m)
    for hw, z in profile_m:
        hw = max(hw, 1e-6)
        hd = max(hw * depth_over_width, 1e-6)
        r = corner_r_m
        if seat_z_m is not None:
            if z >= seat_z_m:
                t = 1.0
            elif z >= seat_z_m - blend_m:
                t = (z - (seat_z_m - blend_m)) / blend_m
            else:
                t = 0.0
            if t > 0.0:
                # Correction 10 - a threaded neck is a FULL-DIAMETER circle, so
                # the depth/width ratio must not carry into it. On a flat flask
                # (Crcl 105 x 89 wide x 29 deep) holding the ratio at the neck
                # squashes it to 0.33 of its width and the round-blend then
                # collapses it into a thin stem: the body renders as a mushroom
                # on a stalk. Converge depth TO width through the shoulder, so
                # the neck is a true circle of the traced half-width.
                # ...but never wider than the catalogue's depth. The shoulder
                # datum sits at 72% of max half-width, which on a disc flask is
                # still very wide; converging there unclamped doubled the body
                # (Crcl 100 measured 63.7 mm deep against a ledger 29).
                hd = min(hd + t * (hw - hd), max_hd)
                r = corner_r_m + t * (min(hw, hd) - corner_r_m)
        ring = _rounded_rect_ring(hw, hd, r, n)
        ring_starts.append(len(verts))
        verts.extend((x, y, z) for x, y in ring)

    for a, b in zip(ring_starts, ring_starts[1:]):
        for j in range(n):
            jn = (j + 1) % n
            faces.append((a + j, a + jn, b + jn, b + j))

    c0 = len(verts); verts.append((0.0, 0.0, profile_m[0][1]))
    c1 = len(verts); verts.append((0.0, 0.0, profile_m[-1][1]))
    a, b = ring_starts[0], ring_starts[-1]
    for j in range(n):
        jn = (j + 1) % n
        faces.append((c0, a + jn, a + j))
        faces.append((c1, b + j, b + jn))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    _shade_smooth(obj)
    return obj


def build_body(name, profile_m, segments, shape="round",
               depth_over_width=1.0, corner_r_m=0.004, seat_z_m=None,
               max_hd=None):
    if shape == "round":
        return _revolve(name, profile_m, segments)
    return _extrude(name, profile_m, depth_over_width, corner_r_m, segments,
                    seat_z_m=seat_z_m, max_hd=max_hd)


def derive_seat_z(profile_m, r_max_frac=0.72):
    """Where the neck begins, in metres, derived from the silhouette.

    The plan defaulted the seat to the TOP of the profile when neck_seat_mm was
    blank. That is the mouth, not the seat: a cap slides over the neck and
    rests on the shoulder ledge, so a mount at the mouth would float every
    component a neck-height too high. It also left correction 6 with nothing to
    work on - forcing "circular at and above the seat" does nothing if the seat
    is the last point.

    The neck is the narrow run above the widest part of the body, so: find the
    widest point, then walk up and take the first height whose half-width has
    fallen below r_max_frac of maximum. Bodies that never narrow (a plain
    cylinder with no shoulder) fall back to the top."""
    if not profile_m:
        return None
    r_max = max(r for r, _z in profile_m)
    i_max = max(range(len(profile_m)), key=lambda i: profile_m[i][0])
    for r, z in profile_m[i_max:]:
        if r <= r_max * r_max_frac:
            return z
    return profile_m[-1][1]


# ---------------------------------------------------------------------------
# Stage 5 - the snap point (the paper-doll joint)
# ---------------------------------------------------------------------------

def add_mount(body, neck_code, rim_z_m, shoulder_z_m=None):
    """Emit the closure attach datum at the RIM.

    Correction 9 - the datum is the rim, not the shoulder. The existing
    closure library (scripts/paper-doll-3d/components_17415.py) parents every
    roller, sprayer, pump and overcap to the neck datum at location (0,0,0)
    -"origin IS the rim datum"- and build-master-scene.py places
    BB_ATTACH_NECK at (0, 0, s["height"]), commented "closure seating plane".
    Zeroing a closure on the shoulder instead sinks it a whole neck-height
    into the glass.

    The shoulder height is still real and still needed - it is what makes a
    boxy neck round - so it is emitted alongside as a reference datum rather
    than conflated with the attach point.

    Named BB_ATTACH_NECK to match the house convention so the master scene and
    the configurator can consume these bodies unmodified; the finish is kept
    as a custom property rather than baked into the name."""
    mount = bpy.data.objects.new("BB_ATTACH_NECK", None)
    mount.empty_display_type = "ARROWS"
    mount.empty_display_size = 0.005
    mount.location = (0.0, 0.0, rim_z_m)
    mount["neck_finish"] = neck_code
    mount["datum"] = "rim"
    bpy.context.collection.objects.link(mount)
    mount.parent = body

    extras = [mount]
    if shoulder_z_m is not None:
        sh = bpy.data.objects.new("BB_REF_SHOULDER", None)
        sh.empty_display_type = "PLAIN_AXES"
        sh.empty_display_size = 0.004
        sh.location = (0.0, 0.0, shoulder_z_m)
        sh["datum"] = "neck_base"
        bpy.context.collection.objects.link(sh)
        sh.parent = body
        extras.append(sh)
    return extras


# ---------------------------------------------------------------------------
# Stage 6 - export
# ---------------------------------------------------------------------------

def export_glb(body, mounts, out_path):
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    for m in mounts:
        m.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        # export_draco_mesh_compression_enable=True,  # enable with the r3f
        #     Draco decoder wired up (delivery contract)
    )


# ---------------------------------------------------------------------------
# Stage 7 - verify against the catalogue
# ---------------------------------------------------------------------------

def validate(body, shape, height_mm, across_mm, depth_mm, tol_pct):
    # Correction 8: measure the EVALUATED object.
    bpy.context.view_layer.update()
    dx, dy, dz = (d / MM for d in body.dimensions)
    if shape == "round":
        checks = {"height_mm": (dz, height_mm), "diameter_mm": (max(dx, dy), across_mm)}
    else:
        checks = {"height_mm": (dz, height_mm), "width_mm": (dx, across_mm),
                  "depth_mm": (dy, depth_mm)}
    failures = []
    measured = {}
    for label, (got, want) in checks.items():
        measured[label] = round(got, 3)
        err = abs(got - want) / want * 100.0
        if err > tol_pct:
            failures.append(f"{label}: model {got:.2f} vs ledger {want:.2f} ({err:.2f}% off)")
    return failures, measured


# ---------------------------------------------------------------------------
# Batch loop
# ---------------------------------------------------------------------------

def find_psd(psd_root, sku):
    """Locate {sku}.psd anywhere under the sources root. Files carry an ordinal
    prefix ("1. GBCyl9MtlRollMattSl.psd"), so match on the suffix."""
    if not psd_root:
        return None
    target = f"{sku.lower()}.psd"
    for dirpath, _dirs, files in os.walk(psd_root):
        if "composites" in dirpath.lower():
            continue
        for fn in files:
            low = fn.lower()
            if low.endswith(target) or low == target:
                return os.path.join(dirpath, fn)
    return None


def free(obj):
    """Correction 7 - drop the mesh datablock too, or the batch leaks."""
    data = getattr(obj, "data", None)
    bpy.data.objects.remove(obj, do_unlink=True)
    if isinstance(data, bpy.types.Mesh) and data.users == 0:
        bpy.data.meshes.remove(data)


def process_row(row, args, report):
    sku = pick(row, "grace_sku")
    # One GLB per GLASS BODY, not per SKU: colour and closure are chosen in the
    # browser, so ~1,345 catalogue SKUs collapse to 58 distinct bodies. When the
    # ledger carries a body_id, the trace comes from the representative SKU's
    # silhouette but the asset is named for the body.
    out_name = (row.get("body_id") or "").strip() or sku
    neck = pick(row, "neck_finish") or "unknown"
    shape = classify(row, args.shape)

    if shape == "sculpted":
        report.append((sku, "SKIP", "tier 3 sculpted - outside modeler per glb-contract.md", ""))
        return
    if shape not in ("round", "boxy"):
        report.append((sku, "SKIP", "shape unknown - catalogue publishes a width "
                       "but no depth and no diameter; needs one caliper reading", ""))
        return

    height_mm = get_mm(row, "height_mm")
    seat_mm = get_mm(row, "neck_seat_mm")
    if shape == "round":
        across_mm, depth_mm = get_mm(row, "diameter_mm"), None
    else:
        across_mm = get_mm(row, "width_mm") or get_mm(row, "diameter_mm")
        depth_mm = get_mm(row, "depth_mm")
    if not height_mm or not across_mm:
        report.append((sku, "SKIP", "missing mm dims - harvest from the live site first", ""))
        return
    if shape == "boxy" and not depth_mm:
        report.append((sku, "SKIP", "boxy body missing depth_mm", ""))
        return

    # Blender's bundled Python has no psd_tools, so the cached silhouette PNG
    # written by extract_psd_silhouette.py is the normal source. Reading the
    # PSD directly is kept for the case where psd_tools IS importable.
    alpha, origin = None, ""
    if args.cutouts:
        png = os.path.join(args.cutouts, f"{sku}.png")
        if os.path.exists(png):
            alpha = alpha_from_png(png); origin = os.path.basename(png)
    if alpha is None:
        src = pick(row, "psd_path") or find_psd(args.psd_root, sku)
        if src and os.path.exists(src):
            try:
                alpha = alpha_from_psd(src); origin = os.path.basename(src)
            except ImportError:
                report.append((sku, "SKIP", "no silhouette PNG; run "
                               "extract_psd_silhouette.py first (Blender's "
                               "Python cannot read PSDs)", ""))
                return
    if alpha is None:
        report.append((sku, "SKIP", "no PSD layer or cutout found", ""))
        return

    alpha = isolate_bottle(alpha)
    if alpha is None:
        report.append((sku, "FAIL", "source has no opaque pixels", ""))
        return

    profile01 = trace_profile(alpha, args.profile_points)
    if profile01 is None:
        report.append((sku, "FAIL", "could not trace a profile", ""))
        return

    profile_m = scale_profile(profile01, height_mm, across_mm)
    # two distinct heights, two distinct jobs:
    #   rim      = top of the profile = the closure attach datum
    #   shoulder = where the silhouette narrows into the neck; drives the
    #              boxy round-neck blend, and is exported as a reference datum
    rim_z_m = profile_m[-1][1]
    shoulder_z_m = (seat_mm * MM) if seat_mm else derive_seat_z(profile_m)

    corner_mm = get_mm(row, "corner_radius_mm")
    if shape == "boxy" and not corner_mm:
        corner_mm = DEFAULT_CORNER_FRAC * min(across_mm, depth_mm)

    body = build_body(
        f"BB_BTL_{out_name}", profile_m, args.segments, shape=shape,
        depth_over_width=(depth_mm / across_mm) if depth_mm else 1.0,
        corner_r_m=(corner_mm * MM) if corner_mm else 0.004,
        seat_z_m=shoulder_z_m,
        max_hd=(depth_mm / 2.0 * MM) if depth_mm else None,
    )
    mounts = add_mount(body, neck, rim_z_m, shoulder_z_m)

    failures, measured = validate(body, shape, height_mm, across_mm, depth_mm,
                                  args.tolerance_pct)
    meas = " ".join(f"{k}={v}" for k, v in measured.items())
    if failures:
        report.append((sku, "FAIL", "; ".join(failures), meas))
    else:
        out_path = os.path.join(args.out, f"{out_name}.glb")
        export_glb(body, mounts, out_path)
        report.append((sku, "PASS", f"{out_path} [{shape}, from {origin}, "
                                    f"{len(body.data.polygons)} faces]", meas))

    if args.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=args.save_blend)
    if not args.keep_scene:
        for m in mounts:
            free(m)
        free(body)


def main():
    args = parse_args()
    os.makedirs(args.out, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)

    rows = read_ledger(args.ledger, args.sku)
    if not rows:
        print("No matching ledger rows."); return

    report = []
    for row in rows:
        try:
            process_row(row, args, report)
        except Exception as e:                      # one bad row must not stop a batch
            report.append((pick(row, "grace_sku"), "ERROR", repr(e), ""))

    print("\n=== bottle_bodies report ===")
    for sku, status, detail, meas in report:
        print(f"{status:5}  {sku}: {detail}" + (f"   [{meas}]" if meas else ""))
    counts = {}
    for _s, st, _d, _m in report:
        counts[st] = counts.get(st, 0) + 1
    print("  " + "  ".join(f"{k}={v}" for k, v in sorted(counts.items())))

    report_path = os.path.join(args.out, "body_report.csv")
    with open(report_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["grace_sku", "status", "detail", "measured"])
        w.writerows(report)
    print(f"\nReport written to {report_path}")


if __name__ == "__main__":
    main()
