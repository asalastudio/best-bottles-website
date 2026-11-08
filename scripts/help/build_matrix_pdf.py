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
    ("lotion-pump", "Lotion pumps", lambda c: c["type"] == "lotion-pump", "Treatment pumps for lotions and serums"),
    ("dropper", "Droppers", lambda c: c["type"] == "dropper", "Bulb droppers with collar cap"),
    ("vintage-bulb-sprayer", "Vintage bulb sprayers", lambda c: c["type"] == "vintage-bulb-sprayer", "Antique-style bulb atomisers"),
    ("tassel-bulb-sprayer", "Bulb sprayers with tassel", lambda c: c["type"] == "tassel-bulb-sprayer", "Bulb atomisers with tassel"),
    ("rod", "Glass rod applicators", lambda c: c["type"] == "cap" and c.get("style") == "Applicator", "Cap with a glass rod for dabbing"),
    ("short-ribbed-cap", "Short ribbed caps", lambda c: c["type"] == "cap" and c.get("style") == "Short ribbed", "Pour bottles: black or white"),
    ("short-cap", "Short caps", lambda c: c["type"] == "cap" and c.get("style") == "Short", "Pour bottles, or over a reducer"),
    ("tall-cap", "Tall caps", lambda c: c["type"] == "cap" and c.get("style") == "Tall", "Pour bottles, or over a reducer"),
    ("liner-cap", "Caps with liner", lambda c: c["type"] == "cap" and c.get("style") == "Liner", "Pour bottles"),
    ("faux-leather-cap", "Faux leather caps", lambda c: c["type"] == "faux-leather-cap", "Pour bottles, or over a reducer"),
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
    """Same rules as finishName in src/lib/help/fit-neck.ts, so the sheet and the builder name parts alike."""
    text = re.sub(r",?\s*Thread\s*size.*$|,?\s*Threadsize.*$|\.\s*Thread.*$", "", name, flags=re.I)
    def roll(m):
        return " dotted" if re.search("dots", m.group(0), re.I) else ""
    text = re.sub(r"Fine Mist Sprayer", "", text, flags=re.I)
    text = re.sub(r"(?:with dots|with dots or)?\s*cap (?:with dots )?or closure for rollon bottles", roll, text, flags=re.I)
    for pattern, repl in ((r"lid or closure for glass bottle", ""), (r"\s*colou?r\s+Cap or Closure for\b.*$", ""), (r"\s*Cap or Closure for\b.*$", ""), (r"short cap with liner", ""), (r"caps? for glass bottles", ""),
                          (r"collar (?:sprayer|Lotion or treatment pump)", "collar"), (r"Lotion or treatment pump", ""),
                          (r"Antique or Vintage style bulb sprayer", "bulb"), (r"rubber bulb dropper with", "bulb,"), (r"\.\s*Glass stem length is (\d+)\s*mm.*$", r", \1 mm stem"), (r"\.\s*Glass stem.*$", "")):
        text = re.sub(pattern, repl, text, flags=re.I)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([,.])", r"\1", text)
    text = re.sub(r"[,.\s]+$", "", text).strip()
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


GROUP_NOTES: dict = {}


def gather(neck: str, fit: dict, media: dict):
    GROUP_NOTES.clear()
    bodies = sorted((b for b in fit["bodies"] if b["neck"] == neck and b["interchangeable"] and b["listed"] and b["id"] in media["bodies"]),
                    key=lambda b: (b["capacityMl"] or 0, b["heightMm"] or 0))
    comps = fit["components"]
    parts = {key: [] for key, *_ in GROUPS}
    for cid in sorted({i for b in bodies for i in b["listed"]}):
        comp = comps[cid]
        group = next((key for key, _, test, _ in GROUPS if test(comp)), None)
        if group and cid in media["parts"]:
            m = media["parts"][cid]
            parts[group].append({"id": cid, "code": comp["itemCode"], "finish": finish(comp["name"]), "src": (m.get("swatch") or m)["src"]})
    if neck == "13-415":  # the caliper-confirmed liner (see fit-neck.ts)
        GROUP_NOTES.update({"short-cap": "Pour bottles: foam liner", "tall-cap": "Pour bottles: foam liner, 24 mm high"})
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
        """Item codes never overlap: shrink to fit, then wrap by character over up to three lines."""
        for size in (5.2, 4.8, 4.4):
            if self.width(code, size) <= max_w:
                return [code], size
        size = 4.6
        lines, line = [], ""
        for ch in code:
            if line and self.width(line + ch, size) > max_w:
                lines.append(line)
                line = ""
            line += ch
        return (lines + [line])[:3], size

    def card_size(self, items, cell, max_cols):
        cols = min(len(items), max_cols)
        lines = -(-len(items) // max_cols)
        return cols * cell + 22, 44 + lines * (cell + 34)

    def closures(self, parts, top, bottom, cell=58, start=0):
        """Group cards flowing left to right in rows; returns the index of the first group that did not fit."""
        c, text = self.c, self.text
        gap = 10
        meta = {key: (label, note) for key, label, _, note in GROUPS}
        keys = [key for key, *_ in GROUPS if parts.get(key)][start:]
        avail = self.W - 2 * M
        max_cols = int((avail - 22) // cell)
        y = top
        i = 0
        while i < len(keys):
            # Pack a row: as many cards as fit the width, then share the spare width between them.
            row, used = [], 0
            while i + len(row) < len(keys):
                w, h = self.card_size(parts[keys[i + len(row)]], cell, max_cols)
                if row and used + gap + w > avail:
                    break
                row.append((keys[i + len(row)], w, h))
                used += (gap if len(row) > 1 else 0) + w
            row_h = max(h for _, _, h in row)
            if y - row_h < bottom:
                return start + i
            spare = (avail - used) / len(row)
            x = M
            for key, w, _ in row:
                w += spare
                items = parts[key]
                label, note = meta[key]
                note = GROUP_NOTES.get(key, note)
                c.setFillColor(CARD)
                c.setStrokeColor(HAIR)
                c.setLineWidth(0.7)
                c.rect(x, y - row_h, w, row_h, stroke=1, fill=1)
                text(x + 11, y - 18, f"{label.upper()}  /  {len(items)}", 8.5, GOLD, 600, tracking=1.0)
                text(x + 11, y - 30, note, 7, MUTED, 400)
                per_line = min(len(items), int((w - 22) // cell))
                x0 = x + 11 + ((w - 22) - cell * per_line) / 2
                for j, part in enumerate(items):
                    line, col = divmod(j, per_line)
                    cx = x0 + col * cell
                    cy = y - 44 - (line + 1) * (cell + 34) + 34
                    c.setFillColor(STAGE)
                    c.rect(cx + 1.5, cy, cell - 3, cell, stroke=0, fill=1)
                    self.picture(part["src"], cx + 5, cy + 4, cell - 10, cell - 8, 260)
                    for k, name in enumerate(self.wrap(part["finish"], 6, 500, cell - 4)[:2]):
                        text(cx + cell / 2, cy - 9 - k * 7, name, 6, INK, 500, "center")
                    if part["code"]:
                        lines, size = self.code_lines(part["code"], cell - 4)
                        for k, code in enumerate(lines):
                            text(cx + cell / 2, cy - 25 - k * (size + 1.2), code, size, MUTED, 400, "center")
                x += w + gap
            y -= row_h + gap
            i += len(row)
        self.last_y = y
        return None

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
        # A finish with one or two bottles keeps them at a sensible size, centred, instead of filling the page.
        cell = min((self.W - 2 * M) / per_row, 170)
        x_start = M + ((self.W - 2 * M) - cell * per_row) / 2
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
                x = x_start + i * cell
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
    rows = -(-len(bodies) // 15)  # bottles per row stay legible

    def sheet(path: Path, size, cell: int, bottle_rows_one_page: int, bottle_rows_alone: int) -> Path:
        w, h = size
        c = new_canvas(path, size, neck)
        s = Sheet(c, w, h)
        pages = []
        # Try everything on one page: closures, then the finish band, then bottles.
        s.page()
        rule = s.header(neck, fit)
        bottles_h = 200 * bottle_rows_one_page
        # Smaller tiles before a second page: one sheet is the point of the tabloid.
        left = 0
        for size_try in (cell, cell - 6, cell - 10):
            if bottle_rows_one_page > 3:
                break
            c = new_canvas(path, size, neck)
            s = Sheet(c, w, h)
            s.page()
            rule = s.header(neck, fit)
            left = s.closures(parts, rule - 12, M + 34 + bottles_h + 48, size_try)
            if left is None:
                break
        if left is None:
            s.band(neck, s.last_y - 12)
            s.bottles(bodies, media, s.last_y - 32, M + 34, rows=bottle_rows_one_page)
            s.footer(neck)
            c.showPage()
            c.save()
            return path
        # Otherwise closures over as many pages as they need, then the bottles on their own page.
        c = new_canvas(path, size, neck)
        s = Sheet(c, w, h)
        start, n = 0, 1
        while start is not None:
            s.page()
            rule = s.header(neck, fit, f"applicators and closures{'' if n == 1 else ' (continued)'}")
            start = s.closures(parts, rule - 12, M + 34, cell, start)
            s.footer(neck)
            c.showPage()
            n += 1
        s.page()
        rule = s.header(neck, fit, "bottles")
        s.band(neck, rule - 26)
        s.bottles(bodies, media, rule - 46, M + 34, rows=bottle_rows_alone)
        s.footer(neck)
        c.showPage()
        c.save()
        return path

    tabloid = sheet(OUT / f"best-bottles-{neck}-neck-matrix-tabloid.pdf", (17 * 72, 11 * 72), 58, rows, max(rows, 1))
    letter = sheet(OUT / f"best-bottles-{neck}-neck-matrix-letter.pdf", (11 * 72, 8.5 * 72), 54, 99, max(2 if len(bodies) > 8 else 1, -(-len(bodies) // 8)))
    return [tabloid, letter]


def main() -> int:
    fonts()
    fit = json.loads((ROOT / "src/lib/help/fit-index.generated.json").read_text())
    media = json.loads((ROOT / "src/lib/help/fit-media.generated.json").read_text())["necks"]
    for old in OUT.glob("*.pdf") if OUT.exists() else []:
        old.unlink()
    for neck, neck_media in media.items():
        if not neck_media.get("parts"):
            continue  # no closure art yet: no sheet
        for path in build(neck, fit, neck_media):
            print(f"{neck}: {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
