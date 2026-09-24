#!/usr/bin/env python3
"""
matte_master.py — solve the glass layer from render_clear_master.py's two passes,
downsample to the kit canvas, and measure registration against the live kits.

    python3 scripts/matte_master.py pilot/cyl9-clear-17-415-master

ALPHA
  black and bone differ only in the backdrop, so per pixel
      t = mean_c((bone_px - black_px) / BONE_c)        how much backdrop shows through
      a = 1 - t
      C = (bone_px - (1 - a) * BONE) / a               chosen so C over BONE == the bone pass
  Composited over the bone stage the layer reproduces the bone render (residual
  reported); over other grounds it is a display-space approximation.

REGISTRATION (1000x1100 kit canvas)
  Targets come from the repo, not from memory:
    src/lib/asset-ledger/plate-geometry.json    29 live CLEAR 17-415 plates: width, foot
    data/paper-doll/cylinder-leftover-kits/GBCyl9Roll*.kit.json   body bounds, anchors, cap/roller seats
  The plate ruler is re-implemented exactly (scripts/asset-ledger/measure-plates.py).

Needs numpy, pillow, scipy, pypng.
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import png
from PIL import Image, ImageDraw
from scipy import ndimage

LANE = Path(__file__).resolve().parents[1]
REPO = LANE.parents[1]
KIT_W, KIT_H = 1000, 1100


def read16(path):
    w, h, rows, info = png.Reader(filename=str(path)).asDirect()
    planes = info["planes"]
    a = np.vstack([np.asarray(r, dtype=np.uint16) for r in rows]).reshape(h, w, planes)
    return a[..., :3].astype(np.float64) / (2 ** info["bitdepth"] - 1)


def resize(arr, size):
    """Lanczos per channel in float."""
    return np.stack([np.asarray(Image.fromarray(arr[..., c].astype(np.float32), "F").resize(size, Image.LANCZOS))
                     for c in range(arr.shape[2])], axis=-1)


def to8(x):
    return np.clip(np.round(x * 255), 0, 255).astype(np.uint8)


def plate_ruler(rgb8):
    """measure-plates.py measure(), verbatim logic."""
    a = rgb8.astype(float)
    bg = np.median(np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]), axis=0)
    d = np.abs(a - bg).max(axis=2)
    lab, _ = ndimage.label(d <= 10)
    edge = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
    m = ndimage.binary_opening(~np.isin(lab, list(edge)), iterations=2)
    ys = np.where(m.any(axis=1))[0]
    y0, y1 = int(ys.min()), int(ys.max())
    cols = np.where(m[y0 + int(0.4 * (y1 - y0)):y1 + 1].any(axis=0))[0]
    return dict(bodyWidth=int(cols.max() - cols.min() + 1), height=int(y1 - y0 + 1), foot=y1, top=y0,
                axis=float((cols.max() + cols.min() + 1) / 2)), m


def alpha_gate(alpha8):
    """build_cyl9_kits.py alpha gate: real transparency, a soft edge, no hard crop."""
    a = alpha8
    clear = float((a == 0).mean())
    semi = int(((a > 0) & (a < 255)).sum())
    ys, xs = np.where(a > 0)
    t, b, l, r = ys.min(), ys.max(), xs.min(), xs.max()
    rim = np.zeros_like(a, bool)
    rim[t:t + 2, l:r + 1] = rim[b - 1:b + 1, l:r + 1] = True
    rim[t:b + 1, l:l + 2] = rim[t:b + 1, r - 1:r + 1] = True
    hard = int(((a == 255) & rim).sum())
    return dict(ok=clear >= 0.05 and semi >= 50 and hard == 0, fullyTransparent=round(clear, 4),
                semiTransparentPx=semi, opaqueOnBboxEdge=hard)


def live_targets():
    geo = json.loads((REPO / "src/lib/asset-ledger/plate-geometry.json").read_text())["plates"]
    rows = [r for r in geo.values() if r.get("familyId") == "cylinder-9ml-clear-17-415"]
    kits = []
    for f in sorted((REPO / "data/paper-doll/cylinder-leftover-kits").glob("GBCyl9Roll*.kit.json")):
        k = json.loads(f.read_text())
        parts = {p["slot"]: p["bounds"] for p in k["parts"]}
        kits.append(dict(sku=k["sku"], anchors=k["anchors"], body=parts.get("body"),
                         roller=parts.get("roller"), cap=parts.get("cap")))
    return dict(
        plates=len(rows),
        widths=sorted({r["bodyWidth"] for r in rows}), widthMedian=float(np.median([r["bodyWidth"] for r in rows])),
        feet=sorted({r["foot"] for r in rows}), footMedian=float(np.median([r["foot"] for r in rows])),
        kits=kits,
    )


def sheet(out, plate, layer, clay, tgt, ours, rim_y):
    """Guides on the kit canvas: what the overlays expect vs where this glass stands."""
    W, H = KIT_W, KIT_H
    k0 = tgt["kits"][0]
    check = np.indices((H, W)).sum(0) // 16 % 2
    checker = np.where(check[..., None], 232, 250).astype(np.uint8).repeat(3, -1)
    a = layer[..., 3:4] / 255.0
    on_check = (layer[..., :3] * a + checker * (1 - a)).astype(np.uint8)
    tiles = [Image.fromarray(plate), Image.fromarray(on_check), Image.fromarray(clay)]
    canvas = Image.new("RGB", (W * 3 + 40, H + 70), (245, 243, 239))
    d = ImageDraw.Draw(canvas)
    labels = ["bone plate (alpha over #F5F3EF)", "RGBA layer on checker", "clay twin"]
    for i, t in enumerate(tiles):
        x = i * (W + 20)
        canvas.paste(t, (x, 60))
        d.text((x + 8, 8), labels[i], fill=(40, 40, 40))
        g = ImageDraw.Draw(canvas)
        def hline(y, col, name):
            g.line([(x, 60 + y), (x + W - 1, 60 + y)], fill=col, width=1)
            g.text((x + 8, 60 + y - 12), f"{name} y={y:.0f}", fill=col)
        g.line([(x + k0["anchors"]["axisX"], 60), (x + k0["anchors"]["axisX"], 60 + H)], fill=(40, 90, 220), width=1)
        hline(k0["anchors"]["seatY"], (210, 40, 40), "kit seatY (photographed rim)")
        hline(rim_y, (20, 150, 60), "this glass: rim datum")
        hline(k0["roller"]["bottom"], (150, 60, 170), "kit roller insert bottom")
        hline(k0["cap"]["bottom"], (200, 120, 20), "kit cap skirt bottom")
        hline(ours["foot"], (90, 90, 90), "foot")
    d.text((8, 30), f"axis x={k0['anchors']['axisX']} (blue)   plate ruler: width {ours['bodyWidth']} px vs live "
                    f"{tgt['widths']}   foot {ours['foot']} vs live {tgt['feet']}", fill=(40, 40, 40))
    canvas.save(out)


def main():
    out = Path(sys.argv[1])
    out = out if out.is_absolute() else LANE / out
    prm = json.loads((out / "render-params.json").read_text())
    f = prm["canvas"]["factor"]
    black, bone = read16(out / "raw/black.png"), read16(out / "raw/bone.png")
    clay = read16(out / "raw/clay.png") if (out / "raw/clay.png").exists() else None
    BONE = np.array(prm["bone"], float) / 255.0

    # outside the render border the frame is the flat backdrop by construction
    b = prm["border_kit_px"]
    H, W = black.shape[:2]
    inside = np.zeros((H, W), bool)
    m = int(np.ceil(2 * f)) + 3                        # the render border's own edge pixels are partial
    inside[max(0, int(b["top"] * f) + m):int(b["bottom"] * f) - m, max(0, int(b["left"] * f) + m):int(b["right"] * f) - m] = True
    black[~inside] = 0.0
    bone[~inside] = BONE
    if clay is not None:
        clay[~inside] = BONE

    t = ((bone - black) / BONE).mean(axis=2)
    alpha = np.clip(1.0 - t, 0.0, 1.0)
    alpha[alpha < 0.5 / 255] = 0.0
    # a highlight brighter than the stage cannot be a straight-alpha colour <= 1 at low alpha:
    # raise alpha just enough that C stays in gamut and the composite over bone is still exact
    need = ((bone - BONE) / np.maximum(1 - BONE, 1e-6)).max(axis=2)
    alpha = np.maximum(alpha, np.clip(need, 0, 1))
    alpha[alpha < 3 / 255] = 0.0
    safe = np.maximum(alpha, 1e-6)[..., None]
    color = np.clip((bone - (1 - alpha[..., None]) * BONE) / safe, 0, 1)
    color[alpha == 0] = 0.0

    # full-res deliverables
    rgba_hi = np.dstack([to8(color), to8(alpha)])
    recon = to8(color) / 255.0 * (rgba_hi[..., 3:4] / 255.0) + BONE * (1 - rgba_hi[..., 3:4] / 255.0)
    resid_hi = np.abs(to8(recon).astype(int) - to8(bone).astype(int))

    # kit canvas: premultiplied Lanczos, then un-premultiply
    kit = (KIT_W, KIT_H)
    pm = resize(np.dstack([color * alpha[..., None], alpha]), kit)
    a_lo = np.clip(pm[..., 3], 0, 1)
    c_lo = np.clip(pm[..., :3] / np.maximum(a_lo, 1e-6)[..., None], 0, 1)
    a_lo[a_lo < 3 / 255] = 0.0            # sub-visible haze: border-edge ringing and denoiser residue
    c_lo[a_lo == 0] = 0.0
    rgba_lo = np.dstack([to8(c_lo), to8(a_lo)])
    plate_lo = to8(c_lo * a_lo[..., None] + BONE * (1 - a_lo[..., None]))
    clay_lo = to8(np.clip(resize(clay, kit), 0, 1)) if clay is not None else None

    stem = f"cyl9-clear-17-415.body-{prm['label']}"
    files = {
        f"{stem}.layer-2080x2288.png": Image.fromarray(rgba_hi, "RGBA"),
        f"{stem}.layer-1000x1100.png": Image.fromarray(rgba_lo, "RGBA"),
        f"{stem}.plate-bone-2080x2288.png": Image.fromarray(to8(bone)),
        f"{stem}.plate-bone-1000x1100.png": Image.fromarray(plate_lo),
    }
    if clay is not None:
        files[f"{stem}.clay-bone-2080x2288.png"] = Image.fromarray(to8(clay))
        files[f"{stem}.clay-bone-1000x1100.png"] = Image.fromarray(clay_lo)
    hashes = {}
    for name, im in files.items():
        im.save(out / name, optimize=True)
        hashes[name] = hashlib.sha256((out / name).read_bytes()).hexdigest()
    webp = out / f"{stem}.layer-1000x1100.webp"
    Image.fromarray(rgba_lo, "RGBA").save(webp, lossless=True, quality=100, method=6)
    hashes[webp.name] = hashlib.sha256(webp.read_bytes()).hexdigest()

    # ---------------------------------------------------------------- registration
    tgt = live_targets()
    ours, mask = plate_ruler(plate_lo)
    ys, xs = np.where(a_lo > 0)
    abbox = dict(left=int(xs.min()), right=int(xs.max()) + 1, top=int(ys.min()), bottom=int(ys.max()) + 1)
    reg = prm["registration"]
    rim_y = reg["rim_y"]
    # neck axis: centre of the finish columns between the rim and the shoulder
    shoulder_y = reg["foot_y"] - prm["body"]["shoulder_mm"] * reg["kit_px_per_mm"]
    neck = mask[int(rim_y) + 3:int(shoulder_y) - 3]
    ncols = np.where(neck.any(axis=0))[0]
    neck_axis = float((ncols.min() + ncols.max() + 1) / 2)
    k = tgt["kits"]
    seat = [x["anchors"]["seatY"] for x in k]
    base = [x["anchors"]["baselineY"] for x in k]
    axis = [x["anchors"]["axisX"] for x in k]
    gates = {
        "foot": dict(ours=ours["foot"], live=tgt["feet"], delta=ours["foot"] - tgt["footMedian"], limit=10,
                     ok=abs(ours["foot"] - tgt["footMedian"]) <= 10),
        "bodyAxis": dict(ours=ours["axis"], kit=axis, delta=ours["axis"] - axis[0], limit=12,
                         ok=abs(ours["axis"] - axis[0]) <= 12),
        "closureAxis": dict(oursNeck=neck_axis, kit=axis, delta=neck_axis - axis[0], limit=2,
                            ok=abs(neck_axis - axis[0]) <= 2),
        "width": dict(ours=ours["bodyWidth"], live=tgt["widths"], median=tgt["widthMedian"],
                      deviation=round(ours["bodyWidth"] / tgt["widthMedian"] - 1, 4), limit=0.05,
                      ok=abs(ours["bodyWidth"] / tgt["widthMedian"] - 1) <= 0.05),
        "rimSeat": dict(oursRimDatum=round(rim_y, 1), oursAlphaTop=abbox["top"], kitSeatY=seat,
                        delta=round(abbox["top"] - float(np.mean(seat)), 1), limit=12,
                        ok=abs(abbox["top"] - float(np.mean(seat))) <= 12,
                        meaning="kit caps/rollers were cut from photos seated on a rim at kit seatY; "
                                "a positive delta leaves that many px of air between rim and closure"),
        "baseline": dict(oursAlphaBottom=abbox["bottom"], kitBaselineY=base,
                         delta=abbox["bottom"] - float(np.mean(base)), ok=abs(abbox["bottom"] - float(np.mean(base))) <= 10),
        "alpha": alpha_gate(rgba_lo[..., 3]),
        "bonePlateReconstruction": dict(maxAbs8bit=int(resid_hi.max()), p999Abs8bit=float(np.percentile(resid_hi, 99.9)),
                                        meanAbs8bit=round(float(resid_hi.mean()), 4),
                                        ok=int(resid_hi.max()) <= 6 and float(np.percentile(resid_hi, 99.9)) <= 1),
        "registrationResidual": dict(ok=None, note="needs the live kit body pixels (Vercel Blob); the proxy in this "
                                                  "environment returned 403, so it was not measured"),
    }
    qa = dict(label=prm["label"], params=prm["registration"], body=prm["body"], alphaBBox=abbox, plateRuler=ours,
              live=dict(plates=tgt["plates"], widths=tgt["widths"], feet=tgt["feet"],
                        kits=[dict(sku=x["sku"], anchors=x["anchors"], body=x["body"], roller=x["roller"], cap=x["cap"]) for x in k]),
              gates=gates, files=hashes)
    (out / "qa.json").write_text(json.dumps(qa, indent=1))
    sheet(out / f"{stem}.qa-sheet.png", plate_lo, rgba_lo, clay_lo if clay_lo is not None else plate_lo, tgt, ours, rim_y)
    for name, g in gates.items():
        print(f"{name:26s} {'PASS' if g.get('ok') else ('n/a ' if g.get('ok') is None else 'FAIL')}  "
              + json.dumps({kk: vv for kk, vv in g.items() if kk not in ('ok', 'meaning', 'note')}))


if __name__ == "__main__":
    main()
