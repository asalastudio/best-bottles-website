#!/usr/bin/env python3
import json, csv, os
from collections import Counter, defaultdict

OUT = "/home/user/best-bottles-website/docs/paper-doll/geometry-audit"
S = json.load(open(f"{OUT}/_summary.json"))
P = json.load(open(f"{OUT}/_parametric.json"))
rows = list(csv.DictReader(open(f"{OUT}/bottle-bodies.csv")))
comps = list(csv.DictReader(open(f"{OUT}/bottle-components.csv")))
rows.sort(key=lambda r: -int(r["sku_count"]))
tot = sum(int(r["sku_count"]) for r in rows)

def cov(pct):
    c = 0
    for i, r in enumerate(rows, 1):
        c += int(r["sku_count"])
        if c * 100 / tot >= pct: return i, c
    return len(rows), c

def fmt(v, suf=""):
    return "—" if v in ("", None, "None") else f"{float(v):g}{suf}"

L = []
w = L.append

w("# Best Bottles — bottle geometry audit\n")
w("Minimum set of unique bottle **body** geometries requiring a master 3D model, "
  "separating true container geometry from SKU-level variation.\n")
w("**Analysis and inventory only — no modeling performed or started.**\n")
w("Generated from `data/audits/2026-03-06/convex_snapshot.json` (2,318 SKUs) joined to "
  "`data/bestbottles_raw_website_data.json` (2,285 dimension records) on `websiteSku`; "
  "2,278 SKUs joined (98.3%). Reproduce with `scripts/paper-doll/geometry_audit.py`.\n")

w("## Executive summary\n")
w("```")
w(f"TOTAL SKUs ANALYZED:                     {S['skus']}")
w(f"  bottle bodies                          {S['classes']['BODY']}")
w(f"  closures / accessories (components)    {S['classes']['COMPONENT']}")
w(f"  non-product (gift box, bags, tools)    {S['classes']['NON_PRODUCT']}")
w(f"TOTAL BOTTLE FAMILIES:                   {S['families']}")
w(f"TOTAL UNIQUE BOTTLE BODY GEOMETRIES:     {S['bodies']}")
w(f"TOTAL UNIQUE CLOSURE / ACCESSORY COMPS:  {S['components']}")
w(f"HIGH-CONFIDENCE BODY GROUPS:             {S['conf'].get('HIGH',0)}")
w(f"MEDIUM-CONFIDENCE BODY GROUPS:           {S['conf'].get('MEDIUM',0)}")
w(f"HUMAN-REVIEW BODY GROUPS (LOW):          {S['conf'].get('LOW',0)}")
w(f"EXISTING 3D MODELS WE CAN REUSE:         0 bodies, 1 partial closure lathe")
w(f"NEW 3D MODELS WE ACTUALLY NEED TO BUILD: {S['bodies']} bodies + {S['components']} components")
w("```\n")

w("### The number that actually matters\n")
for pct in (50, 80, 90):
    n, c = cov(pct)
    w(f"- **{n} bodies cover {pct}% of all body SKUs** ({c:,} of {tot:,})")
w(f"- The remaining tail is **{sum(1 for r in rows if int(r['sku_count'])<=2)} bodies serving ≤2 SKUs each**\n")
w("The catalog is far more concentrated than the SKU count suggests. A build that stops "
  "at 30 bodies already renders four fifths of the catalog.\n")

w("## What already exists\n")
w("Inspected before proposing anything new:\n")
w("| Asset | Found | Notes |")
w("|---|---|---|")
w("| Bottle body 3D models | **none** | no `.blend`, `.glb`, `.gltf`, `.obj`, `.fbx`, or `.usdz` anywhere in either repo |")
w("| Closure 3D | **1, partial** | `workers/paper-doll-renderer/blender/cyl9_rollon_overcap.py` — `build_lathed_cap(profile, segments)` is a revolve driven by `config.geometry.profileMmEquivalent` |")
w("| Materials | yes | `workers/paper-doll-renderer/blender/materials.py` — surface, stone, mask |")
w("| 2D body plates | 5, off-repo | CYL-9ML clear/amber/cobalt/frosted/swirl, SHA-frozen; `body-plate-registry.json` referenced by the closure handoff but not committed here |")
w("| Placement recipe | yes | 17-415 closure seat frozen: body width 363 px, seat y=1002, canvas 2080×2288 |")
w("| Family/body IDs | **none** | no pre-existing body-geometry ID scheme; `BB-BODY-*` introduced here |")
w("")
w("**The existing closure script is the single most important precedent in the audit.** It is "
  "already profile-driven parametric geometry — a JSON profile lathed at N radial segments. "
  "The same mechanism extends to bottle bodies for every EASY family below.\n")

w("## How bodies were separated from SKU variation\n")
w("Excluded from the body key (these never create a new geometry): glass colour/tint, "
  "frosted vs clear, cap colour, cap material, trim, applicator, roller ball material, "
  "sprayer/pump/dropper colour, closure, overcap, dip tube, surface finish, decoration, "
  "labels, printing, price, stock.\n")
w("Included: family, capacity, neck finish, body diameter, bare body height.\n")
w("**Two data rules were derived from ground truth rather than assumed:**\n")
w("1. **`heightWithoutCap` is the body dimension; `heightWithCap` is not.** All 27 Swirl "
  "Cylinder 9 mL SKUs report `bare=74, dia=21` across every applicator and cap colour, while "
  "capped height moves 87→98 with the applicator. Keying on capped height would have split one "
  "bottle into three.")
w("2. **Published dimensions carry a ±1 mm diameter / ±4 mm height noise floor.** The CYL-9ML "
  "pilot proves clear/amber/cobalt/frosted/swirl are one geometry (necks agree within 4 px, one "
  "closure recipe seats on all five), yet the raw catalog splits them into `dia=20/bare=70`, "
  "`dia=21/bare=74` and `dia=20/bare=74` — with **Frosted appearing in two clusters at once**. "
  "Bodies within family+neck are therefore merged below ±2 mm / ±5 mm. That merge alone "
  "collapsed 143 SKUs into the single correct CYL-9ML body.\n")

w("## Bottle bodies\n")
w("Full table: `bottle-bodies.csv` (109 rows). Top 25 by SKU count:\n")
w("| Body ID | Family | Description | Capacity | Dia | Body H | Neck | SKUs | Colours | Applicators | Complexity | Status | Conf |")
w("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
for r in rows[:25]:
    w(f"| {r['body_id']} | {r['family']} | {r['alias']} | {fmt(r['capacity_ml'],' ml')} | "
      f"{fmt(r['diameter_mm'],' mm')} | {fmt(r['body_height_mm'],' mm')} | {r['neck_finish']} | "
      f"{r['sku_count']} | {r['glass_colors']} | {r['applicators']} | {r['complexity']} | "
      f"{r['geometry_status']} | {r['confidence']} |")
w("")

w("## Closures and accessories (separate component library)\n")
w(f"{S['components']} components, {S['classes']['COMPONENT']} SKUs. Colourways are finish "
  "variations on one mesh and are **not** counted as separate components. Full table: "
  "`bottle-components.csv`.\n")
w("| Component ID | Type | Style | Neck | SKUs | Colourways | Existing model |")
w("|---|---|---|---|---|---|---|")
for c in comps[:18]:
    w(f"| {c['component_id']} | {c['type']} | {c['style']} | {c['neck_finish']} | "
      f"{c['sku_count']} | {c['colorways']} | {c['existing_model']} |")
w("")

w("## SAME GEOMETRY / PARAMETRIC VARIANT / UNIQUE GEOMETRY\n")
w(f"- **SAME GEOMETRY** — {S['skus'] - S['bodies']:,} SKUs collapse into {S['bodies']} bodies. "
  "Every glass colour, cap colour, applicator and finish combination reuses one body mesh. "
  "This is the bulk of the reduction and it is already proven by the CYL-9ML pilot "
  "(26 layers → 145 configurations).")
w(f"- **PARAMETRIC VARIANT** — {S['status'].get('PARAMETRIC VARIANT',0)} bodies in "
  f"{S['confirmed_param_groups']} groups with a *verified* shared diameter. These can be driven "
  "from one profile.")
w(f"- **PARAMETRIC CANDIDATE** — {S['status'].get('PARAMETRIC CANDIDATE',0)} bodies in "
  f"{S['candidate_param_groups']} groups that share family and neck but whose diameter is "
  "unpublished. Likely parametric, **not yet provable**.")
w(f"- **UNIQUE GEOMETRY** — {S['status'].get('UNIQUE GEOMETRY',0)} bodies with no sibling.\n")
w("Largest parametric groups (height is the driving parameter):\n")
w("| Group | Status | Family | Neck | Dia | Bodies | SKUs | Heights (mm) | Span |")
w("|---|---|---|---|---|---|---|---|---|")
for g in sorted(P, key=lambda x: -x["skus"])[:12]:
    w(f"| `{g['group']}` | {g['status'].replace('PARAMETRIC ','')} | {g['family']} | {g['neck']} | "
      f"{fmt(g['diameter_mm'])} | {g['bodies']} | {g['skus']} | "
      f"{', '.join(f'{h:g}' for h in g['heights'])} | {g['height_span_mm']:g} mm |")
w("")

w("## Models we need to build, ranked\n")
w("Ranked by SKUs served, then by modeling speed.\n")
w("| Rank | Body ID | Description | SKUs | Complexity | Conf |")
w("|---|---|---|---|---|---|")
for i, r in enumerate(sorted(rows, key=lambda r: (-int(r["sku_count"]),
                      {"EASY":0,"MODERATE":1,"COMPLEX":2}[r["complexity"]]))[:20], 1):
    w(f"| {i} | {r['body_id']} | {r['alias']} | {r['sku_count']} | {r['complexity']} | {r['confidence']} |")
w("")
w("Complexity against catalog weight — the hardest geometry earns the least:\n")
w("| Complexity | Bodies | SKUs served |")
w("|---|---|---|")
n = Counter(); wt = defaultdict(int)
for r in rows: n[r["complexity"]] += 1; wt[r["complexity"]] += int(r["sku_count"])
for k in ("EASY","MODERATE","COMPLEX"):
    w(f"| {k} | {n[k]} | {wt[k]:,} |")
w("")
w(f"**{n['COMPLEX']} COMPLEX bodies serve only {wt['COMPLEX']} SKUs between them.** They should be "
  "last, and several are candidates for retirement rather than modeling.\n")

w("## Human review queue\n")
low = [r for r in rows if r["confidence"] == "LOW"]
w(f"{len(low)} bodies ({sum(int(r['sku_count']) for r in low)} SKUs) lack the published "
  "dimensions needed to confirm grouping — missing bare height, missing neck finish, or both. "
  "They are **not** counted as confirmed masters.\n")
w("| Body ID | Family | Description | SKUs | Missing |")
w("|---|---|---|---|---|")
for r in low[:15]:
    miss = []
    if r["body_height_mm"] in ("", "None"): miss.append("body height")
    if r["diameter_mm"] in ("", "None"): miss.append("diameter")
    if r["neck_finish"] in ("?", "", "None"): miss.append("neck finish")
    w(f"| {r['body_id']} | {r['family']} | {r['alias']} | {r['sku_count']} | {', '.join(miss) or 'conflict'} |")
w("")

w("## Data defects found\n")
w("1. **Diameter is published on only 55% of SKUs** (1,275 / 2,285). This is the single largest "
  "blocker to proving parametric families — 29 bodies sit in PARAMETRIC CANDIDATE purely for "
  "want of a diameter. Measuring one diameter per candidate group would move them to confirmed.")
w("2. **The Convex snapshot is missing dimensions almost entirely** — diameter on 5/2,318, "
  "heights on 19/2,318, `shape` on 22/2,318. All usable dimensions come from the scraped website "
  "data. Convex is product truth but not dimensional truth.")
w("3. **`cylinder-white-cap-repair.ts` conflicts with the catalog.** It declares the plastic-roller "
  "Swirl row at `heightWithoutCap: 63`, but all 27 other Swirl Cylinder 9 mL SKUs — including "
  "every other plastic roller — publish 74. One of the two is wrong; the repair file is the outlier.")
w("4. **Frosted CYL-9ML is published under two different dimension sets** "
  "(`dia=20/bare=74` and `dia=21/bare=74`) for what the pilot proves is one bottle.\n")

w("## Conclusion\n")
n50, _ = cov(50); n80, _ = cov(80)
w(f"> **Based on the current catalog, we need to create approximately {S['bodies']} unique "
  f"bottle body models to support {S['classes']['BODY']:,} SKUs.**\n")
w(f"> **If we use parametric geometry, that number can potentially be reduced to approximately "
  f"{S['masters_if_parametric']} master Blender models** "
  f"({S['status'].get('UNIQUE GEOMETRY',0)} unique + {S['param_groups']} parametric families).\n")
w("Two caveats on the second number, stated plainly:\n")
w(f"- {S['candidate_param_groups']} of the {S['param_groups']} parametric families are unconfirmed "
  "because diameter is unpublished. Measure one diameter per group and the reduction becomes provable.")
w(f"- The reduction from 109 → {S['masters_if_parametric']} is modest because the catalog is genuinely "
  "diverse across families. The large win is not parametric collapse — it is the "
  f"{S['classes']['BODY']:,} → {S['bodies']} SAME-GEOMETRY collapse already achieved, a "
  f"{S['classes']['BODY']/S['bodies']:.1f}× reduction.\n")
w(f"**Practical build target: {n80} bodies covers 80% of the catalog.** Sequenced by the ranking "
  "above, and every one of the top bodies is EASY or MODERATE.\n")

open(f"{OUT}/bottle-geometry-audit.md", "w").write("\n".join(L) + "\n")
print(f"wrote bottle-geometry-audit.md ({len(L)} lines)")
