#!/usr/bin/env python3
"""Printable neck-finish matrix, built from the same data and images as the web builder.

    python3 scripts/help/build_matrix_pdf.py            # writes public/downloads/matrices/*.pdf

Reads src/lib/help/fit-index.generated.json (what fits) and
src/lib/help/fit-media.generated.json (approved master images with true-scale
geometry). Nothing is drawn by hand or generated: bottles and parts are the
same masters the builder assembles, bottles are scaled by their real height,
and every part carries the item code customers order by. Two landscape files per neck finish: one 17 x 11 in tabloid page, and
a two-page US letter version (closures, then bottles) whose item codes stay readable.
"""
from __future__ import annotations

import io
import json
import re
import sys
import tempfile
import urllib.request
from datetime import date
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont as PdfFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "downloads" / "matrices"
W, H = 17 * 72, 11 * 72
M = 36  # page margin, pt
INK, MUTED, LINE, HAIR, STAGE, CARD = (HexColor(c) for c in ("#1c1c1e", "#637588", "#a9623f", "#d9cdb9", "#f5f3ef", "#ffffff"))
GOLD = HexColor("#8b6f42")

GROUPS = [  # the order the builder and the September sheets use
    ("roll-on-cap", "Roll-on caps", lambda c: c["type"] == "roll-on-cap", "Fit over either roller insert"),
    ("roller-insert", "Roller inserts", lambda c: c["type"] == "roller-insert", "Sit inside the neck, under the roll-on cap"),
    ("fine-mist-sprayer", "Fine mist sprayers", lambda c: c["type"] == "fine-mist-sprayer", "Each comes with its matching overcap"),
    ("short-ribbed-cap", "Short ribbed caps", lambda c: c["type"] == "cap" and c.get("style") == "Short ribbed", "Pour bottles: black or white"),
    ("short-cap", "Short caps with liner", lambda c: c["type"] == "cap" and c.get("style") == "Short", "Pour bottles: foam liner"),
    ("tall-cap", "Tall caps with liner", lambda c: c["type"] == "cap" and c.get("style") == "Tall", "Pour bottles: 24 mm high"),
]


def fonts() -> None:
    tmp = Path(tempfile.mkdtemp())
    for weight in (400, 500, 600, 700):
        font = TTFont(ROOT / "public/fonts/montserrat/montserrat-latin-wght-normal.woff2")
        font.flavor = None
        instancer.instantiateVariableFont(font, {"wght": weight}).save(tmp / f"m{weight}.ttf")
        pdfmetrics.registerFont(PdfFont(f"M{weight}", str(tmp / f"m{weight}.ttf")))


def image(src: str) -> Image.Image:
    data = urllib.request.urlopen(src).read() if src.startswith("http") else (ROOT / "public" / src.lstrip("/")).read_bytes()
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    return im.crop(im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())


def finish(name: str) -> str:
    text = re.sub(r",?\s*Thread\s*size.*$|,?\s*Threadsize.*$", "", name, flags=re.I)
    for pattern, repl in ((r"Fine Mist Sprayer", ""), (r"cap with dots or closure for rollon bottles", "dotted"), (r"cap or closure for rollon bottles", ""),
                          (r"lid or closure for glass bottle", ""), (r"short cap with liner", "")):
        text = re.sub(pattern, repl, text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:1].upper() + text[1:]


_IMAGES: dict = {}


def cached(src: str, max_px: int) -> Image.Image:
    """The master, trimmed and reduced to print resolution (keeps the PDF small)."""
    key = (src, max_px)
    if key not in _IMAGES:
        im = image(src)
        if max(im.size) > max_px:
            k = max_px / max(im.size)
            im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        _IMAGES[key] = im
    return _IMAGES[key]


def gather(neck: str, fit: dict, media: dict):
    bodies = sorted((b for b in fit["bodies"] if b["neck"] == neck and b["interchangeable"]),
                    key=lambda b: (b["capacityMl"] or 0, b["heightMm"] or 0))
    comps = fit["components"]
    parts = {key: [] for key, *_ in GROUPS}
    for cid in sorted({i for b in bodies for i in b["listed"]}):
        comp = comps[cid]
        group = next((key for key, _, test, _ in GROUPS if test(comp)), None)
        if group and cid in media["parts"]:
            parts[group].append({"id": cid, "code": comp["itemCode"], "finish": finish(comp["name"]), "src": media["parts"][cid]["src"]})
    for cid, label in ((f"LIB-{neck}-PlsticRollon", "Plastic ball"), (f"LIB-{neck}-MtlRollon", "Metal ball")):
        if cid in media["parts"]:
            parts["roller-insert"].append({"id": cid, "code": None, "finish": label, "src": media["parts"][cid]["src"]})
    return bodies, parts


class Sheet:
    def __init__(self, c, w, h):
        self.c, self.W, self.H = c, w, h

    def text(self, x, y, value, size=9, color=INK, weight=400, align="left", tracking=0):
        c = self.c
        c.setFillColor(color)
        t = c.beginText()
        t.setFont(f"M{weight}", size)
        t.setCharSpace(tracking)
        width = self.width(value, size, weight, tracking)
        t.setTextOrigin(x - (width / 2 if align == "center" else width if align == "right" else 0), y)
        t.textOut(value)
        c.drawText(t)

    @staticmethod
    def width(value, size, weight=400, tracking=0):
        return pdfmetrics.stringWidth(value, f"M{weight}", size) + tracking * max(len(value) - 1, 0)

    def wrap(self, value, size, weight, max_w):
        words, lines, line = value.split(), [], ""
        for word in words:
            trial = f"{line} {word}".strip()
            if self.width(trial, size, weight) <= max_w or not line:
                line = trial
            else:
                lines.append(line)
                line = word
        return lines + ([line] if line else [])

    def picture(self, src, x, y, w, h, max_px, anchor="center"):
        im = cached(src, max_px)
        k = min(w / im.width, h / im.height)
        dw, dh = im.width * k, im.height * k
        self.c.drawImage(ImageReader(im), x + (w - dw) / 2, y if anchor == "bottom" else y + (h - dh) / 2, dw, dh, mask="auto")

    def page(self):
        self.c.setFillColor(HexColor("#fdfbf8"))
        self.c.rect(0, 0, self.W, self.H, stroke=0, fill=1)

    def header(self, neck, fit, title_note=None):
        W, H, text = self.W, self.H, self.text
        big = 30 if W > 1000 else 24
        text(M, H - M - big, neck, big, INK, 700)
        text(M + self.width(neck, big, 700) + 14, H - M - big + 7, "NECK-FINISH MATRIX" + (f"  ·  {title_note}" if title_note else ""), big * 0.45, INK, 600, tracking=1.4)
        ruling = fit.get("neckRulings", {}).get(neck)
        sub = (f"Every applicator and closure on this sheet fits every {neck} bottle on it (confirmed by our team, {ruling['date']})." if ruling
               else "Parts our catalog sells with these bottles.") + " Choose a bottle, then an applicator, then a closure."
        text(M, H - M - big - 16, sub, 8.5, MUTED, 400)
        d, t = neck.split("-")
        text(W - M, H - M - 12, f"{d} = neck diameter in mm   ·   {t} = thread style", 8, MUTED, 500, "right")
        text(W - M, H - M - 25, f"Catalog records {fit['snapshotDate']}  ·  sheet {date.today().isoformat()}", 7.5, MUTED, 400, "right")
        self.c.setStrokeColor(INK)
        self.c.setLineWidth(1)
        y = H - M - big - 26
        self.c.line(M, y, W - M, y)
        return y

    def footer(self, neck):
        W, text = self.W, self.text
        self.c.setStrokeColor(HAIR)
        self.c.setLineWidth(0.7)
        self.c.line(M, M + 24, W - M, M + 24)
        text(M, M + 11, f"Build and order: bestbottles.com/help/fit/neck/{neck}   ·   Price and stock: search the item code at bestbottles.com/catalog", 7, INK, 500)
        text(W - M, M + 11, "Fit is physical only. Test samples with your formula before ordering.", 7, MUTED, 400, "right")
        text(M, M - 1, "Bottles at true relative height from our approved master images. One glass colour is shown per bottle; other colours share the same neck.", 6.2, MUTED, 400)

    def code_lines(self, code, max_w):
        """Item codes never overlap: shrink to fit, and split after the prefix when even that is too small."""
        for size in (5.2, 4.8, 4.4):
            if self.width(code, size) <= max_w:
                return [code], size
        cut = re.search(r"\d", code)
        cut = cut.start() if cut and cut.start() > 0 else len(code) // 2
        head, tail = code[:cut], code[cut:]
        size = 5.0
        while size > 3.6 and max(self.width(head, size), self.width(tail, size)) > max_w:
            size -= 0.2
        return [head, tail], size

    def closures(self, parts, top, bottom, rows):
        """Rows of cards; rows lists (group key, width fraction) per row."""
        c, text = self.c, self.text
        gap = 10
        row_h = (top - bottom - gap * (len(rows) - 1)) / len(rows)
        meta = {key: (label, note) for key, label, _, note in GROUPS}
        for row, row_spec in enumerate(rows):
            y = top - (row + 1) * row_h - row * gap
            x = M
            avail = self.W - 2 * M - gap * (len(row_spec) - 1)
            for key, frac in row_spec:
                card_w = avail * frac
                items = parts[key]
                label, note = meta[key]
                c.setFillColor(CARD)
                c.setStrokeColor(HAIR)
                c.setLineWidth(0.7)
                c.rect(x, y, card_w, row_h, stroke=1, fill=1)
                text(x + 11, y + row_h - 18, f"{label.upper()}  /  {len(items)}", 8.5, GOLD, 600, tracking=1.0)
                text(x + 11, y + row_h - 30, note, 7, MUTED, 400)
                cell = min((card_w - 22) / max(len(items), 1), 66)
                x0 = x + 11 + ((card_w - 22) - cell * len(items)) / 2
                img_h = row_h - 80
                for j, part in enumerate(items):
                    cx = x0 + j * cell
                    c.setFillColor(STAGE)
                    c.rect(cx + 1.5, y + 40, cell - 3, img_h, stroke=0, fill=1)
                    self.picture(part["src"], cx + 5, y + 44, cell - 10, img_h - 8, 260)
                    name = self.wrap(part["finish"], 6, 500, cell - 4)[:2]
                    for k, line in enumerate(name):
                        text(cx + cell / 2, y + 31 - k * 7, line, 6, INK, 500, "center")
                    if part["code"]:
                        lines, size = self.code_lines(part["code"], cell - 4)
                        for k, line in enumerate(lines):
                            text(cx + cell / 2, y + 15 - k * (size + 1.2), line, size, MUTED, 400, "center")
                x += card_w + gap

    def band(self, neck, y):
        c = self.c
        c.setStrokeColor(LINE)
        c.setLineWidth(1.2)
        c.line(M, y, self.W - M, y)
        label = f"{neck} FINISH"
        lw = self.width(label, 9.5, 600, 1.4) + 28
        c.setFillColor(HexColor("#fdfbf8"))
        c.roundRect(self.W / 2 - lw / 2, y - 10.5, lw, 21, 10.5, stroke=1, fill=1)
        self.text(self.W / 2, y - 3.5, label, 9.5, LINE, 600, "center", tracking=1.4)

    def bottles(self, bodies, media, top, bottom, rows=1):
        """Bottles smallest to largest at one shared scale (true relative height), in one or more rows."""
        c, text = self.c, self.text
        per_row = -(-len(bodies) // rows)
        cell = (self.W - 2 * M) / per_row
        label_h = 34
        row_gap = 14
        row_h = (top - bottom - row_gap * (rows - 1)) / rows
        img_h = row_h - label_h - 16

        def mm(b):
            m = media["bodies"][b["id"]]
            return m["width"] / m["pxPerMm"], m["height"] / m["pxPerMm"]
        # One scale (pt per mm) for every bottle, so relative heights stay true and the widest still fits its column.
        scale = min(img_h / max(mm(b)[1] for b in bodies), min((cell - 6) / mm(b)[0] for b in bodies))
        for r in range(rows):
            row_bodies = bodies[r * per_row:(r + 1) * per_row]
            row_bottom = top - (r + 1) * row_h - r * row_gap
            for i, b in enumerate(row_bodies):
                x = M + i * cell
                c.setFillColor(STAGE)
                c.setStrokeColor(HAIR)
                c.setLineWidth(0.6)
                c.rect(x, row_bottom + label_h, cell, row_h - label_h, stroke=1, fill=1)
                m = media["bodies"][b["id"]]
                h = scale * m["height"] / m["pxPerMm"]
                im = cached(m["src"], 640)
                w = im.width * h / im.height
                c.drawImage(ImageReader(im), x + (cell - w) / 2, row_bottom + label_h + 8, w, h, mask="auto")
                cap = b["capacityMl"]
                cap = int(cap) if float(cap).is_integer() else cap
                lines = self.wrap(f"{b.get('name') or b['family']} {cap} ml", 6.8, 600, cell - 4)[:2]
                for k, line in enumerate(lines):
                    text(x + cell / 2, row_bottom + label_h - 10 - k * 8, line, 6.8, INK, 600, "center")
                text(x + cell / 2, row_bottom + label_h - 12 - len(lines) * 8, f"{b['heightMm']} mm tall", 6, MUTED, 400, "center")


def new_canvas(path: Path, size, neck: str):
    c = canvas.Canvas(str(path), pagesize=size, pageCompression=1, invariant=1)
    c.setTitle(f"Best Bottles {neck} neck-finish matrix")
    c.setAuthor("Best Bottles")
    c.setSubject(f"Every {neck} bottle and the applicators and closures that fit it, with item codes")
    return c


def build(neck: str, fit: dict, media: dict) -> list[Path]:
    bodies, parts = gather(neck, fit, media)
    OUT.mkdir(parents=True, exist_ok=True)
    keys = [key for key, *_ in GROUPS]
    tabloid_rows = [list(zip(keys[:3], (0.42, 0.16, 0.42))), list(zip(keys[3:], (1 / 3, 1 / 3, 1 / 3)))]
    letter_rows = [[(keys[0], 0.7), (keys[1], 0.3)], [(keys[2], 1.0)], [(keys[3], 0.26), (keys[4], 0.5), (keys[5], 0.24)]]

    # Tabloid, landscape: the whole matrix on one 17 x 11 in page.
    tabloid = OUT / f"best-bottles-{neck}-neck-matrix-tabloid.pdf"
    c = new_canvas(tabloid, (17 * 72, 11 * 72), neck)
    s = Sheet(c, 17 * 72, 11 * 72)
    s.page()
    rule = s.header(neck, fit)
    closures_bottom = rule - 12 - 330
    s.closures(parts, rule - 12, closures_bottom, tabloid_rows)
    s.band(neck, closures_bottom - 22)
    s.bottles(bodies, media, closures_bottom - 42, M + 34)
    s.footer(neck)
    c.showPage()
    c.save()

    # Letter, landscape: closures on page 1, bottles on page 2, same sizes so codes stay readable.
    letter = OUT / f"best-bottles-{neck}-neck-matrix-letter.pdf"
    c = new_canvas(letter, (11 * 72, 8.5 * 72), neck)
    s = Sheet(c, 11 * 72, 8.5 * 72)
    s.page()
    rule = s.header(neck, fit, "1 of 2: applicators and closures")
    s.closures(parts, rule - 12, M + 34, letter_rows)
    s.footer(neck)
    c.showPage()
    s.page()
    rule = s.header(neck, fit, "2 of 2: bottles")
    s.band(neck, rule - 26)
    s.bottles(bodies, media, rule - 46, M + 34, rows=2)
    s.footer(neck)
    c.showPage()
    c.save()
    return [tabloid, letter]


def main() -> int:
    fonts()
    fit = json.loads((ROOT / "src/lib/help/fit-index.generated.json").read_text())
    media = json.loads((ROOT / "src/lib/help/fit-media.generated.json").read_text())["necks"]
    for old in OUT.glob("*.pdf") if OUT.exists() else []:
        old.unlink()
    for neck, neck_media in media.items():
        for path in build(neck, fit, neck_media):
            print(f"{neck}: {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
