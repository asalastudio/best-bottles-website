#!/usr/bin/env python3
"""
material_lock.py — lock the LOOK, not just the numbers.

WHY (Jordan, 2026-08-31: "all the materials should be locked in. I don't
know why they're not"): a material's appearance = values x ENVIRONMENT.
Approved values kept their bytes while the environment HDRIs were
regenerated in place - eleven room versions, three universal versions -
and every regeneration silently re-graded every "locked" material.

THE LOCK pins both halves:
  - sha256 of every environment/bake/matcap file the renderer loads
  - the shipping values of every approved material (materials.json caps,
    ball, housing + every glassPresets colourway's numeric fields)

  python3 material_lock.py write    # snapshot current state as THE lock
  python3 material_lock.py verify   # exit 1 + report on ANY drift

RULE: an intentional change = Jordan re-approves, then `write` again in the
same commit. A generator that overwrites a locked file without a relock is
a bug, and `verify` will say exactly what drifted.
"""
import hashlib, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
LOCK = ROOT / "public" / "models" / "materials.lock.json"

TRACKED_FILES = [
    "public/models/studio-universal.hdr",
    "public/models/studio-room.hdr",
    "public/models/studio-browser.hdr",
    "public/models/studio-metal.hdr",
    "public/models/matcaps/ball-steel-v3.png",
    "public/models/bodies-thickness/Cyl-round-17-415-70x20.glb",
    "public/models/bodies-thickness/Cyl-round-17-415-70x20.thickness.png",
    "public/models/bodies-thickness/Cyl-round-17-415-70x20.frost.png",
    "public/models/bodies-threaded/Cyl-round-17-415-70x20.glb",
    "public/models/bodies-thickness/CylSwrl-round-17-415-74x21.glb",
    "public/models/bodies-threaded/CylSwrl-round-17-415-74x21.glb",
    "public/models/closures/BB_ROLL_BALL_17415_STEEL.glb",
    "public/models/closures/BB_ROLL_HOUSING_17415_STEEL.glb",
    "public/models/closures/BB_CAP_17415.glb",
    "public/models/closures/BB_CAP_DOTS_17415.glb",
    "public/models/closures/BB_SPR_COLLAR_17415.glb",
    "public/models/closures/BB_SPR_ACTUATOR_17415.glb",
    "public/models/closures/BB_SPR_OVERCAP_17415.glb",
    "public/models/closures/BB_PMP_SPOUT_17415.glb",
]
TRACKED_MATERIALS_PREFIXES = ("CAP_", "PART_BALL", "PART_HOUSING", "PART_STUD", "SPRAY_")
NUMERIC_PRESET_FIELDS = [
    "transmission", "roughness", "ior", "thickness", "attenuationColor",
    "attenuationDistance", "dispersion", "clearcoat", "clearcoatRoughness",
    "envMapIntensity", "anisotropicBlur", "distortion", "envRotationDeg",
    "thinWall", "thicknessBake", "frostMask", "configuratorReady",
]

def sha(p: pathlib.Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()[:16]

def presets() -> dict:
    src = (ROOT / "src/lib/materials/glassPresets.ts").read_text()
    out = {}
    for pid in ["clear", "amber", "cobalt", "frosted", "swirl"]:
        a = src.index(f"  {pid}: {{"); b = src.index("\n  },", a)
        blk = src[a:b]
        vals = {}
        for f in NUMERIC_PRESET_FIELDS:
            m = re.search(rf"\n    {f}: ([^,\n]+),", blk)
            if m:
                vals[f] = m.group(1).strip().strip('"')
        out[pid] = vals
    return out

def snapshot() -> dict:
    mats = json.loads((ROOT / "public/models/materials.json").read_text())["materials"]
    return {
        "note": "Locks the LOOK: file hashes + shipping values. verify "
                "before shipping; write only alongside a Jordan approval.",
        "files": {f: sha(ROOT / f) for f in TRACKED_FILES if (ROOT / f).exists()},
        "materials": {
            k: {kk: vv for kk, vv in v.items() if kk != "note"}
            for k, v in mats.items()
            if k.startswith(TRACKED_MATERIALS_PREFIXES)
        },
        "glassPresets": presets(),
    }

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "verify"
    now = snapshot()
    if mode == "write":
        LOCK.write_text(json.dumps(now, indent=1, sort_keys=True) + "\n")
        print(f"lock written: {len(now['files'])} files, "
              f"{len(now['materials'])} materials, 5 glass presets")
        return
    if not LOCK.exists():
        sys.exit("no lock exists - run `material_lock.py write` after approval")
    old = json.loads(LOCK.read_text())
    drift = []
    for f, h in old["files"].items():
        cur = now["files"].get(f)
        if cur != h:
            drift.append(f"FILE {f}: {h} -> {cur or 'MISSING'}")
    for section in ("materials", "glassPresets"):
        for k, v in old[section].items():
            cur = now[section].get(k)
            if cur != v:
                changed = [f"{kk}: {v.get(kk)!r} -> {(cur or {}).get(kk)!r}"
                           for kk in set(v) | set(cur or {})
                           if v.get(kk) != (cur or {}).get(kk)]
                drift.append(f"{section}.{k}: " + "; ".join(changed))
    # library-anchor check: clear must remain THE canonical measured glass
    lib = json.loads((ROOT / "data/materials/physicallybased-library.json").read_text())
    g = lib["glass.glass"]["values"]
    def hexof(lin):
        return "#" + "".join(f"{round((max(0,min(1,c))**(1/2.2))*255):02x}" for c in lin[:3])
    clear = now["glassPresets"]["clear"]
    anchor = {"transmission": "1.0", "roughness": "0", "ior": str(g["ior"]),
              "dispersion": "0.31", "attenuationColor": hexof(g["attenuationColor"]),
              "attenuationDistance": "1.0"}
    for k, want in anchor.items():
        have = clear.get(k)
        try:
            same = float(have) == float(want)
        except (TypeError, ValueError):
            same = str(have) == str(want)
        if not same:
            drift.append(f"ANCHOR clear.{k}: library says {want}, preset ships {have} "
                         "- clear must stay the canonical measured glass")
    if drift:
        print("LOCK DRIFT - the approved look has changed:")
        for d in drift:
            print("  ", d)
        sys.exit(1)
    print("lock verified: nothing drifted")

main()
