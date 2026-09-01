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
    "public/env/studio-universal-softbox.hdr",   # THE shipping environment
    "public/env/studio_small_08_1k_peak24.hdr",  # retired base, kept for A/B
    "public/models/studio-universal.hdr",
    "public/models/studio-mono.hdr",
    "public/models/studio-metal-key.hdr",
    "public/models/studio-classic.hdr",
    "public/models/studio-classic-clean.hdr",
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
    "public/models/closures/BB_CAP_18415.glb",
    "public/models/closures/BB_CAP_18415_TALL.glb",
    "public/models/closures/BB_CAP_18415_LEATHER.glb",
    "public/models/closures/BB_REDUCER_18415.glb",
    "public/models/closures/BB_SPR_COLLAR_18415.glb",
    "public/models/closures/BB_SPR_ACTUATOR_18415.glb",
    "public/models/closures/BB_SPR_OVERCAP_18415.glb",
    "public/models/closures/BB_PMP_SPOUT_18415.glb",
    "public/models/closures/BB_PMP_BODY_17415.glb",
    "public/models/closures/BB_PMP_BODY_18415.glb",
    "public/models/closures/BB_DIP_TUBE_17415.glb",
    "public/models/closures/BB_DIP_TUBE_18415.glb",
    "public/models/closures/BB_SPR_NOZZLE_18415.glb",
    "public/models/closures/BB_DRP_COLLAR_18415.glb",
    "public/models/closures/BB_DRP_BULB_18415.glb",
    "public/models/closures/BB_DRP_PIPETTE_18415.glb",
    "public/models/closures/BB_ANSP_COLLAR_18415.glb",
    "public/models/closures/BB_ANSP_ASSEMBLY_18415.glb",
    "public/models/bodies-thickness/Round-sphere-18-415-83x69.glb",
    "public/models/bodies-thickness/Round-sphere-18-415-73x59.glb",
    "public/models/bodies-thickness/Cyl-round-18-415-117x32.glb",
    "public/models/bodies-thickness/Cyl-round-18-415-154x35.glb",
    "public/models/bodies-thickness/Elegant-oval-18-415-109x61.glb",
    "public/models/closures/BB_ANSP_BULB_18415.glb",
    "public/models/closures/BB_ANSP_FERRULE_18415.glb",
    "public/models/closures/BB_ANSP_TASSEL_18415.glb",
    "public/models/bodies-thickness/Elegant-oval-18-415-87x55.glb",
    "public/models/bodies-thickness/Elegant-oval-18-415-87x55.thickness.png",
    "public/models/bodies-thickness/Circle-disc-18-415-88x73.glb",
    "public/models/bodies-thickness/Circle-disc-18-415-88x73.thickness.png",
    "public/models/bodies-thickness/Circle-disc-18-415-111x94.glb",
    "public/models/bodies-thickness/Circle-disc-18-415-111x94.thickness.png",
]

# ── MATERIAL ANCHORS ──────────────────────────────────────────────────────
# A material is ANCHORED when its physical values are traceable to a measured
# entry in data/materials/physicallybased-library.json (CC0, physicallybased.info)
# rather than typed by eye. Glass has been anchored since 2026-08-31; this is
# the same discipline for the closures.
#
#   library   the measured entry this material derives from
#   tinted    True when the colourway may set its own baseColor. A library COAT
#             is colourless white by definition: the tint IS the product.
#   declared  fields that deliberately differ from the measurement, each with a
#             reason. A deviation is legitimate — Jordan approves the LOOK, not
#             the spreadsheet — but it must be written down, or "measured" and
#             "hand-tuned" become indistinguishable a month later.
MATERIAL_ANCHORS = {
    # LIBRARY-EXACT. Not "anchored with deviations" — the material simply IS
    # coats.coat_gloss, tinted. Every hand-tune was removed 2026-09-01 once
    # the studio was correct (Jordan: "this is a round, glossy black, it's
    # very simple — find that and the studio will take care of itself").
    # The one remaining declaration is a field the library entry does not
    # carry at all.
    "CAP_SHINY_BLACK": dict(
        library="coats.coat_gloss",
        tinted=True,
        declared={
            "ior": "1.5 — MeshPhysicalMaterial default; the library coat omits ior",
        },
    ),
    # Mirrors CAP_SHINY_BLACK by the sync rule; same anchor makes that
    # promise enforced rather than a comment two files apart.
    "CAP_DOTS_BLACK": dict(
        library="coats.coat_gloss",
        tinted=True,
        declared={
            "ior": "1.5 — MeshPhysicalMaterial default",
        },
    ),
}

TRACKED_MATERIALS_PREFIXES = ("ANSP_", "CAP_", "LEATHER_", "PART_BALL", "PART_HOUSING", "PART_STUD", "PART_DIPTUBE", "PART_DRP", "SPRAY_")
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

def studio_environment() -> dict:
    """The studio's parameters, pinned like the glass presets.

    These used to be emitter literals scraped out of StudioEnvironment.tsx,
    because the rig was quads-over-an-HDRI. The rig is now a generated light
    cone with no in-scene geometry at all, so the values that decide the look
    live in make_universal_softbox.py. Pinning the .hdr hash alone is not
    enough: a regenerated file with different constants would hash differently
    and tell you only THAT it changed, never which knob moved. Scraping the
    constants makes `verify` name the parameter — which is the difference
    between "the studio drifted" and "someone widened the key lobe"."""
    out = {}
    m = re.search(r'APPROVED_STUDIO: StudioPresetId = "([a-z0-9-]+)"',
                  (ROOT / "src/lib/materials/studioPresets.ts").read_text())
    out["approvedStudio"] = m.group(1) if m else "UNPARSEABLE"
    gen = (ROOT / "pipeline/paper-doll-3d/scripts/make_universal_softbox.py")
    src = gen.read_text() if gen.exists() else ""
    for name in ("CONE_PEAK", "CONE_UP", "CONE_DOWN", "CONE_I", "KEY_AZIMUTH",
                 "KEY_AMOUNT", "KEY_SHAPE", "AMBIENT", "FLOOR_I", "EXPOSURE"):
        m = re.search(rf"^{name}\s*=\s*([-\d.]+)", src, re.M)
        out[f"cone.{name}"] = m.group(1) if m else "UNPARSEABLE"
    # the retired rig mounted feathered quads; if any ever come back, the lock
    # must see them rather than silently reporting a cone-only studio
    quads = re.findall(r"\{ position: \[([^\]]+)\], scale: \[", 
                       (ROOT / "src/components/products/StudioEnvironment.tsx").read_text())
    out["inSceneEmitters"] = str(len(quads))
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
        "studioEnvironment": studio_environment(),
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
    # the hybrid studio's in-code half (older locks predate the section)
    for k, v in old.get("studioEnvironment", {}).items():
        cur = now["studioEnvironment"].get(k)
        if cur != v:
            drift.append(f"studioEnvironment.{k}: {v!r} -> {cur!r}")
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
    # ── anchored closure materials ────────────────────────────────────────
    # Every anchored material must equal its measured library entry on every
    # physical field, EXCEPT the fields it declares (with a reason) and the
    # tint. An undeclared difference is drift, exactly like a changed hash.
    ANCHOR_FIELDS = ("metalness", "roughness")
    for name, spec in MATERIAL_ANCHORS.items():
        have = now["materials"].get(name)
        if have is None:
            drift.append(f"ANCHOR {name}: anchored but missing from materials.json")
            continue
        entry = lib.get(spec["library"])
        if entry is None:
            drift.append(f"ANCHOR {name}: library entry {spec['library']} not found")
            continue
        want = entry["values"]
        for f in ANCHOR_FIELDS:
            if f in spec["declared"] or f not in want:
                continue
            a, b = have.get(f), want[f]
            if a is None or abs(float(a) - float(b)) > 1e-6:
                drift.append(
                    f"ANCHOR {name}.{f}: {spec['library']} measures {b}, "
                    f"material ships {a} - anchor it or declare the deviation")
        # a colourless library coat may be tinted; a coloured entry may not
        if not spec.get("tinted") and "color" in want:
            lin = have.get("linear")
            if lin and any(abs(float(x) - float(y)) > 0.01
                           for x, y in zip(lin, want["color"])):
                drift.append(f"ANCHOR {name}.color: differs from {spec['library']} "
                             "and this material is not declared tinted")

    if drift:
        print("LOCK DRIFT - the approved look has changed:")
        for d in drift:
            print("  ", d)
        sys.exit(1)
    print("lock verified: nothing drifted")

main()
