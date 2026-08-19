#!/usr/bin/env python3
"""
BEST BOTTLES — batch catalog renderer.

Walks every bottle spec in build-master-scene.py, builds each one (plus its
closure variants) in the SAME master studio, renders it on the master camera,
audits the built geometry against the spec numbers, and writes a manifest +
contact sheet. Deterministic: same specs in, same catalog out.

    python3 scripts/paper-doll-3d/batch-render.py            # everything
    python3 scripts/paper-doll-3d/batch-render.py --specs 009 --samples 128
    python3 scripts/paper-doll-3d/batch-render.py --variants bare

Outputs:
    pipeline/paper-doll-3d/master/builds/<spec>--<variant>.blend
    pipeline/paper-doll-3d/renders/<spec>--<variant>.png
    pipeline/paper-doll-3d/renders/render-manifest.json
    pipeline/paper-doll-3d/renders/contact-sheet.png

The drawing -> spec step stays human+Claude (read the PDF, add a CYL_SPECS
entry, audit it). Everything after the spec entry is this one command.
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BUILD = REPO / "scripts/paper-doll-3d/build-master-scene.py"
BUILDS = REPO / "pipeline/paper-doll-3d/master/builds"
RENDERS = REPO / "pipeline/paper-doll-3d/renders"

# Closure variants per spec. Closures are dimensioned per neck finish, so a
# spec only gets them once its fitment exists; everything else renders bare.
VARIANTS = {
    "009": [
        ("bare", []),
        ("roller-plastic", ["--roller", "plastic"]),
        ("roller-steel", ["--roller", "steel"]),
        ("capped-matte-silver", ["--roller", "plastic", "--cap", "matte-silver"]),
    ],
    "_default": [("bare", [])],
}

AUDIT_EXPR = """
import bpy, math, json
from mathutils import Vector
meshes = [o for o in bpy.data.objects if o.type == 'MESH'
          and o.name.startswith(('BB_BTL', 'BB_ROLL', 'BB_CAP', 'BB_FIN'))
          and not o.hide_render]
bottle = next(o for o in meshes if o.name.startswith('BB_BTL'))
fin = next((o for o in meshes if o.name.startswith('BB_FIN')), None)
# finish-master era: bottle = body ending at the datum; the neck lives in
# the BB_FIN instance. Heights and crest measure over the ASSEMBLY.
neck = fin if fin is not None else bottle
bz = [(bottle.matrix_world @ Vector(c)).z for c in bottle.bound_box]
nz = [(neck.matrix_world @ Vector(c)).z for c in neck.bound_box]
top_z = max(max(bz), max(nz))
bx = [(bottle.matrix_world @ Vector(c)).x for c in bottle.bound_box]
crest = max((math.hypot(v.co.x, v.co.y) for v in neck.data.vertices
             if (neck.matrix_world @ v.co).z > top_z - SPEC['neck_h'] * 0.55),
            default=0)  # upper finish only: skips shoulder cones and beads
total = max(max((o.matrix_world @ Vector(c)).z for c in o.bound_box)
            for o in meshes)
print('AUDIT_JSON ' + json.dumps({
    'bottle_h': round(top_z, 2), 'body_od': round(max(bx) * 2, 2),
    'crest_od': round(2 * crest, 2), 'assembly_h': round(total, 2),
    'parts': sorted(o.name for o in meshes)}))
s = bpy.context.scene
s.render.filepath = OUT
s.cycles.samples = SAMPLES
bpy.ops.render.render(write_still=True)
"""


def blender_bin() -> str:
    cand = "/Applications/Blender.app/Contents/MacOS/Blender"
    if Path(cand).exists():
        return cand
    return "blender"


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--specs", nargs="*", default=None)
    ap.add_argument("--variants", nargs="*", default=None)
    ap.add_argument("--samples", type=int, default=256)
    ap.add_argument("--tolerance", type=float, default=0.15,
                    help="mm tolerance for the audit gate")
    args = ap.parse_args()
    B = blender_bin()

    r = run([B, "-b", "--factory-startup", "-P", str(BUILD), "--", "--dump-specs"])
    line = next(l for l in r.stdout.splitlines() if l.startswith("SPECS_JSON "))
    specs = json.loads(line[len("SPECS_JSON "):])
    todo = args.specs or sorted(specs)

    BUILDS.mkdir(parents=True, exist_ok=True)
    RENDERS.mkdir(parents=True, exist_ok=True)
    manifest = {"generated": datetime.now(timezone.utc).isoformat(),
                "samples": args.samples, "jobs": []}
    failures = 0

    for key in todo:
        spec = specs[key]
        variants = VARIANTS.get(key, VARIANTS["_default"])
        if args.variants:
            variants = [v for v in variants if v[0] in args.variants]
        for vname, vflags in variants:
            tag = f"{key}--{vname}"
            blend = BUILDS / f"{tag}.blend"
            png = RENDERS / f"{tag}.png"
            print(f"[{tag}] build", flush=True)
            rb = run([B, "-b", "--factory-startup", "-P", str(BUILD), "--",
                      "--output", str(blend), "--bottle", key, *vflags])
            if "saved" not in rb.stdout + rb.stderr:
                print(rb.stdout[-800:], rb.stderr[-400:])
                manifest["jobs"].append({"tag": tag, "status": "BUILD_FAILED"})
                failures += 1
                continue
            print(f"[{tag}] render + audit", flush=True)
            nums = {k: spec[k] for k in ("height", "diameter", "neck_t", "neck_h")}
            expr = (f"SPEC={json.dumps(nums)}\nOUT={json.dumps(str(png))}\n"
                    f"SAMPLES={args.samples}\n") + AUDIT_EXPR
            # (numbers only: JSON true/false are not Python literals)
            rr = run([B, "-b", "--factory-startup", str(blend), "--python-expr", expr])  # factory: the Substance addon intermittently kills headless renders
            audit = None
            for l in rr.stdout.splitlines():
                if l.startswith("AUDIT_JSON "):
                    audit = json.loads(l[len("AUDIT_JSON "):])
            ok = (audit is not None and png.exists()
                  and abs(audit["bottle_h"] - spec["height"]) <= args.tolerance
                  and abs(audit["body_od"] - spec["diameter"]) <= args.tolerance
                  and abs(audit["crest_od"] - spec["neck_t"]) <= args.tolerance)
            manifest["jobs"].append({
                "tag": tag, "status": "OK" if ok else "AUDIT_FAILED",
                "expected": {k: spec[k] for k in ("height", "diameter", "neck_t")},
                "measured": audit, "render": str(png.relative_to(REPO)),
                "blend": str(blend.relative_to(REPO))})
            if not ok:
                failures += 1
                if audit is None:
                    print(rr.stdout[-600:], rr.stderr[-600:])
            print(f"[{tag}] {'OK' if ok else 'AUDIT FAILED'} {audit}", flush=True)

    (RENDERS / "render-manifest.json").write_text(json.dumps(manifest, indent=2))

    # contact sheet
    try:
        from PIL import Image, ImageDraw
        shots = [(j["tag"], REPO / j["render"]) for j in manifest["jobs"]
                 if j["status"] == "OK"]
        if shots:
            W = 460
            tiles = [(t, Image.open(p).convert("RGB").resize(
                (W, int(W * 2288 / 2080)))) for t, p in shots]
            H = tiles[0][1].height
            sheet = Image.new("RGB", (W * len(tiles) + 20 * (len(tiles) + 1),
                                      H + 70), (22, 22, 22))
            d = ImageDraw.Draw(sheet)
            for i, (t, im) in enumerate(tiles):
                x = 20 + i * (W + 20)
                sheet.paste(im, (x, 50))
                d.text((x, 18), t, fill=(240, 240, 240))
            sheet.save(RENDERS / "contact-sheet.png")
    except Exception as e:  # sheet is a nicety, never fail the batch on it
        print("contact sheet skipped:", e)

    print(f"\nDONE {len(manifest['jobs'])} jobs, {failures} failures")
    print(f"manifest: {RENDERS / 'render-manifest.json'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
