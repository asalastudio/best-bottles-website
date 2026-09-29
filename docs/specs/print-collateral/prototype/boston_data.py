"""Boston Round family data for the print proof, built from the August 2026 production export."""
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
EXPORT = ROOT / "docs/reviews/audit-2026-08-06/convex-products-for-crosscheck.json"

GLASS_ORDER = ["Clear", "Amber", "Cobalt Blue"]
FITMENT_ORDER = ["Dropper", "Steel roller ball", "Plastic roller ball", "Short screw cap"]
FINISH_ORDER = [
    "Black bulb, black collar", "Black bulb, shiny gold collar", "Black bulb, shiny silver collar",
    "White bulb, white collar", "White bulb, shiny gold collar", "White bulb, shiny silver collar",
    "Matte Black cap", "Matte Gold cap", "Matte Silver cap",
    "Shiny Black cap", "Shiny Gold cap", "Shiny Silver cap", "Black cap",
]


def size_label(capacity: str) -> str:
    ml = float(re.match(r"([\d.]+)", capacity).group(1))
    return f"{ml:g} ml"


def fitment(row: dict) -> tuple[str, str]:
    sku, name = row["websiteSku"], row["itemName"].lower()
    if re.search(r"Dr(o)?p", sku):
        # Collar wording follows the 20-400 and 18-400 component inventories (23 Sep 2026):
        # a plain dropper's collar matches its bulb; trimmed ones are shiny gold or shiny silver.
        colour = "White" if "Wht" in sku else "Black"
        if re.search(r"GlTrim|ShnGl", sku):
            return "Dropper", f"{colour} bulb, shiny gold collar"
        if re.search(r"SlTrim|ShnSl", sku):
            return "Dropper", f"{colour} bulb, shiny silver collar"
        return "Dropper", f"{colour} bulb, {colour.lower()} collar"
    if "CapSht" in sku:
        return "Short screw cap", "Black cap"
    kind = "Steel roller ball" if re.search(r"Mtl", sku) else "Plastic roller ball"
    m = re.search(r"(matte|shiny)? ?(black|gold|silver) cap", name)
    finish = (m.group(1) or "shiny").title() + " " + m.group(2).title() if m else row["capColor"]
    return kind, f"{finish} cap"


def load() -> dict:
    rows = [r for r in json.loads(EXPORT.read_text()) if r["family"] == "Boston Round"]
    matrix: dict = defaultdict(lambda: defaultdict(dict))
    necks, cases, collisions = {}, {}, []
    for r in rows:
        size = size_label(r["capacity"])
        key = fitment(r)
        cell = matrix[size][key]
        if r["color"] in cell:
            collisions.append((size, key, r["color"], cell[r["color"]], r["websiteSku"]))
            continue
        cell[r["color"]] = r["websiteSku"]
        necks[size] = r["neckThreadSize"]
        if r["caseQuantity"]:
            cases.setdefault(size, set()).add(r["caseQuantity"])
    sizes = sorted(matrix, key=lambda s: float(s.split()[0]))
    table = []
    for size in sizes:
        keys = sorted(matrix[size], key=lambda k: (FITMENT_ORDER.index(k[0]), FINISH_ORDER.index(k[1])))
        table.append({
            "size": size,
            "neck": necks[size],
            "case": sorted(cases[size]),
            "rows": [{"fitment": k[0], "finish": k[1], "skus": dict(matrix[size][k])} for k in keys],
        })
    return {"count": len(rows), "table": table, "collisions": collisions}


if __name__ == "__main__":
    data = load()
    print("rows", data["count"], "collisions", data["collisions"])
    for block in data["table"]:
        print(block["size"], block["neck"], block["case"], len(block["rows"]))
        for row in block["rows"]:
            print("   ", row["fitment"], "|", row["finish"], "|", row["skus"])
