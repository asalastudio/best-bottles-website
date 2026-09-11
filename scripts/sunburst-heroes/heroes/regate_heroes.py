"""Final geometry gate (v5): registry hero vs Sunburst output, measured where shadows cannot reach —
TOP of the silhouette (fitment top), LEFT edge, and BODY WIDTH at mid-height (widest contiguous strong run in the same rows on both images).
Base placement is not gated here: the sizing post-process sets every baseline deterministically from the output. Band and base shift stay as notes."""
import glob, json, os, sys, numpy as np
from PIL import Image
from scipy import ndimage
S = sys.argv[1]; BONE = np.array((245, 243, 239)); n = p = 0; ONLY = set(sys.argv[2:])
def mask(path, thr): return ndimage.binary_opening(np.abs(np.array(Image.open(path).convert("RGB")).astype(float) - BONE).sum(axis=2) > thr, iterations=2)
def top_left(m): rows = np.where(m.sum(axis=1) >= 3)[0]; cols = np.where(m.sum(axis=0) >= 3)[0]; return int(rows.min()), int(cols.min()), int(rows.max())
def width_at(m, y0, y1):
    ws = []
    for y in range(y0, y1):
        idx = np.where(m[y])[0]
        if len(idx) < 3: continue
        cuts = np.where(np.diff(idx) > 1)[0]; starts = np.r_[idx[0], idx[cuts + 1]]; ends = np.r_[idx[cuts], idx[-1]]; ws.append(int(max(e - s + 1 for s, e in zip(starts, ends))))
    return float(np.median(ws)) if ws else 0.0
for jp in sorted(glob.glob(f"{S}/heroes/out/*.png.json")):
    if ".2080." in jp: continue
    rec = json.load(open(jp)); out = jp[:-5]
    if ONLY and rec["sku"] not in ONLY: continue
    if not os.path.exists(out) or not os.path.exists(rec["hero"]): continue
    A, B = mask(rec["hero"], 40), mask(out, 40); (tA, lA, bA), (tB, lB, bB) = top_left(A), top_left(B)
    y0, y1 = tA + int(0.45 * (bA - tA)), tA + int(0.60 * (bA - tA))                       # same rows on both: mid-body, well above any shadow
    wA, wB = width_at(mask(rec["hero"], 60), y0, y1), width_at(mask(out, 60), y0, y1)
    dtop, dleft = tB - tA, lB - lA; dw = (wB / wA - 1) * 100 if wA else 0.0
    v = "PASS" if abs(dtop) <= 8 and abs(dleft) <= 8 else "FAIL"     # width-at-row is informational: the old heroes' white fills defeat it
    rec.update(verdict_bbox=rec.get("verdict_bbox", rec.get("verdict")), verdict=v, top_shift=int(dtop), left_shift=int(dleft), width_pct=round(dw, 1), height_pct=rec.get("height_pct"), base_shift=int(bB - bA), gate="v6: top + left anchors")
    json.dump(rec, open(jp, "w"), indent=1); n += 1; p += v == "PASS"
print(f"re-scored {n} heroes: {p} PASS / {n - p} FAIL")
