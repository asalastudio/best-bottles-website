#!/usr/bin/env node
/**
 * Duplicate website SKUs, grouped by cause so they can be reviewed as a handful
 * of decisions instead of 153 rows.
 *
 * This script MOVES NOTHING. Every duplicate was checked against the live
 * deployment and in all 153 cases BOTH documents carry a Shopify variant and
 * read "In Stock" — they are two sellable products, not a live record and a
 * skeleton. So there is no structural property that says which one is right,
 * and picking one automatically could unpublish something Nemat is selling.
 * What the script does is cluster them by cause and emit a review pack.
 *
 *   node scripts/paperdoll/resolve-duplicates.mjs            # summary
 *   node scripts/paperdoll/resolve-duplicates.mjs --pack     # write the review pack
 *
 * env: NEXT_PUBLIC_CONVEX_URL
 *
 * The clusters, and the evidence each rests on:
 *
 *   A  clear/frosted twin — the SKU appears in both the clear and the frosted
 *      group of one family, and the two documents are DIFFERENT PRODUCTS. For
 *      GBDivaFrst46AnSpBlk: GB-DVA-FRS-46ML-T-12 (frosted, vintage bulb sprayer)
 *      and GB-DVA-CLR-46ML-T-12 (clear, no applicator). The frosted one owns the
 *      SKU; the clear one is wearing it. Its own correct website SKU is not
 *      derivable — GBDiva46AnSpBlk is already taken by GB-DVA-CLR-46ML-ASP-BLK,
 *      a different clear product. Decision needed: what website SKU does the
 *      clear T-NN record actually have?
 *
 *   B  a component listed under several closure groups — a vintage bulb sprayer
 *      appearing in both fine-mist-sprayer-18-415 and vintage-bulb-sprayer-18-415.
 *      A component belongs to the group that names what it is.
 *      Action: HELD. Which group names it is a catalogue decision, so this rule
 *      reports and never moves.
 *
 *   C  family group + its own closure sub-group — bell-10ml-clear-13-415 and
 *      bell-10ml-clear-13-415-rollon both claim one SKU. The closure-specific
 *      group looks like the more specific truth, but both documents are sellable,
 *      so which one survives is still a catalogue decision.
 *
 *   D  re-import — both documents sit in the same group with the same applicator
 *      and cap colour, and the grace SKUs differ only by a trailing -NN that the
 *      second import appended. Action: HELD. Choosing which document survives
 *      needs the Shopify variant and order history, which this script cannot see.
 *
 * Nothing here writes. The output is a review pack.
 */
import { readFileSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const wantPack = argv.includes("--pack");
const onlyRule = argv.includes("--rule") ? argv[argv.indexOf("--rule") + 1]?.toUpperCase() : null;

// nothing is applied: both documents of every duplicate are live and sellable
const MOVES = new Set();
const HOLDS = new Set(["A", "B", "C", "D", "E"]);

function classify(sku, docs, groups) {
    const gids = new Set(docs.map((d) => d.productGroupId));
    const gs = docs.map((d) => groups.get(d.productGroupId) ?? {});
    const slugs = [...new Set(gs.map((g) => g.slug).filter(Boolean))].sort();
    const colors = new Set(gs.map((g) => (g.color ?? "").toLowerCase()));
    const frosted = /Frst|Frost/.test(sku);

    if (gids.size === 1) {
        const graces = docs.map((d) => d.graceSku);
        const stems = new Set(graces.map((g) => (g ?? "").replace(/-\d{2}$/, "")));
        return { rule: "D", detail: stems.size === 1
            ? `re-import: grace SKUs ${graces.join(" / ")} differ only by a trailing suffix`
            : `two documents in one group: ${graces.join(" / ")}` };
    }
    if (colors.has("clear") && colors.has("frosted") && colors.size === 2) {
        const keep = gs.find((g) => (g.color ?? "").toLowerCase() === (frosted ? "frosted" : "clear"));
        const drop = gs.find((g) => g.slug !== keep?.slug);
        return { rule: "A", keepSlug: keep?.slug, dropSlug: drop?.slug,
                 detail: `SKU says ${frosted ? "frosted" : "clear"}; belongs in ${keep?.slug}` };
    }
    if (docs.every((d) => d.category === "Component" || d.category === "Cap/Closure")) {
        return { rule: "B", detail: `component listed under ${slugs.join(" + ")}` };
    }
    if (slugs.length === 2 && (slugs[1].startsWith(slugs[0] + "-") || slugs[0].startsWith(slugs[1] + "-"))) {
        const sub = slugs[1].startsWith(slugs[0] + "-") ? slugs[1] : slugs[0];
        const parent = sub === slugs[1] ? slugs[0] : slugs[1];
        return { rule: "C", keepSlug: sub, dropSlug: parent, detail: `${parent} is the family group; ${sub} is the specific one` };
    }
    return { rule: "E", detail: `groups ${slugs.join(" + ")} — needs a look at the product` };
}

async function main() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) { console.error("NEXT_PUBLIC_CONVEX_URL is not set"); process.exit(1); }
    console.log(`REVIEW PACK → ${url}`);

    const snapshot = JSON.parse(readFileSync("data/paper-doll/convex-snapshot.json", "utf8"));
    const groups = new Map(snapshot.groups.map((g) => [g._id, g]));
    const bySku = new Map();
    for (const p of snapshot.products) {
        const sku = (p.websiteSku ?? "").trim();
        if (!sku) continue;
        bySku.set(sku, [...(bySku.get(sku) ?? []), p]);
    }

    const plan = [];
    for (const [sku, docs] of [...bySku].sort()) {
        if (docs.length < 2) continue;
        plan.push({ sku, docs, ...classify(sku, docs, groups) });
    }

    const byRule = new Map();
    for (const row of plan) byRule.set(row.rule, [...(byRule.get(row.rule) ?? []), row]);
    console.log(`\n${plan.length} duplicated website SKUs:\n`);
    for (const rule of ["A", "B", "C", "D", "E"]) {
        const rows = byRule.get(rule) ?? [];
        const disposition = MOVES.has(rule) ? "moves a document" : "HELD — reported only";
        console.log(`  rule ${rule}: ${String(rows.length).padStart(3)}  ${disposition}`);
    }

    console.log(`\nAll ${plan.length} are HELD: in every case both documents carry a Shopify variant and read`);
    console.log("In Stock, so neither can be retired without a catalogue decision.");

    if (!wantPack) {
        console.log("\nre-run with --pack to write docs/data-audit/duplicate-sku-review-pack.md");
        return;
    }
    const L = ["# Duplicate website SKUs — review pack", "",
        `${plan.length} website SKUs resolve to two Convex product documents. In every case **both documents are`,
        "live in Shopify and in stock**, so none can be retired automatically. They are grouped here by cause:",
        "each group is one decision, not one decision per row.", "",
        "| cluster | SKUs | the decision |", "|---|---:|---|",
        `| A | ${(byRule.get("A") ?? []).length} | a clear product is wearing its frosted sibling's website SKU. What is the clear record's own SKU? |`,
        `| B | ${(byRule.get("B") ?? []).length} | one component is listed under two closure groups. Which group names it? |`,
        `| C | ${(byRule.get("C") ?? []).length} | a family group and its closure sub-group both claim the SKU. Which owns it? |`,
        `| D | ${(byRule.get("D") ?? []).length} | the same product imported twice; the second grace SKU gained a -NN suffix. Which survives? |`,
        `| E | ${(byRule.get("E") ?? []).length} | individual review |`, ""];
    for (const rule of ["A", "B", "C", "D", "E"]) {
        const rows = byRule.get(rule) ?? [];
        if (!rows.length) continue;
        L.push(`## Cluster ${rule} — ${rows.length} SKUs`, "");
        L.push("| websiteSku | documents | detail |", "|---|---|---|");
        for (const row of rows) {
            const docs = row.docs.map((d) => `\`${d.graceSku}\` (${(groups.get(d.productGroupId) ?? {}).slug ?? "?"})`).join("<br>");
            L.push(`| \`${row.sku}\` | ${docs} | ${row.detail} |`);
        }
        L.push("");
    }
    writeFileSync("docs/data-audit/duplicate-sku-review-pack.md", L.join("\n") + "\n");
    console.log("\nwrote docs/data-audit/duplicate-sku-review-pack.md");
}

main().catch((error) => { console.error(error); process.exit(1); });
