"""Read the neck-thread sheets (the 23 September 2026 source PDFs) into parts and bottles for the catalogue.

Each sheet is one neck finish: cards of parts at the top (roll-on caps, sprayers, pumps ...), a rail
labelled "{neck} FINISH", and the bottles that share the neck underneath. This module finds every
picture on a sheet, names it from the text printed under it, files it under the card title above it,
and writes the picture to disk on a white ground. The catalogue then lays the pictures out in its own
page design (family_guides.py, "Fit systems").

Short labels on the sheets ("Gl M", "Sl S", "Ivy/gl") are internal; `customer_finish` turns them into
the finish words of the copy standard (COPY-STRATEGY.md §2.5, SYNTHESIS.md §3).

    python3 scripts/print/neck_sheets.py          # writes a contact sheet per neck for review
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data/register/source/neck-thread-2026-09-23"
SHEETS = {
    "13-415": SOURCE / "neck-thread-13-415-2026-09-23/13-415-neck-thread-matrix-17x11.pdf",
    "15-415": SOURCE / "neck-thread-15-415-2026-09-23/15-415-neck-thread-matrix-17x11.pdf",
    "17-415": SOURCE / "neck-thread-17-415-2026-09-23/17-415-neck-thread-matrix-17x11.pdf",
    "18-415": SOURCE / "neck-thread-18-415-2026-09-23/18-415-neck-thread-mini-catalog-2-page-17x11.pdf",
}

# Card title on the sheet -> (key, customer name). None leaves the card out of print.
GROUPS = {
    "Roll-on caps": ("roll-on-cap", "Roll-on caps"),
    "Roll-on outer caps": ("roll-on-cap", "Roll-on caps"),
    "Roller inserts": ("roller", "Roller balls"),
    "Fine-mist sprayers": ("sprayer", "Fine-mist sprayers"),
    "Short ribbed caps": ("ribbed", "Short ribbed caps"),
    "Short metal caps": ("short-lined", "Short lined caps"),  # never "metal caps" (COPY-STRATEGY.md §2.5)
    "Tall liner caps": ("tall-lined", "Tall lined caps"),
    "Liner caps": ("lined", "Lined caps"),
    "Black ribbed liner cap": None,  # owner-confirmed fit, but no item number yet (15-415 sheet)
    "Treatment pumps": ("treatment", "Treatment pumps"),
    "Faux-leather caps": ("faux", "Faux-leather caps"),
    "Travel / liner caps": ("lined", "Lined caps"),
    "Reducer insert": ("reducer", "Orifice reducer"),
    "Treatment / lotion pumps": ("lotion", "Lotion pumps"),
    "Vintage bulb sprayers": ("bulb", "Vintage-style bulb sprayers"),
    "Tassel bulb sprayers": ("tassel", "Vintage-style bulb sprayers with tassel"),
    "Droppers": ("dropper", "Droppers"),
}
SPECIAL = {
    "lt brn": "Light brown", "ivy/gl": "Ivory, gold collar", "ivy/sl": "Ivory, silver collar", "lav": "Lavender",
    "clear cap": "Clear overcap", "sl tall": "Silver, tall", "blk tall": "Black, tall", "blk short": "Black, short",
}
COLOURS = {"blk": "black", "gl": "gold", "sl": "silver", "cu": "copper"}
GLASS_WORDS = {"clear": "Clear", "amber": "Amber", "cobalt blue": "Cobalt Blue", "frosted": "Frosted", "frost": "Frosted", "swirl": "Swirl"}


def customer_finish(key: str, label: str) -> str:
    text = label.strip().rstrip("*").strip()
    low = text.lower()
    if key == "roller":
        return "Steel roller ball" if "metal" in low else "Plastic roller ball"
    if key == "reducer":
        return "Orifice reducer"
    if key == "dropper":
        return f"{text.capitalize()} collar"
    if low in SPECIAL:
        return SPECIAL[low]
    words = low.split()
    if words[0] in ("shiny", "matte"):
        return text.capitalize()
    colour = COLOURS.get(words[0], words[0])
    mod = words[1] if len(words) > 1 else ""
    if mod in ("m", "matt", "matte"):
        return f"Matte {colour}"
    if mod in ("s", "shiny"):
        return f"Shiny {colour}"
    if mod == "dot":
        return f"{colour.capitalize()} dotted"
    if colour == "copper":
        return "Matte copper"
    if key == "roll-on-cap" and colour == "black":
        return "Shiny black"  # every black roll-on cap on the sheets is shiny black
    if key in ("tall-lined", "lined") and colour in ("gold", "silver"):
        return f"Shiny {colour}"
    return colour.capitalize()


@dataclass
class Picture:
    path: Path
    label: str          # as printed on the sheet
    finish: str         # customer words
    note: str = ""      # e.g. "*" for parts seen only on assembled bottles
    pt_w: float = 0.0   # width of the picture on the sheet, in points: keeps the sheet's relative sizes


@dataclass
class Group:
    key: str
    title: str
    pictures: list[Picture] = field(default_factory=list)
    page: int = 1       # the sheet page it is printed on (18-415 has two)


@dataclass
class SheetBody:
    path: Path
    family: str         # as printed ("Tall Cylinder", "Circle")
    ml: float
    glass: str          # "Clear", "Clear and frosted", "Amber" ... or ""
    sku: str            # the example item number printed under the bottle, if any
    exception: str = "" # "Fixed sprayer" for the 30 ml Cylinder pair
    pt_w: float = 0.0
    page: int = 1
    mm: float | None = None  # the body height printed on the sheet


@dataclass
class Sheet:
    neck: str
    source: Path
    groups: list[Group] = field(default_factory=list)
    bodies: list[SheetBody] = field(default_factory=list)


def _spans(page) -> list[dict]:
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for s in line["spans"]:
                if s["text"].strip():
                    x0, y0, x1, y1 = s["bbox"]
                    out.append({"text": s["text"].strip(), "x0": x0, "y0": y0, "x1": x1, "y1": y1,
                                "cx": (x0 + x1) / 2, "size": s["size"]})
    return out


def _image(doc, xref: int) -> Image.Image:
    info = doc.extract_image(xref)
    img = Image.open(io.BytesIO(info["image"]))
    if info.get("smask"):
        mask = Image.open(io.BytesIO(doc.extract_image(info["smask"])["image"])).convert("L").resize(img.size)
        img = img.convert("RGB")
        img.putalpha(mask)
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        white = Image.new("RGBA", img.size, (255, 255, 255, 255))
        img = Image.alpha_composite(white, img)
    return img.convert("RGB")


def read_sheet(neck: str, out_dir: Path) -> Sheet:
    import pymupdf

    path = SHEETS[neck]
    doc = pymupdf.open(path)
    sheet = Sheet(neck, path)
    groups: dict[str, Group] = {}
    out_dir.mkdir(parents=True, exist_ok=True)
    for pno, page in enumerate(doc):
        spans = _spans(page)
        rail = next(s["y0"] for s in spans if re.fullmatch(rf"{re.escape(neck)} FINISH", s["text"]))
        titles = [s for s in spans if s["size"] >= 11 and "  /  " in s["text"] and 60 < s["y0"] < rail]
        for n, info in enumerate(page.get_image_info(xrefs=True)):
            x0, y0, x1, y1 = info["bbox"]
            cx = (x0 + x1) / 2
            name = out_dir / f"{neck}-p{pno + 1}-{n:02d}.png"
            if y1 < rail:  # a part
                # Some pictures are clipped to their card (the 13-415 roller inserts), so place each one by
                # its centre, and read its label from the label line of its card (84-129 pt under the title).
                cy = (y0 + y1) / 2
                above = [t for t in titles if t["y0"] < cy and t["x0"] <= cx + 5]
                if not above:
                    continue
                title = max(above, key=lambda t: (round(t["y0"] / 5), t["x0"]))
                mapped = GROUPS.get(title["text"].rsplit("  /  ", 1)[0].strip())
                if not mapped:
                    continue
                below = [s for s in spans if title["y0"] + 50 <= s["y0"] <= title["y0"] + 140 and s["size"] < 9
                         and abs(s["cx"] - cx) < 40]
                if not below:
                    continue
                label = min(below, key=lambda s: abs(s["cx"] - cx))["text"]
                key, customer = mapped
                _image(doc, info["xref"]).save(name)
                group = groups.setdefault(customer, Group(key, customer, page=pno + 1))
                group.pictures.append(Picture(name, label, customer_finish(key, label), "*" if label.endswith("*") else "", x1 - x0))
            elif y0 > rail:  # a bottle
                # The card title sits above the bottle (or just inside its picture's white margin).
                heads = [s for s in spans if s["size"] >= 9 and rail + 5 < s["y0"] < y0 + (y1 - y0) / 4
                         and -20 <= cx - s["x0"] <= 200]
                if not heads:
                    continue
                head = max(heads, key=lambda s: (round(s["y0"] / 5), -(cx - s["x0"])))
                card = [s for s in spans if head["y0"] <= s["y0"] < head["y0"] + 32 and abs(s["x0"] - head["x0"]) < 40]
                text = " ".join(s["text"] for s in card)
                under = sorted((s for s in spans if y1 <= s["y0"] <= y1 + 32 and abs(s["cx"] - cx) < 60), key=lambda s: s["y0"])
                sku = next((s["text"] for s in under if re.match(r"^(GB|LB)[A-Za-z0-9]+$", s["text"])), "")
                m = re.search(r"(\d+(?:\.\d+)?)\s*mL", text, re.I)
                if not m:
                    continue
                ml = float(m.group(1))
                if "EXCEPTION" in text:
                    colour = next((s["text"] for s in under), "")
                    body = SheetBody(name, "Cylinder", ml, "Clear", sku, exception=f"Fixed {colour.lower()} sprayer")
                else:
                    if head["text"].lower() in GLASS_WORDS:  # "CLEAR" over "9 mL Cylinder" (17-415)
                        rest = re.search(r"\d+(?:\.\d+)?\s*mL\s+([A-Za-z ]+)", text, re.I)
                        fam = rest.group(1).strip() if rest else ""
                    else:
                        fam = re.sub(r"\s*/?\s*\d+(?:\.\d+)?\s*mL.*$", "", head["text"], flags=re.I).strip()
                    glasses = [v for k, v in GLASS_WORDS.items() if re.search(rf"\b{k}\b", text, re.I)]
                    glasses = list(dict.fromkeys(glasses))
                    glass = ", ".join([glasses[0]] + [g.lower() for g in glasses[1:]]) if glasses else ""
                    body = SheetBody(name, fam.title() if fam.isupper() else fam, ml, glass, sku)
                body.pt_w, body.page = x1 - x0, pno + 1
                height = next((re.search(r"(\d+(?:\.\d+)?) mm body", s["text"]) for s in under if re.search(r"\d+(?:\.\d+)? mm body", s["text"])), None)
                body.mm = float(height.group(1)) if height else None
                _image(doc, info["xref"]).save(name)
                sheet.bodies.append(body)
    sheet.groups = list(groups.values())
    return sheet


def contact_sheet(sheet: Sheet, path: Path) -> None:
    from PIL import ImageDraw

    rows = [(g.title, [(p.path, p.finish + p.note) for p in g.pictures]) for g in sheet.groups]
    rows.append(("Bottles", [(b.path, f"{b.family} {b.ml:g} {b.glass} {b.exception}".strip()) for b in sheet.bodies]))
    tile, pad = 150, 8
    width = max(len(items) for _, items in rows) * (tile + pad) + pad
    canvas = Image.new("RGB", (max(width, 800), len(rows) * (tile + 60)), (240, 240, 240))
    draw = ImageDraw.Draw(canvas)
    for r, (title, items) in enumerate(rows):
        y = r * (tile + 60)
        draw.text((pad, y + 4), title, fill=(0, 0, 0))
        for c, (img_path, caption) in enumerate(items):
            img = Image.open(img_path)
            img.thumbnail((tile, tile))
            x = pad + c * (tile + pad)
            canvas.paste(img, (x, y + 20))
            draw.text((x, y + 24 + tile), caption[:24], fill=(0, 0, 0))
    canvas.save(path)


if __name__ == "__main__":
    out = ROOT / "out/print/work/neck"
    for neck in SHEETS:
        s = read_sheet(neck, out)
        contact_sheet(s, out / f"contact-{neck}.png")
        print(neck, [(g.title, len(g.pictures)) for g in s.groups], len(s.bodies), "bottles")
        for b in s.bodies:
            print("   ", b.family, b.ml, b.glass, b.sku, b.exception)
