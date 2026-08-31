#!/usr/bin/env python3
"""Collapse dimensioned SKUs into DISTINCT GLASS BODIES.

The 3D lane's unit of work is the body, never the SKU: glass colour and closure
are chosen in the browser, so GBCyl9MtlRollMattSl and GBCyl9SpryBlk are one
piece of glass. See BODY-COUNT-LOCK.md.

Writes bodies.csv (the build ledger) and sku-to-body.csv (the configurator's
SKU -> body_id lookup - the GLBs are unaddressable without it).
"""
import csv, collections, re, argparse, pathlib
import numpy as np
from PIL import Image

# Tier 3 - NOT buildable from one silhouette, per the lane's own scope note:
# "Diva-type, faceted, embossed or asymmetric bottles". A lathe of a fluted
# Diva silhouette yields a smooth vase and silently discards every flute;
# Dmnd (Diamond) has a diamond relief pressed into the glass. Surface relief is
# invisible in outline, so these go to an outside modeler against a supplier
# drawing or STEP/IGES - never approximated here.
SCULPTED_FAMILIES = {"Diva", "Dmnd"}

# Container-code prefixes: GB glass bottle, LB lotion bottle, PB plastic, CJ jar.
PREFIX = re.compile(r"^(?:GB|LB|PB|CJ|Alu)", re.I)
COLOUR = re.compile(r"(Frst|Frstd|Amb|Blu|Blue|Clr|Clear|Cl|Grn|Green|Pnk|Pink)", re.I)

def family_of(sku):
    """Family name = letters after the container prefix, before the capacity
    digits, with any colour token removed."""
    s = PREFIX.sub("", sku)
    m = re.match(r"([A-Za-z]+?)(?=\d)", s)
    if not m:
        # SKUs like GB1ozGenieCl lead with the capacity: take the letters that
        # follow the leading digits instead.
        m = re.match(r"[\d.]*(?:oz|ml)?([A-Za-z]+?)(?=\d|$)", s, re.I)
    fam = m.group(1) if m and m.group(1) else "Body"
    fam = COLOUR.sub("", fam) or fam
    return (fam[:12] or "Body")

def shape_of(r):
    """Classify from what the live PDP actually publishes.

    Diameter          -> round (a body of revolution).
    Width AND Depth   -> boxy.
    Width, no depth, no diameter -> UNKNOWN, never "round". "Item Width" on a
      page that never prints a Diameter says nothing about cross-section, and
      Empire 50/100 and Sleek 30/100 are all visibly rectangular. Coercing
      width into a diameter would silently ship four cylinders that should be
      boxes. They stay blocked until a depth is measured."""
    if r.get("width_mm") and r.get("depth_mm"):
        return "boxy"
    if r.get("diameter_mm"):
        return "round"
    return "unknown"

ap = argparse.ArgumentParser()
ap.add_argument("--dims", default="bodies-3d-ok.csv")
ap.add_argument("--qa", default="silhouette-qa.csv")
ap.add_argument("--sil", default="silhouettes")
ap.add_argument("--out-bodies", default="bodies.csv")
ap.add_argument("--out-map", default="sku-to-body.csv")
a = ap.parse_args()

rows = list(csv.DictReader(open(a.dims)))
qa = {r["grace_sku"]: abs(float(r["dev_pct"])) for r in csv.DictReader(open(a.qa))}
sil = pathlib.Path(a.sil)

_prof = {}
def profile_of(sku, n=64):
    """Normalised half-width profile of a silhouette, foot to mouth.

    Returned as n samples scaled to a max of 1.0, so it describes SHAPE only -
    independent of pixel size and of the true millimetres."""
    if sku in _prof: return _prof[sku]
    p = sil / f"{sku}.png"
    out = None
    if p.exists():
        a = np.array(Image.open(p).convert("RGBA"))[..., 3] > 128
        a = np.flipud(a)
        ys = np.nonzero(a.any(axis=1))[0]
        if ys.size:
            r = []
            for y in range(ys.min(), ys.max() + 1):
                xs = np.nonzero(a[y])[0]
                r.append((xs.max() - xs.min()) / 2.0 if xs.size else (r[-1] if r else 0.0))
            r = np.array(r, float)
            if r.max() > 0:
                out = np.interp(np.linspace(0, 1, n),
                                np.linspace(0, 1, r.size), r) / r.max()
    _prof[sku] = out
    return out


def has_assembly_on_top(pr, dip=0.62, rise=0.22):
    """True if the profile necks in and then WIDENS AGAIN higher up.

    That is the signature of a closure fused into the layer - a bulb sprayer,
    an atomiser, a pump head, a mushroom cap. A bottle necks in at the shoulder
    and stays necked in; nothing above its widest point ever re-expands.

    Family-independent, and it catches exactly the cases that defeated every
    size rule: the Crcl and Rnd bulb sprayers whose bulb sits on a stem, where
    a MAJORITY of the group's PSDs fuse the assembly so even the median profile
    is contaminated."""
    i = int(np.argmax(pr))
    # A bottle's widest point is in its lower or middle body - never up top.
    # When the widest point sits in the top quarter, the silhouette is a bulb,
    # atomiser head or mushroom cap sitting above a narrow stem: the Crcl and
    # Rnd bulb sprayers land here, and because the BULB is then the global
    # maximum there is nothing above it for the re-widening test to catch.
    if i > 0.75 * (len(pr) - 1):
        return True
    above = pr[i:]
    if above.size < 6:
        return False
    dipped = False
    for v in above:
        if v <= dip:
            dipped = True
        elif dipped and v >= dip + rise:
            return True
    return False


def pick_representative(members):
    """Choose by CONSENSUS, not by a hand-tuned size or shape threshold.

    Every size-based rule tried here failed on some family, in both directions:
      tallest / largest -> picked bottle-plus-bulb-sprayer composites
                           (GBRndFrst78AnSp*, the Crcl bulb sprayers)
      smallest          -> picked closure crops (GBRnd78RdcrShnBlkTall, a cap)
    and both can land on the right ASPECT by coincidence, so the numeric gate
    cannot see either.

    But a body group is many SKUs of the SAME glass, and most of them do have a
    correct body layer. So take the element-wise MEDIAN profile of the group -
    which outliers cannot move - and pick the member closest to it. Groups
    self-correct, and no threshold needs tuning per family."""
    profs = [(m, profile_of(m["grace_sku"])) for m in members]
    profs = [(m, pr) for m, pr in profs if pr is not None]
    # reject fused-closure silhouettes BEFORE taking the consensus, or the
    # median itself is contaminated wherever most SKUs of a body are sold with
    # a bulb sprayer.
    clean = [(m, pr) for m, pr in profs if not has_assembly_on_top(pr)]
    profs = clean or profs
    if not profs:
        return members[0]
    if len(profs) < 3:
        return min((m for m, _ in profs), key=lambda r: qa.get(r["grace_sku"], 999))
    median = np.median(np.vstack([pr for _, pr in profs]), axis=0)
    return min(profs, key=lambda mp: float(np.abs(mp[1] - median).mean()))[0]


ap = argparse.ArgumentParser()
ap.add_argument("--dims", default="bodies-3d-ok.csv")
ap.add_argument("--qa", default="silhouette-qa.csv")
ap.add_argument("--sil", default="silhouettes")
ap.add_argument("--out-bodies", default="bodies.csv")
ap.add_argument("--out-map", default="sku-to-body.csv")
a = ap.parse_args()

rows = list(csv.DictReader(open(a.dims)))
qa = {r["grace_sku"]: abs(float(r["dev_pct"])) for r in csv.DictReader(open(a.qa))}
sil = pathlib.Path(a.sil)

_feat = {}
def sil_features(sku):
    """(neck_ratio, area) for a stored silhouette.

    Choosing a representative by SIZE fails at both ends, and both failures
    were observed:
      too small -> the layer was a CLOSURE crop, not the bottle
                   (GBRnd78RdcrShnBlkTall, a black cap, matched the body's
                   1.24 aspect almost exactly and passed the numeric gate).
      too large -> the layer fused the bottle with its bulb sprayer and tassel
                   (GBRndFrst78AnSp*), which for a squat flask ALSO lands on
                   the right aspect and builds a bottle with a stem on top.

    Shape separates them where size cannot: a bottle necks in at the top, a
    closure does not. neck_ratio = width of the top 6% of the silhouette over
    its max width. A bare bottle reads well under 0.5; a cap or a jar lid reads
    near 1.0. Among genuine bottles, the smaller silhouette is the one with
    less assembly fused into it."""
    if sku in _feat: return _feat[sku]
    p = sil / f"{sku}.png"
    out = (1.0, 0)
    if p.exists():
        a = np.array(Image.open(p).convert("RGBA"))[..., 3] > 128
        ys = np.nonzero(a.any(axis=1))[0]
        if ys.size:
            y0, y1 = ys.min(), ys.max()
            h = y1 - y0 + 1
            top = a[y1 - max(1, int(h * 0.06)):y1 + 1]
            tw = np.count_nonzero(top.any(axis=0))
            mw = max(1, np.count_nonzero(a.any(axis=0)))
            out = (tw / mw, int(a.sum()))
    _feat[sku] = out
    return out

# --- group: two SKUs sharing this tuple share one piece of glass -------------
def key(r):
    return (shape_of(r), r.get("neck_finish", ""), r.get("height_mm", ""),
            r.get("diameter_mm") or r.get("width_mm"), r.get("depth_mm", ""))

g = collections.defaultdict(list)
for r in rows:
    g[key(r)].append(r)

# --- merge partial-data twins ------------------------------------------------
# A PDP that omits Item Depth produces a "round" group with the same family,
# neck, height and width as a fully-specified boxy group. That is ONE body
# described twice, not two bodies: fold the depth-less group into the boxy one.
boxy_index = {}
for k, members in g.items():
    if k[0] == "boxy":
        boxy_index[(family_of(members[0]["grace_sku"]), k[1], k[2], k[3])] = k
merged = 0
for k in list(g):
    if k[0] != "round" or k[4]:
        continue
    twin = boxy_index.get((family_of(g[k][0]["grace_sku"]), k[1], k[2], k[3]))
    if twin and twin in g:
        g[twin].extend(g.pop(k))
        merged += 1

# --- build the ledger --------------------------------------------------------
bodies, mapping, skipped, unknown = [], [], [], []
for k, members in g.items():
    fam = collections.Counter(family_of(m["grace_sku"]) for m in members).most_common(1)[0][0]
    shape, neck, h, across, d = k
    dims = f"{h}x{across}" + (f"x{d}" if d else "")
    bid = f"{fam}-{shape}-{neck or 'na'}-{dims}".replace(".0", "")

    # representative: closest to catalogue proportions, but only among members
    # whose silhouette is full-height for the group (see sil_height).
    # drop silhouettes that do not neck in at the top - those are closures,
    # not bottles - then prefer the best aspect match, breaking ties toward the
    # smaller silhouette (less closure fused in).
    rep = pick_representative(members)

    # Dimensions come from the GROUP KEY, never from the representative's raw
    # row. After a partial-data twin merge the representative may be the member
    # whose PDP omitted Item Depth, which would hand the builder a boxy body
    # with a blank depth and skip it.
    row = dict(rep)
    row.update(body_id=bid, sku_count=len(members), representative_sku=rep["grace_sku"],
               dev_pct=round(qa.get(rep["grace_sku"], 0), 1), shape_class=shape,
               family=fam, height_mm=h, depth_mm=d)
    if shape == "boxy":
        row["width_mm"], row["diameter_mm"] = across, ""
    elif shape == "round":
        row["diameter_mm"], row["width_mm"] = across, ""
    else:
        # unknown: keep the published width for the record, but publish NO
        # diameter - otherwise the builder re-derives "round" from it and
        # coerces the body into a cylinder through a second path.
        row["width_mm"], row["diameter_mm"], row["depth_mm"] = across, "", ""
    if fam in SCULPTED_FAMILIES:
        row["shape_class"] = "sculpted"
        skipped.append((bid, len(members)))
    elif shape == "unknown":
        unknown.append((bid, len(members)))
    bodies.append(row)
    mapping += [{"grace_sku": m["grace_sku"], "body_id": bid,
                 "neck_finish": m.get("neck_finish", ""),
                 "shape": row["shape_class"]} for m in members]

bodies.sort(key=lambda b: b["body_id"])
cols = ["body_id", "family", "representative_sku", "grace_sku", "neck_finish",
        "shape_class", "height_mm", "diameter_mm", "width_mm", "depth_mm",
        "capacity_ml", "sku_count", "dev_pct"]
with open(a.out_bodies, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
    w.writeheader(); w.writerows(bodies)
with open(a.out_map, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["grace_sku", "body_id", "neck_finish", "shape"])
    w.writeheader(); w.writerows(mapping)

buildable = [b for b in bodies if b["shape_class"] in ("round", "boxy")]
print(f"{len(rows)} SKUs -> {len(bodies)} distinct bodies "
      f"({merged} partial-data twins merged)")
print(f"   buildable  {len(buildable)}  "
      f"({sum(1 for b in buildable if b['shape_class']=='round')} round / "
      f"{sum(1 for b in buildable if b['shape_class']=='boxy')} boxy)")
print(f"   sculpted   {len(skipped)}  (outside modeler): "
      + ", ".join(f"{b}({n})" for b, n in sorted(skipped)))
print(f"   unknown    {len(unknown)}  (width published, no depth and no diameter "
      f"- needs one caliper reading each): "
      + ", ".join(f"{b}({n})" for b, n in sorted(unknown)))
print(f"   -> {a.out_bodies}, {a.out_map} ({len(mapping)} SKU rows)")
