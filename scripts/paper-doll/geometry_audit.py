#!/usr/bin/env python3
"""
Best Bottles paper-doll geometry audit.

Determines the minimum number of unique bottle BODY geometries that require a
master 3D model, separating true container geometry from SKU-level variation
(cap colour, glass tint, applicator, finish, decoration).

Evidence base:
  data/audits/2026-03-06/convex_snapshot.json   catalog truth (2318 SKUs)
  data/bestbottles_raw_website_data.json        dimensions (2285 records)

Clustering rule, validated against the CYL-9ML ground truth (all 27 Swirl
Cylinder 9 mL SKUs report bare=74 dia=21 across every applicator and cap
colour, while capped height moves 87->98): heightWithoutCap is a body
dimension, heightWithCap is applicator-contaminated and must never key a body.
"""
import json, csv, re, os
from collections import defaultdict, Counter

ROOT = "/home/user/best-bottles-website"
OUT = os.path.join(ROOT, "docs/paper-doll/geometry-audit")
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- load + join
raw_list = json.load(open(f"{ROOT}/data/bestbottles_raw_website_data.json"))
raw = {x["websiteSku"]: x for x in raw_list if x.get("websiteSku")}
prod = json.load(open(f"{ROOT}/data/audits/2026-03-06/convex_snapshot.json"))["products"]
for p in prod:
    p["_dim"] = raw.get(p.get("websiteSku")) or {}

def num(v):
    if v in (None, "", "N/A"): return None
    m = re.search(r"[\d.]+", str(v))
    return float(m.group()) if m else None

# ------------------------------------------------- classify: body vs component
# Families that are closures/accessories/packaging, never a glass container.
COMPONENT_FAMILIES = {"Sprayer","Roll-On Cap","Cap/Closure","Cap/Component",
                      "Dropper","Lotion Pump"}
NON_PRODUCT_FAMILIES = {"Gift Bag","Gift Box","Packaging Supply","Tool","Unknown"}

def klass(p):
    f = (p.get("family") or "").strip()
    if f in NON_PRODUCT_FAMILIES: return "NON_PRODUCT"
    if f in COMPONENT_FAMILIES: return "COMPONENT"
    if (p.get("assemblyType") or "") == "component": return "COMPONENT"
    if (p.get("assemblyType") or "") == "accessory": return "NON_PRODUCT"
    return "BODY"

for p in prod: p["_class"] = klass(p)

# ------------------------------------------------------- geometry complexity
# Cross-section inferred from family name; catalog `shape` is populated on only
# 22/2318 SKUs so it cannot drive this.
EASY   = {"Cylinder","Boston Round","Round","Circle","Vial","Slim","Royal",
          "Aluminum Bottle","Cream Jar","Apothecary","Plastic Bottle","Lotion Bottle","Atomizer"}
MODERATE = {"Rectangle","Square","Elegant","Sleek","Diva","Empire","Grace","Flair","Tulip"}
COMPLEX  = {"Decorative","Bell","Teardrop","Pillar","Diamond"}
def complexity(fam):
    if fam in EASY: return "EASY"
    if fam in MODERATE: return "MODERATE"
    if fam in COMPLEX: return "COMPLEX"
    return "MODERATE"

# ------------------------------------------------------------- body clustering
# Body key deliberately EXCLUDES: color, capColor, trimColor, capStyle,
# applicator, ballMaterial, finish, decoration, price, stock.
raw_clusters = defaultdict(list)
for p in prod:
    if p["_class"] != "BODY": continue
    d = p["_dim"]
    key = (
        (p.get("family") or "?").strip(),
        p.get("capacityMl"),
        (p.get("neckThreadSize") or "?").strip(),
        num(d.get("diameter")),
        num(d.get("heightWithoutCap")),
    )
    raw_clusters[key].append(p)

# ---------------------------------------------- tolerance merge (noise floor)
# Published catalog dimensions carry measurement/publishing noise. Ground truth:
# the CYL-9ML pilot proves Clear/Amber/Cobalt/Frosted/Swirl are ONE geometry
# (necks agree within 4px, one closure recipe seats on all five), yet the
# catalog splits them into dia=20/bare=70, dia=21/bare=74 and dia=20/bare=74 --
# with Frosted appearing in two clusters at once. That fixes the noise floor at
# +/-1 mm diameter and +/-4 mm height, so merge within family+neck below
# tolerance. Capacity is a reported label, not a measured dimension, so it does
# not block a merge; a large capacity disagreement is flagged instead.
DIA_TOL, H_TOL, CAP_RATIO = 2.0, 5.0, 1.25

parent = {k: k for k in raw_clusters}
def find(x):
    while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
    return x
def union(a, b):
    ra, rb = find(a), find(b)
    if ra != rb: parent[rb] = ra

keys = list(raw_clusters)
for i, a in enumerate(keys):
    fa, ca, na, da, ha = a
    if da is None or ha is None: continue
    for b in keys[i+1:]:
        fb, cb, nb, db, hb = b
        if fa != fb or na != nb: continue
        if db is None or hb is None: continue
        if abs(da-db) <= DIA_TOL and abs(ha-hb) <= H_TOL:
            union(a, b)

merged = defaultdict(list)
merge_conflicts = []
for k, members in raw_clusters.items():
    merged[find(k)].extend(members)
for root, members in merged.items():
    caps = [c for c in {m.get("capacityMl") for m in members} if c]
    if caps and max(caps) / min(caps) > CAP_RATIO:
        merge_conflicts.append(dict(root=str(root), capacities=sorted(caps),
                                    skus=len(members),
                                    note="dimensions merge below tolerance but capacity disagrees"))

def med(vals):
    v = sorted(x for x in vals if x is not None)
    return v[len(v)//2] if v else None

bodies = {}
for root, members in merged.items():
    fam = (members[0].get("family") or "?").strip()
    neck = (members[0].get("neckThreadSize") or "?").strip()
    dia = med([num((m["_dim"]).get("diameter")) for m in members])
    h   = med([num((m["_dim"]).get("heightWithoutCap")) for m in members])
    cap = med([m.get("capacityMl") for m in members])
    bodies[(fam, cap, neck, dia, h)] = members

def confidence(key, members):
    fam, cap, neck, dia, h = key
    if h is None: return "LOW"          # no body height -> cannot verify
    if neck in ("?", None): return "LOW"
    if dia is not None: return "HIGH"    # dia + height + neck + capacity all agree
    return "MEDIUM"                      # height/neck/capacity agree, dia missing

rows, body_of_sku = [], {}
for i, (key, members) in enumerate(
        sorted(bodies.items(), key=lambda kv: (-len(kv[1]), str(kv[0]))), start=1):
    fam, cap, neck, dia, h = key
    bid = f"BB-BODY-{i:03d}"
    conf = confidence(key, members)
    alias = f"{cap:g} ml {fam}" if cap else f"{fam}"
    if h: alias += f" ({h:g} mm body)"
    rows.append(dict(
        body_id=bid, family=fam, alias=alias,
        capacity_ml=cap, diameter_mm=dia, body_height_mm=h, neck_finish=neck,
        sku_count=len(members),
        glass_colors=len({m.get("color") for m in members if m.get("color")}),
        applicators=len({m.get("applicator") for m in members if m.get("applicator")}),
        example_skus="; ".join(sorted(m.get("websiteSku") or "" for m in members)[:3]),
        complexity=complexity(fam), confidence=conf, existing_model="NO",
    ))
    for m in members: body_of_sku[m.get("websiteSku")] = bid

# --------------------------------------------- SAME / PARAMETRIC / UNIQUE class
# Within a family, bodies sharing neck finish and diameter but differing in
# capacity/height are candidates for one profile-driven master.
by_fam_profile = defaultdict(list)
for r in rows:
    by_fam_profile[(r["family"], r["neck_finish"], r["diameter_mm"])].append(r)

parametric_groups = []
for (fam, neck, dia), grp in by_fam_profile.items():
    heights = [g["body_height_mm"] for g in grp if g["body_height_mm"]]
    # A parametric claim is only as good as the shared cross-section behind it.
    # Diameter is published on 55% of SKUs, so a group keyed on an unknown
    # diameter is a candidate to verify, never a confirmed shared profile.
    if len(grp) > 1 and dia is not None:
        status, pid = "PARAMETRIC VARIANT", f"PARAM-{fam.upper().replace(' ','')}-{neck}-{dia:g}"
    elif len(grp) > 1:
        status, pid = "PARAMETRIC CANDIDATE", f"CAND-{fam.upper().replace(' ','')}-{neck}"
    else:
        grp[0]["geometry_status"] = "UNIQUE GEOMETRY"; grp[0]["parametric_group"] = ""
        continue
    for r in grp: r["geometry_status"] = status; r["parametric_group"] = pid
    parametric_groups.append(dict(
        group=pid, status=status, family=fam, neck=neck, diameter_mm=dia,
        bodies=len(grp), skus=sum(g["sku_count"] for g in grp),
        heights=sorted(heights),
        height_span_mm=(max(heights) - min(heights)) if len(heights) > 1 else 0,
        capacities=sorted({g["capacity_ml"] for g in grp if g["capacity_ml"]}),
        drivers=["body_height_mm", "capacity_ml"] if dia is not None
                else ["body_height_mm", "capacity_ml", "diameter_mm (UNVERIFIED)"],
        members=[g["body_id"] for g in grp],
    ))

# ------------------------------------------------------- component clustering
COMP_PREFIX = {"Sprayer":"BB-SPRAYER","Roll-On Cap":"BB-ROLLER","Dropper":"BB-DROPPER",
               "Lotion Pump":"BB-PUMP","Cap/Closure":"BB-CAP","Cap/Component":"BB-CAP"}
comps = defaultdict(list)
for p in prod:
    if p["_class"] != "COMPONENT": continue
    fam = (p.get("family") or "?").strip()
    # component identity = type + neck it mates to + style. NOT colour/finish.
    comps[(fam, (p.get("neckThreadSize") or "?").strip(),
           (p.get("capStyle") or p.get("applicator") or "?").strip())].append(p)

comp_rows = []
ctr = Counter()
for key, members in sorted(comps.items(), key=lambda kv: -len(kv[1])):
    fam, neck, style = key
    pref = COMP_PREFIX.get(fam, "BB-COMP")
    ctr[pref] += 1
    comp_rows.append(dict(
        component_id=f"{pref}-{ctr[pref]:03d}", type=fam, style=style, neck_finish=neck,
        description=f"{style} {fam} for {neck}",
        sku_count=len(members),
        colorways=len({m.get("capColor") for m in members if m.get("capColor")}),
        example_skus="; ".join(sorted(m.get("websiteSku") or "" for m in members)[:3]),
        existing_model="PARTIAL (cyl9_rollon_overcap.py lathe)" if "Roll-On" in fam else "NO",
    ))

# ------------------------------------------------------------------- geometry map
gmap = {}
for p in prod:
    sku = p.get("websiteSku")
    if not sku: continue
    d = p["_dim"]
    gmap[sku] = dict(
        bottle_family=p.get("family"), classification=p["_class"],
        body_id=body_of_sku.get(sku),
        body_geometry_status=next((r["geometry_status"] for r in rows
                                   if r["body_id"] == body_of_sku.get(sku)), None),
        dimensions=dict(capacity_ml=p.get("capacityMl"),
                        diameter_mm=num(d.get("diameter")),
                        body_height_mm=num(d.get("heightWithoutCap")),
                        capped_height_mm=num(d.get("heightWithCap"))),
        neck_finish=p.get("neckThreadSize"),
        variation_axes=dict(glass_color=p.get("color"), cap_color=p.get("capColor"),
                            applicator=p.get("applicator"), cap_style=p.get("capStyle")),
        existing_asset=None,
        confidence=next((r["confidence"] for r in rows
                         if r["body_id"] == body_of_sku.get(sku)), None),
    )

# ------------------------------------------------------------------- write out
with open(f"{OUT}/bottle-bodies.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
with open(f"{OUT}/bottle-components.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(comp_rows[0].keys())); w.writeheader(); w.writerows(comp_rows)
with open(f"{OUT}/bottle-geometry-map.json", "w") as f:
    json.dump(dict(generatedFrom=["data/audits/2026-03-06/convex_snapshot.json",
                                  "data/bestbottles_raw_website_data.json"],
                   skuCount=len(gmap), bodyCount=len(rows), componentCount=len(comp_rows),
                   skus=gmap), f, indent=2)

# ------------------------------------------------------------------- summary
conf_ct = Counter(r["confidence"] for r in rows)
stat_ct = Counter(r["geometry_status"] for r in rows)
cx_ct   = Counter(r["complexity"] for r in rows)
cls_ct  = Counter(p["_class"] for p in prod)
confirmed_param = len({g["group"] for g in parametric_groups if g["status"]=="PARAMETRIC VARIANT"})
candidate_param = len({g["group"] for g in parametric_groups if g["status"]=="PARAMETRIC CANDIDATE"})
param_masters = confirmed_param + candidate_param
unique_bodies = stat_ct.get("UNIQUE GEOMETRY", 0)

S = dict(skus=len(prod), joined=sum(1 for p in prod if p["_dim"]),
         classes=dict(cls_ct), families=len({r["family"] for r in rows}),
         bodies=len(rows), components=len(comp_rows),
         conf=dict(conf_ct), status=dict(stat_ct), complexity=dict(cx_ct),
         param_groups=len(parametric_groups), param_masters=param_masters,
         confirmed_param_groups=confirmed_param, candidate_param_groups=candidate_param,
         unique_bodies=unique_bodies,
         masters_if_parametric=param_masters + unique_bodies,
         merge_conflicts=len(merge_conflicts))
json.dump(S, open(f"{OUT}/_summary.json","w"), indent=2)
json.dump(parametric_groups, open(f"{OUT}/_parametric.json","w"), indent=2)
json.dump(merge_conflicts, open(f"{OUT}/_merge_conflicts.json","w"), indent=2)

print(json.dumps(S, indent=2))
print("\nTOP 15 BODIES BY SKU COUNT")
for r in rows[:15]:
    print(f"  {r['body_id']} {r['sku_count']:4d} SKUs  {r['alias']:38s} neck={r['neck_finish']:9s} "
          f"dia={r['diameter_mm']} {r['complexity']:8s} {r['confidence']:6s} {r['geometry_status']}")
print("\nLARGEST PARAMETRIC GROUPS")
for g in sorted(parametric_groups, key=lambda x:-x['skus'])[:10]:
    print(f"  {g['skus']:4d} SKUs  {g['bodies']} bodies  {g['family']:14s} neck={g['neck']:9s} "
          f"dia={g['diameter_mm']}  heights={g['heights'][:6]}")
