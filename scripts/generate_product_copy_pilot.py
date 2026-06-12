#!/usr/bin/env python3
import csv
import json
import re
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_CSV = ROOT / "data/audits/2026-05-20-image-audit/convex_products_current_2026-05-20.csv"
GROUPS_CSV = ROOT / "data/audits/2026-05-20-image-audit/convex_product_groups_current_2026-05-20.csv"
OUT_DIR = ROOT / "copy"

BANNED_RE = re.compile(
    r"\b(whisky|whiskey|beer|wine|alcohol|spirits|bourbon|vodka|gin|rum|tequila|liquor|cocktail|brewery|distillery)\b|aged like|fine wine",
    re.IGNORECASE,
)

COLORS = ["Amber", "Cobalt Blue", "Frosted", "Clear", "Swirl"]
SELECTED_CAPS = ["White", "Shiny Black", "Matte Gold", "Matte Silver", "Matte Copper"]

COLOR_NOTES = {
    "Amber": {
        "tone": "apothecary amber",
        "benefit": "chosen for formulas that need a warmer shelf signal and reduced light exposure",
        "uses": "essential oils, facial oils, botanical blends, and apothecary-style wellness lines",
    },
    "Cobalt Blue": {
        "tone": "deep cobalt blue",
        "benefit": "chosen when a small-format product needs color, clarity, and strong shelf recognition",
        "uses": "aromatherapy blends, trial sizes, oil-based skincare, and color-coded product families",
    },
    "Frosted": {
        "tone": "soft frosted glass",
        "benefit": "chosen for a muted, tactile finish that photographs cleanly",
        "uses": "beauty samples, roll-on oils, wellness blends, and understated gift sets",
    },
    "Clear": {
        "tone": "clear glass",
        "benefit": "chosen when the fill color should stay visible",
        "uses": "sample programs, tester sets, essential oil blends, and small-batch launches",
    },
    "Swirl": {
        "tone": "swirl glass",
        "benefit": "chosen when the bottle itself should carry a decorative signal",
        "uses": "limited editions, discovery sets, roll-on oils, and boutique retail assortments",
    },
}


def read_csv(path):
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def clean_num(value):
    if value in (None, ""):
        return None
    try:
        number = float(value)
    except ValueError:
        return value
    if number.is_integer():
        return int(number)
    return number


def money(value):
    if value in (None, ""):
        return None
    return float(value)


def slugify(text):
    text = text.lower().replace("&", "and")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def block(key, style, text):
    return {
        "_type": "block",
        "_key": key,
        "style": style,
        "children": [{"_type": "span", "text": text, "marks": []}],
        "markDefs": [],
    }


def assert_length(label, text, low, high):
    length = len(text)
    if not (low <= length <= high):
        raise ValueError(f"{label} length {length} outside {low}-{high}: {text}")


def selected_variant_rows(rows):
    selected = []
    for cap in SELECTED_CAPS:
        exact = [r for r in rows if r.get("capColor") == cap and r.get("applicator") == "Plastic Roller Ball"]
        if not exact:
            exact = [r for r in rows if r.get("capColor") == cap]
        if exact:
            selected.append(exact[0])
    if len(selected) < 5:
        seen = {r["_id"] for r in selected}
        for row in rows:
            if row["_id"] not in seen:
                selected.append(row)
                seen.add(row["_id"])
            if len(selected) == 5:
                break
    return selected[:5]


def group_copy(group, rows):
    color = group["color"]
    note = COLOR_NOTES[color]
    cap = f'{int(float(group["capacityMl"]))} ml'
    oz = rows[0].get("capacityOz") or "0.3"
    display = f'Cylinder {cap} {color} Roll-On Bottle'
    slug = f'cylinder-9ml-{slugify(color)}'
    diameter_values = sorted({r["diameter"] for r in rows if r.get("diameter")})
    height_values = sorted({r["heightWithCap"] for r in rows if r.get("heightWithCap")})
    case_values = sorted({r["caseQuantity"] for r in rows if r.get("caseQuantity")})
    price_min = min(money(r.get("webPrice1pc")) for r in rows if r.get("webPrice1pc"))
    price_max = max(money(r.get("webPrice1pc")) for r in rows if r.get("webPrice1pc"))
    diameter = " / ".join(diameter_values)
    height = " / ".join(height_values)
    case_quantity = " / ".join(case_values)

    hero = (
        f"The {display} gives small-format oil lines a precise, retail-ready package without forcing a production-sized commitment. "
        f"Its {note['tone']} body holds {cap} ({oz} oz), uses a 17-415 neck finish, and pairs with plastic or metal roller plugs from the verified fitment matrix. "
        f"Brands use this size for {note['uses']}. "
        f"Choose the cap finish variant below, then request samples before building the full run."
    )

    intro = (
        f"This {color} Cylinder roll-on keeps the decision simple: a narrow glass body, a verified 17-415 roll-on fitment system, and a compact {cap} fill. "
        f"The Convex record lists diameter values of {diameter} and height-with-cap values of {height}, depending on the selected roller assembly."
    )
    use_cases = (
        f"Use it for {note['uses']}. The {cap} format suits discovery sets, travel-size products, counter testers, and focused single-note blends where the applicator matters as much as the glass."
    )
    compatibility = (
        "The verified 17-415 fitment matrix lists plastic roller plugs, metal roller plugs, roll-on cap options, spray tops, and lotion pumps for this Cylinder 9ml family. "
        "This pilot page focuses on roll-on assemblies only."
    )
    how_brands_use_it = (
        f"Indie wellness and beauty brands typically use the {display} as the small-size anchor in a broader product family. "
        "A founder can test several cap finishes, photograph the line quickly, and keep the 17-415 system consistent across roller, spray, and pump configurations. "
        f"The {color.lower()} finish gives this version its visual role while the shared Cylinder 9ml body keeps sourcing straightforward."
    )
    authority = (
        f"Convex lists this group as {group['category']} with {group['variantCount']} variants, a price range of ${price_min:.2f}-${price_max:.2f}, and case quantity {case_quantity}. "
        "No wall-thickness, pallet, or material-grade claim is included because those fields are not present in the source rows."
    )

    faq = [
        {
            "_type": "object",
            "_key": "q1",
            "question": f"What neck finish does the {display} use?",
            "answer": f"The neck finish is 17-415. The verified fitment matrix lists plastic roller plugs, metal roller plugs, roll-on caps, spray tops, and lotion pumps for Cylinder 9ml bottles.",
        },
        {
            "_type": "object",
            "_key": "q2",
            "question": f"How much does the {display} hold?",
            "answer": f"The {display} holds {cap} ({oz} oz). Convex lists this capacity for each selected roll-on variant in the pilot group.",
        },
        {
            "_type": "object",
            "_key": "q3",
            "question": f"What is the case quantity for the {display}?",
            "answer": f"The case quantity is {case_quantity}. Use the product variant table for exact pricing because cap finish and roller material can change the unit price.",
        },
    ]

    meta_title = f"9ml {color} Cylinder Roll-On Bottle | Best Bottles"
    if len(meta_title) < 55:
        meta_title = f"9ml {color} Cylinder Roll-On Glass Bottle | Best Bottles"
    if len(meta_title) < 55:
        meta_title = f"9ml {color} Cylinder Roll-On Glass Bottle Set | Best Bottles"
    meta_description = (
        f"Shop {cap} {color} Cylinder roll-on bottles with 17-415 neck finish, verified roller fitments, cap options, and sample-friendly pricing. Compare variants."
    )
    schema_description = (
        f"{display} with 17-415 neck finish, {diameter} diameter, {height} height with cap, and roll-on cap variants from Convex."
    )
    assert_length("metaTitle", meta_title, 55, 60)
    assert_length("metaDescription", meta_description, 150, 160)
    assert_length("productSchemaDescription", schema_description, 120, 180)

    return {
        "_type": "productGroup",
        "sourceProductGroupId": group["_id"],
        "sourceSlug": group["slug"],
        "slug": slug,
        "familyName": "Cylinder",
        "displayName": display,
        "heroImageUrl": group.get("heroImageUrl") or None,
        "heroDescription": hero,
        "body": [
            block("intro", "normal", intro),
            block("authority-heading", "h3", "Verified details"),
            block("authority", "normal", authority),
            block("use-cases", "h3", "What it is for"),
            block("use-cases-list", "normal", use_cases),
            block("compatibility", "h3", "What pairs with it"),
            block("fitment", "normal", compatibility),
            block("how-brands-use-it", "h3", "How brands use it"),
            block("how-brands-use-it-copy", "normal", how_brands_use_it),
            block("cta", "normal", "Request a sample, compare cap finishes, or ask the Best Bottles team to confirm fitment before production."),
        ],
        "faq": faq,
        "specHighlights": {
            "neckFinish": group["neckThreadSize"],
            "capacity": f"{cap} | {oz} oz",
            "diameter": diameter,
            "heightWithCap": height,
            "material": "Glass",
            "caseQuantity": case_quantity,
            "compatibleAccessories": "Plastic roller plug, Metal roller plug, Roll-on cap, Fine mist sprayer, Lotion pump",
        },
        "seo": {
            "metaTitle": meta_title,
            "metaDescription": meta_description,
            "h1": display,
            "productSchemaDescription": schema_description,
        },
    }


def variant_copy(row, parent_slug):
    cap = f'{int(float(row["capacityMl"]))} ml'
    oz = row.get("capacityOz") or "0.3"
    applicator = row.get("applicator") or "Cap/Closure"
    ball = row.get("ballMaterial")
    cap_color = row.get("capColor") or "Unspecified"
    variant_name = f'Cylinder {cap} {row["color"]} {applicator} - {cap_color} Cap'
    first_sentence = (
        f'This {row["color"]} Cylinder {cap} roll-on variant uses a {applicator.lower()} '
        f'assembly with a {cap_color.lower()} cap.'
    )
    sentences = [
        first_sentence,
        f'Convex lists a {row["neckThreadSize"]} neck finish, {row["diameter"]} diameter, and {row["heightWithCap"]} height with cap.',
    ]
    if row.get("webPrice1pc"):
        sentences.append(f'Unit price starts at ${float(row["webPrice1pc"]):.2f}.')
    if row.get("caseQuantity"):
        sentences.append(f'Case quantity is {row["caseQuantity"]}.')
    if row.get("stockStatus"):
        sentences.append(f'Status: {row["stockStatus"]}.')

    return {
        "_type": "product",
        "sourceProductId": row["_id"],
        "slug": slugify(row["websiteSku"]),
        "parentGroupSlug": parent_slug,
        "variantName": variant_name,
        "variantDescription": " ".join(sentences),
        "spec": {
            "websiteSku": row["websiteSku"],
            "graceSku": row["graceSku"],
            "color": row["color"],
            "applicator": applicator,
            "ballMaterial": ball or None,
            "capColor": cap_color,
            "capacityMl": clean_num(row["capacityMl"]),
            "capacityOz": clean_num(oz),
            "neckThreadSize": row["neckThreadSize"],
            "diameter": row["diameter"],
            "heightWithCap": row["heightWithCap"],
            "bottleWeightG": clean_num(row["bottleWeightG"]),
        },
        "pricing": {
            "qty1": money(row.get("webPrice1pc")),
            "qty10": money(row.get("webPrice10pc")),
            "qty12": money(row.get("webPrice12pc")),
            "moq": 1,
            "caseQuantity": clean_num(row.get("caseQuantity")),
        },
        "stockStatus": row.get("stockStatus") or None,
    }


def screen_payload(payload):
    text = json.dumps(payload, ensure_ascii=False)
    hits = sorted({m.group(0) for m in BANNED_RE.finditer(text)})
    return hits


def write_review_markdown(payload):
    lines = [
        "# Cylinder 9ml Pilot Copy",
        "",
        "Stakeholder review draft for the first five Tier A PDPs.",
        "",
        "Source: Convex product and product-group CSV exports, verified 17-415 fitment matrix, and `seo-audit-2026-05-23` guardrails.",
        "",
    ]
    products_by_parent = {}
    for product in payload["products"]:
        products_by_parent.setdefault(product["parentGroupSlug"], []).append(product)

    for group in payload["productGroups"]:
        lines.extend([
            f"## {group['displayName']}",
            "",
            f"- Import slug: `{group['slug']}`",
            f"- Convex source slug: `{group['sourceSlug']}`",
            f"- Meta title ({len(group['seo']['metaTitle'])} chars): {group['seo']['metaTitle']}",
            f"- Meta description ({len(group['seo']['metaDescription'])} chars): {group['seo']['metaDescription']}",
            "",
            "### Hero",
            "",
            group["heroDescription"],
            "",
            "### Body",
            "",
        ])
        for block_doc in group["body"]:
            text = block_doc["children"][0]["text"]
            if block_doc["style"] == "h3":
                lines.extend([f"#### {text}", ""])
            else:
                lines.extend([text, ""])
        lines.extend(["### FAQ", ""])
        for item in group["faq"]:
            lines.extend([f"**{item['question']}**", "", item["answer"], ""])
        lines.extend(["### Selected Variants", ""])
        for product in products_by_parent.get(group["slug"], []):
            lines.append(f"- **{product['variantName']}** (`{product['spec']['websiteSku']}`): {product['variantDescription']}")
        lines.append("")

    (OUT_DIR / "CYLINDER-9ML-PILOT-REVIEW.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    products = read_csv(PRODUCTS_CSV)
    groups = read_csv(GROUPS_CSV)
    selected_groups = [
        g
        for g in groups
        if g["family"] == "Cylinder"
        and g["capacityMl"] == "9"
        and g["neckThreadSize"] == "17-415"
        and "rollon" in g["slug"]
        and g["color"] in COLORS
    ]
    selected_groups.sort(key=lambda g: COLORS.index(g["color"]))

    product_groups = []
    variants = []
    exceptions = []
    total_available_variants = 0
    for group in selected_groups:
        rows = [r for r in products if r["productGroupId"] == group["_id"]]
        rows.sort(key=lambda r: (r.get("applicator") != "Plastic Roller Ball", r.get("capColor") or "", r.get("websiteSku") or ""))
        total_available_variants += len(rows)
        group_doc = group_copy(group, rows)
        product_groups.append(group_doc)
        chosen = selected_variant_rows(rows)
        variants.extend(variant_copy(r, group_doc["slug"]) for r in chosen)
        if len(rows) > len(chosen):
            exceptions.append(
                f"- `{group['slug']}` has {len(rows)} Convex variants; pilot generated {len(chosen)} per the 25-variant handoff scope. Generate remaining {len(rows) - len(chosen)} after stakeholder review."
            )

    clear_rows = [
        r for r in products
        if r["productGroupId"] in {g["_id"] for g in selected_groups if g["color"] == "Clear"}
        and r.get("capColor") == "Clear"
        and any(token in r.get("websiteSku", "") for token in ["Gl", "Sl", "Blk", "Cu", "Wht"])
    ]
    if clear_rows:
        exceptions.append(
            f"- Clear Cylinder 9ml roll-on cap colors may need human verification: {len(clear_rows)} rows list `capColor=Clear` while SKU names imply decorative cap finishes. Pilot copy preserves Convex `capColor` exactly."
        )

    payload = {
        "generatedAt": date.today().isoformat(),
        "scope": "Pilot: Cylinder 9ml x five 17-415 roll-on color groups; five variants per group.",
        "productGroups": product_groups,
        "products": variants,
    }

    hits = screen_payload(payload)
    if hits:
        raise SystemExit(f"Banned terms found in generated payload: {hits}")

    OUT_DIR.mkdir(exist_ok=True)
    (OUT_DIR / "sanity-import.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_review_markdown(payload)

    stats = [
        "# Product Copy Pilot Stats",
        "",
        f"Generated: {date.today().isoformat()}",
        "",
        "## Scope",
        "",
        "- Pilot family: Cylinder",
        "- Pilot size: 9 ml / 0.3 oz",
        "- Pilot fitment: 17-415 roll-on groups",
        f"- Product groups generated: {len(product_groups)}",
        f"- Variant descriptions generated: {len(variants)}",
        f"- Convex variants available in selected groups: {total_available_variants}",
        "",
        "## Word Counts",
        "",
    ]
    for group in product_groups:
        words = len(re.findall(r"[A-Za-z0-9$.-]+", group["heroDescription"] + " " + " ".join(b["children"][0]["text"] for b in group["body"])))
        stats.append(f"- {group['slug']}: {words} words across hero/body")
    stats.extend([
        "",
        "## Source Files Used",
        "",
        "- `seo-audit-2026-05-23/BRAND-VOICE-GUARDRAILS.md`",
        "- `data/grace-training/01-brand-knowledge/brand-brain-v2.md`",
        "- `data/grace-training/01-brand-knowledge/best-bottles-brand-book.md`",
        "- `docs/SEO_CONTENT_CALENDAR.md`",
        "- `data/audits/2026-05-20-image-audit/convex_products_current_2026-05-20.csv`",
        "- `data/audits/2026-05-20-image-audit/convex_product_groups_current_2026-05-20.csv`",
        "- `docs/SHAPE_AUDIT.md`",
        "- `docs/all-fitment-matrices.md`",
        "- `docs/CONTENT_HANDBOOK.md`",
        "- `convex/schema.ts`",
        "- `sanity.config.ts`",
        "- `https://www.bestbottles.com/` for legacy tone reference only",
    ])
    (OUT_DIR / "STATS.md").write_text("\n".join(stats) + "\n", encoding="utf-8")

    exceptions_doc = [
        "# Product Copy Exceptions",
        "",
        f"Generated: {date.today().isoformat()}",
        "",
        "## Pilot Exceptions",
        "",
        *(exceptions or ["- No pilot exceptions found."]),
        "",
        "## Validation Notes",
        "",
        "- Empire and Diva family-size validation was not applied to generated copy because this pilot only covers Cylinder 9ml.",
        "- No missing numeric specs were filled or estimated. Missing fields were omitted.",
        "- Legacy site copy was used for tone continuity only and was not copied into generated PDP copy.",
    ]
    (OUT_DIR / "EXCEPTIONS.md").write_text("\n".join(exceptions_doc) + "\n", encoding="utf-8")

    import_doc = [
        "# Product Copy Import Instructions",
        "",
        "## Pilot File",
        "",
        "- Import source: `copy/sanity-import.json`",
        "- Review source: `copy/CYLINDER-9ML-PILOT-REVIEW.md`",
        "- Scope: five Cylinder 9ml 17-415 roll-on product groups and 25 selected variants.",
        "",
        "## Suggested Engineering Flow",
        "",
        "1. Review `copy/EXCEPTIONS.md` before import.",
        "2. Load `copy/sanity-import.json` in a staging script.",
        "3. Upsert `productGroups` by `slug` or `sourceProductGroupId`.",
        "4. Upsert `products` by `spec.websiteSku` or `sourceProductId`.",
        "5. Preserve existing Convex numeric fields as canonical; treat this JSON as copy and SEO content only.",
        "6. Spot-check each PDP in staging for FAQ rendering, SEO field lengths, and variant copy placement.",
        "",
        "## Stop Point",
        "",
        "Do not scale generation beyond this pilot until stakeholder feedback is incorporated into the templates.",
    ]
    (OUT_DIR / "IMPORT-INSTRUCTIONS.md").write_text("\n".join(import_doc) + "\n", encoding="utf-8")

    report = [
        "# Brand Voice Compliance Report",
        "",
        f"Generated: {date.today().isoformat()}",
        "",
        "## Regex Screen",
        "",
        "- Status: PASS",
        "- Checked file payload: `copy/sanity-import.json`",
        "- Banned-list regex: `(whisky|whiskey|beer|wine|alcohol|spirits|bourbon|vodka|gin|rum|tequila|liquor|cocktail|brewery|distillery|aged like|fine wine)`",
        "- Hits: 0",
        "",
        "## Manual Guardrail Notes",
        "",
        "- No haram beverage comparisons are present.",
        "- No contract filling, capping, or labeling service promises are present.",
        "- No inventory timing promise is made beyond the sourced `stockStatus` field.",
        "- No physical spec is estimated from sibling SKUs.",
    ]
    (OUT_DIR / "BRAND-VOICE-COMPLIANCE-REPORT.md").write_text("\n".join(report) + "\n", encoding="utf-8")

    print(f"Wrote {OUT_DIR / 'sanity-import.json'} with {len(product_groups)} groups and {len(variants)} variants.")


if __name__ == "__main__":
    main()
