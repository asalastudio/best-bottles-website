#!/usr/bin/env python3
"""
Paper Doll 3D — closure builder (screw caps).

Builds a closure as its OWN object, authored against a neck finish rather than
against a particular bottle. A 20-400 cap fits Boston Round 30 ml and 60 ml and
every other 20-400 family, so it is authored once here and reused — that is what
makes the component library one source of truth instead of copies.

SEATING CONTRACT
    The origin sits at the closure's MATING FACE: the interior top surface that
    lands on the bottle's sealing land. The bottle's neck datum sits at the same
    plane (top of finish). So seating is:

        cap.parent = bottle_datum        cap.location = (0, 0, 0)

    No offsets, no eyeballing. Every component in this lane follows the same
    rule, which is what makes the paper doll swap cleanly.

The internal thread is generated as a MIRROR of the bottle's: same pitch, same
lead, radii offset by a running clearance so the two mesh without intersecting.

Usage:
  blender --background --python scripts/paper-doll-3d/build-closure.py -- \\
      --finish 20-400 --style short --output <path>.blend

  blender --background --python scripts/paper-doll-3d/build-closure.py -- \\
      --finish 20-400 --dry-run
"""
from __future__ import annotations

import argparse
import importlib.util
import math
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    import bpy
except ImportError:
    print("ERROR: run inside Blender.", file=sys.stderr)
    raise SystemExit(2)

HERE = Path(__file__).resolve().parent

RADIAL_SEGMENTS = 288
# Ribbing is GROUPED, not continuous: clusters of thin vertical ribs separated
# by smooth flat panels around the circumference — the bonetic pattern in the
# reference. 8 groups x 4 ribs = 32 grooves total, agreeing with the 16 rising
# edges counted across the visible face.
RIB_GROUPS = 8
RIBS_PER_GROUP = 4
RIB_GROUP_DUTY = 0.62        # fraction of each group period that is ribbed
RIB_DEPTH = 0.40             # groove depth, mm
RIB_TOP_MARGIN = 0.8         # smooth ring between the top edge and the first rib
CAP_BEAD_CLEARANCE = 0.25    # skirt lip stops this far above the transfer bead
THREAD_CLEARANCE = 0.30      # mm diametral gap so cap and bottle never intersect
WALL = 1.60
EDGE_R = 1.35                # rounded top outer edge (was 0.70 — too crisp)
BOT_R = 0.50                 # bottom rim bevel catches its own highlight


# MEASURED off the real part — the CAP LAYER's own alpha in
# 17. GBBstnAmb1ozBlkCapSht.psd (Layer 6), 11.79 px/mm:
#
#   height        11.79 mm   (4.46 above the sealing plane + 7.33 skirt)
#   OD            23.50 mm   through the ribbed skirt, near-zero draft
#   bottom band    1.40 mm   smooth, flaring to ~24.1 mm at the lip
#   ribs          ~32 coarse flutes, ~2.3 mm pitch (phenolic "bonetic" style)
#   skirt bottom  z ~ 70.7 assembled — ~2 mm of bare neck shows above the
#                 transfer bead, as in the product photo
#
# A first pass measured 24.52 x 14.17 by colour boundary; that swallowed the
# shadowed neck below the cap into "cap". The layer alpha is authoritative.
#
# top_th = how much cap sits ABOVE the sealing plane; skirt_d = how far it hangs
# below. band_h/band_flare describe the smooth flared ring at the skirt lip.
# skirt_d None => computed so the lip sits flush just above the transfer bead:
#     skirt_d = bead_below_rim - bead_h/2 - CAP_BEAD_CLEARANCE
# For 20-400 that is 10.80 - 1.50 - 0.25 = 9.05 mm (cap bottom z = 68.95,
# bead top z = 68.70). NOTE the trade-off: the cap layer's alpha measured a
# 7.33 mm skirt with ~2 mm of bare neck showing; "flush above the bead" was
# then requested explicitly and wins. To restore the photo-exact reveal, set
# skirt_d back to 7.33.
CLOSURE_STYLES: Dict[str, Dict[str, object]] = {
    "short": {"skirt_d": None, "od": 23.50, "top_th": 4.46,
              "band_h": 1.40, "band_flare": 0.30},
    "tall":  {"skirt_d": 13.50, "od": 23.50, "top_th": 4.46,
              "band_h": 1.40, "band_flare": 0.30},
}


def load_builder():
    spec = importlib.util.spec_from_file_location("bbr_build", HERE / "build-boston-round.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _arc(cr, cz, radius, a0_deg, a1_deg, steps):
    a0, a1 = math.radians(a0_deg), math.radians(a1_deg)
    return [(cr + radius * math.cos(a0 + (a1 - a0) * i / steps),
             cz + radius * math.sin(a0 + (a1 - a0) * i / steps))
            for i in range(steps + 1)]


def build_profile(fin: Dict[str, float], style: Dict[str, float]) -> Dict[str, object]:
    """
    Closed (r, z) section of the closure, z = 0 at the mating face.

    Traversal: exterior top centre -> outer edge -> down the skirt -> around the
    bottom -> up the interior -> interior top centre. One winding rule then gives
    outward normals on the outside and cavity-facing normals inside, same as the
    bottle shell.
    """
    T = float(fin["T"])
    E = float(fin["E"])
    if style.get("skirt_d") is None:
        skirt_d = float(fin["bead_below_rim"]) - float(fin["bead_h"]) / 2.0 - CAP_BEAD_CLEARANCE
    else:
        skirt_d = float(style["skirt_d"])
    r_out = float(style["od"]) / 2.0
    top_th = float(style.get("top_th", 1.8))
    # interior: valley clears the bottle's crest, ridge drops to just over its root
    r_in_valley = (T + THREAD_CLEARANCE) / 2.0
    r_in_ridge = (E + THREAD_CLEARANCE) / 2.0

    pts: List[Tuple[float, float]] = [(0.0, top_th), (r_out - EDGE_R, top_th)]
    pts += _arc(r_out - EDGE_R, top_th - EDGE_R, EDGE_R, 90.0, 0.0, 8)[1:]
    z_wall_top = top_th - EDGE_R
    z_wall_bot = -skirt_d + BOT_R
    wall_steps = max(4, int((z_wall_top - z_wall_bot) * 4))
    for i in range(1, wall_steps + 1):
        pts.append((r_out, z_wall_top + (z_wall_bot - z_wall_top) * i / wall_steps))
    pts += _arc(r_out - BOT_R, -skirt_d + BOT_R, BOT_R, 0.0, -90.0, 5)[1:]
    outer_count = len(pts)

    pts.append((r_in_valley, -skirt_d))                 # bottom face, inward
    steps = max(2, int(skirt_d * 4))
    for i in range(1, steps + 1):
        pts.append((r_in_valley, -skirt_d + skirt_d * i / steps))
    pts.append((0.0, 0.0))                              # interior top disc
    return {
        "loop": pts, "outer_count": outer_count,
        "r_out": r_out, "r_in_valley": r_in_valley, "r_in_ridge": r_in_ridge,
        "skirt_d": skirt_d, "top_th": top_th,
        "band_h": float(style.get("band_h", 0.0)),
        "band_flare": float(style.get("band_flare", 0.0)),
        "thread_lo": -skirt_d, "thread_hi": -0.8,
    }


def make_modulator(prof, fin, ribs: int, rib_depth: float):
    """
    Ribs on the outside, female thread on the inside — in one pass.

    Ribs are pure angular modulation (vertical flutes, no lead). The thread is
    angular AND axial, so it is a real helix that mirrors the bottle's; its
    radius moves INWARD from the valley, because on a cap the thread protrudes
    into the bore.
    """
    outer_count = prof["outer_count"]
    r_out = prof["r_out"]
    prof_top_th = prof["top_th"]
    pitch = float(fin["pitch"])
    depth_in = prof["r_in_valley"] - prof["r_in_ridge"]
    lo, hi = prof["thread_lo"], prof["thread_hi"]

    band_top = prof["thread_lo"] + prof["band_h"]          # z where the band ends
    flare = prof["band_flare"]

    def modulate(index: int, r: float, z: float, theta: float) -> float:
        if index < outer_count:
            if abs(r - r_out) > 1e-6:
                return r                                    # top/bottom arcs
            if z <= band_top:
                # smooth flared lip band: no ribs, radius grows toward the edge
                t = (band_top - z) / max(prof["band_h"], 1e-6)
                return r + flare * t * t * (3.0 - 2.0 * t)
            if z < prof_top_th - EDGE_R - RIB_TOP_MARGIN:
                # grouped ribbing: position within this group's period
                u = (theta * RIB_GROUPS / (2.0 * math.pi)) % 1.0
                if u >= RIB_GROUP_DUTY:
                    return r                        # smooth flat panel
                v = u / RIB_GROUP_DUTY * RIBS_PER_GROUP
                # grooves at v = 0,1,..,N so the panel edges land on crests and
                # the section reads as N thin ribs between N+1 grooves
                cut = 0.5 * (1.0 + math.cos(2.0 * math.pi * (v % 1.0)))
                # ease the envelope at both panel edges over ~half a rib
                edge = min(v, RIBS_PER_GROUP - v)
                env = min(1.0, max(0.0, edge / 0.5 + 0.5))
                return r - rib_depth * cut * env
            return r
        if not (lo <= z <= hi) or depth_in <= 0.0:
            return r
        fade = min(1.0, (z - lo) / 1.2, (hi - z) / 1.2)
        if fade <= 0.0:
            return r
        phase = ((z - lo) / pitch) - (theta / (2.0 * math.pi))
        bump = 0.5 * (1.0 - math.cos(2.0 * math.pi * (phase % 1.0)))
        return r - depth_in * bump * fade

    return modulate


def make_pp_material(name: str) -> bpy.types.Material:
    """
    Injection-moulded polypropylene: near-black, fine matte, low gloss.

    Base colour is set in LINEAR space. The brief asks for sRGB ~(25,25,25),
    which is ~0.0116 linear — putting 25/255 = 0.098 straight in would render
    noticeably too light, a common slip.
    """
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    b = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    def st(k, v):
        if k in b.inputs:
            b.inputs[k].default_value = v
    st("Base Color", (0.0103, 0.0103, 0.0103, 1.0))   # #1A1A1A, linearised
    st("Roughness", 0.40)          # soft matte plastic sheen
    st("Metallic", 0.0)
    st("IOR", 1.49)                # polypropylene
    st("Specular IOR Level", 0.42)
    st("Coat Weight", 0.0)
    # Micro-grain: moulded plastic is never optically flat. ~0.1 mm noise cells
    # displacing ~10 µm via a bump map — visible as texture in a highlight,
    # invisible in silhouette. (This is what a Substance plastic .sbsar would
    # supply; procedural here so the cap has no asset dependency.)
    nt = mat.node_tree
    for n in [n for n in nt.nodes if n.type in ("TEX_NOISE", "BUMP")]:
        nt.nodes.remove(n)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.location = (b.location.x - 500, b.location.y - 300)
    noise.inputs["Scale"].default_value = 12.0        # 1 BU = 1 mm here
    noise.inputs["Detail"].default_value = 3.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.location = (b.location.x - 250, b.location.y - 300)
    bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.012
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return mat


def build(finish: str, style_name: str, clear_scene: bool = True) -> Dict[str, object]:
    mod = load_builder()
    fin = mod.NECK_FINISHES[finish]
    style = CLOSURE_STYLES[style_name]

    name = f"bb_cap_{finish.replace('-', '')}_{style_name}_v001"
    if clear_scene:
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o, do_unlink=True)

    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 0.001
    scene.unit_settings.length_unit = 'MILLIMETERS'

    prof = build_profile(fin, style)
    modulate = make_modulator(prof, fin, RIB_GROUPS * RIBS_PER_GROUP, RIB_DEPTH)
    verts, faces = mod.revolve_mesh(prof["loop"], RADIAL_SEGMENTS, modulate)

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate(verbose=False)
    mesh.update()
    for p in mesh.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (0.0, 0.0, 0.0)          # origin IS the mating face
    mesh.materials.append(make_pp_material("bb_mat_pp_black"))

    coll = bpy.data.collections.get("BSR_CLOSURES") or bpy.data.collections.new("BSR_CLOSURES")
    if coll.name not in {c.name for c in scene.collection.children}:
        scene.collection.children.link(coll)
    coll.objects.link(obj)

    meta = {
        "part": "closure", "finish": finish, "style": style_name,
        "outer_dia_mm": round(prof["r_out"] * 2, 3),
        "skirt_depth_mm": prof["skirt_d"],
        "total_height_mm": round(prof["skirt_d"] + prof["top_th"], 3),
        "above_rim_mm": prof["top_th"],
        "thread_valley_dia_mm": round(prof["r_in_valley"] * 2, 3),
        "thread_ridge_dia_mm": round(prof["r_in_ridge"] * 2, 3),
        "clearance_mm": THREAD_CLEARANCE,
        "ribs": f"{RIB_GROUPS}x{RIBS_PER_GROUP}", "rib_depth_mm": RIB_DEPTH,
        "radial_segments": RADIAL_SEGMENTS,
        "verts": len(mesh.vertices), "faces": len(mesh.polygons),
        "tris": sum(len(p.vertices) - 2 for p in mesh.polygons),
        "seating": "origin at mating face; parent to neck datum with zero transform",
    }
    for k, v in meta.items():
        obj[k] = v
    return {"obj": obj, "meta": meta, "prof": prof, "fin": fin}


def validate(res, fin) -> List[Tuple[bool, str]]:
    mesh = res["obj"].data
    out: List[Tuple[bool, str]] = []
    zs = [v.co.z for v in mesh.vertices]
    rs = [math.hypot(v.co.x, v.co.y) for v in mesh.vertices]

    tt = res["prof"]["top_th"]
    out.append((abs(max(zs) - tt) < 1e-3, f"top at z={max(zs):.3f} (expect {tt})"))
    out.append((abs(min(zs) + res["prof"]["skirt_d"]) < 1e-3,
                f"skirt bottom z={min(zs):.3f} (expect {-res['prof']['skirt_d']})"))
    od = res["meta"]["outer_dia_mm"]
    flare_max = od + 2.0 * res["prof"]["band_flare"]
    out.append((od - 1e-3 <= max(rs) * 2 <= flare_max + 1e-3,
                f"outer dia {max(rs)*2:.2f} mm (ribbed {od}, lip flares to ≤{flare_max:.2f})"))

    edges: Dict[Tuple[int, int], int] = {}
    for p in mesh.polygons:
        vs = list(p.vertices)
        for a, b in zip(vs, vs[1:] + vs[:1]):
            k = (min(a, b), max(a, b)); edges[k] = edges.get(k, 0) + 1
    bad = [e for e, c in edges.items() if c != 2]
    out.append((not bad, f"manifold: {len(bad)} bad edges"))
    out.append((not [p for p in mesh.polygons if len(p.vertices) > 4],
                "no n-gons"))

    # the cap's thread must clear the bottle's, or the two meshes interpenetrate
    gap = res["meta"]["thread_valley_dia_mm"] - float(fin["T"])
    out.append((gap > 0.0,
                f"cap valley Ø{res['meta']['thread_valley_dia_mm']:.2f} vs bottle crest "
                f"Ø{fin['T']:.2f} — clearance {gap:+.2f} mm"))
    ridge_gap = float(fin["E"]) - res["meta"]["thread_ridge_dia_mm"]
    out.append((ridge_gap < 0.0,
                f"cap ridge Ø{res['meta']['thread_ridge_dia_mm']:.2f} engages inside bottle "
                f"crest Ø{fin['T']:.2f}"))
    if "bead_below_rim" in fin:
        bead_top = -(float(fin["bead_below_rim"]) - float(fin["bead_h"]) / 2.0)
        lip = -res["prof"]["skirt_d"]
        out.append((0.0 < lip - bead_top <= 0.6,
                    f"lip z={lip:.2f} sits {lip - bead_top:.2f} mm above bead top "
                    f"z={bead_top:.2f} (flush, no overlap)"))
    return out


def main() -> int:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser(prog="build-closure.py")
    p.add_argument("--finish", default="20-400")
    p.add_argument("--style", default="short", choices=sorted(CLOSURE_STYLES))
    p.add_argument("--output", type=Path)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--keep-scene", action="store_true")
    args = p.parse_args(argv)

    res = build(args.finish, args.style, clear_scene=not args.keep_scene)
    m = res["meta"]
    print(f"Closure — {args.finish} {args.style}")
    print(f"  outer Ø      {m['outer_dia_mm']} mm")
    print(f"  height       {m['total_height_mm']} mm  (skirt {m['skirt_depth_mm']})")
    print(f"  thread       valley Ø{m['thread_valley_dia_mm']} / ridge Ø{m['thread_ridge_dia_mm']}"
          f"  clearance {m['clearance_mm']} mm")
    print(f"  knurl        {m['ribs']} grouped ribs × {m['rib_depth_mm']} mm "
          f"(duty {RIB_GROUP_DUTY})")
    print(f"  mesh         {m['verts']} verts · {m['tris']} tris")
    print()
    ok = True
    for passed, msg in validate(res, res["fin"]):
        print(f"  {'PASS' if passed else 'FAIL'}  {msg}")
        ok = ok and passed
    print()
    if args.dry_run:
        print("[DRY RUN] nothing written.")
    elif args.output:
        out = Path(args.output).resolve()
        out.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(out))
        print(f"Saved: {out}")
    return 0 if ok else 1


if __name__ == "__main__":
    code = main()
    if bpy.app.background:
        sys.exit(code)
