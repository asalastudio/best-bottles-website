/**
 * Map catalog cap options onto the component photos cut from the PSD master library
 * (scripts/catalog/build-cap-swatch-photos.py), by component SKU.
 *
 * A catalog option is a finished product (bottle plus closure, e.g. GBCrcl50RdcrBlkLthr). Its SKU names
 * the closure's finish; cap-swatch-components.ts turns that into the closure's component SKU
 * (CP18-415BlkLthr), the key the photos are filed under. Every option whose component has a photo is
 * mapped, unless it has a reviewed photo of its own. The card decides which photo wins: a sprayer or
 * pump shows its PSD head; any other closure shows its plate-index photo when the index has one and
 * this photo otherwise, so a card whose plate lookup finds nothing still shows the cap.
 *
 * Reads the product list from Convex (one query, nothing is written there).
 * Writes src/lib/products/cap-swatch-photo-options.generated.json ({ websiteSku: componentSku }) and
 * docs/CAP_SWATCH_PSD_MAPPING.md (what was matched, options with no photo, PSDs with no option),
 * checked against the 20 Nov production audit in docs/CAP_SWATCH_COVERAGE_2026-11-20.md. That audit read
 * only the first 24 cards of each family (it did not press "Load More"), so options further down a
 * long family, such as Cylinder's Pillar bottles, are mapped here without appearing in its counts.
 *
 * Usage: CONVEX_URL=https://<deployment>.convex.cloud npx tsx scripts/catalog/map-cap-swatch-photos.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import reviewed from "../../src/lib/products/cylinder-cap-thumbnails.generated.json" with { type: "json" };
import sprayTops from "../../src/lib/products/tall-cylinder-spray-tops.json" with { type: "json" };
import photos from "../../src/lib/products/cap-swatch-photos.generated.json" with { type: "json" };
import sharedReviewed from "../../src/lib/products/cap-swatch-shared-reviewed.json" with { type: "json" };
import { componentForOption } from "./cap-swatch-components";

const OPTIONS = "src/lib/products/cap-swatch-photo-options.generated.json";
const REPORT = "docs/CAP_SWATCH_PSD_MAPPING.md";
const AUDIT = "docs/CAP_SWATCH_COVERAGE_2026-11-20.md";

type Product = { websiteSku: string; neckThreadSize: string | null; category: string; family: string | null; applicator: string | null };

/** The options the 20 Nov production audit found with no photo: { sku: "Family / Closure / Finish" }. */
function auditGaps(): Map<string, string> {
    const text = readFileSync(AUDIT, "utf8").split("## Options with no swatch photo")[1] ?? "";
    const gaps = new Map<string, string>();
    let family = "", closure = "";
    for (const line of text.split("\n")) {
        const heading = line.match(/^### (.+)/);
        if (heading) { family = heading[1]; continue; }
        const bold = line.match(/^\*\*(.+)\*\*$/);
        if (bold) { closure = bold[1]; continue; }
        const item = line.match(/^- (.+?): \d+ cards? \(.*\)\. SKUs: (.+)$/);
        if (item) for (const sku of item[2].split(",").map((s) => s.trim())) gaps.set(sku, `${family} / ${closure} / ${item[1]}`);
    }
    return gaps;
}

/** The audit's summary table: options and options with no photo, per family and closure type. */
function auditSummary() {
    const text = readFileSync(AUDIT, "utf8").split("## Summary by family and closure type")[1]?.split("## ")[0] ?? "";
    return [...text.matchAll(/^\| (?!Family|---)([^|]+) \| ([^|]+) \| (\d+) \| (\d*) \|$/gm)]
        .map((m) => ({ family: m[1].trim(), closure: m[2].trim(), options: Number(m[3]), missing: Number(m[4] || 0) }));
}

async function main() {
    const url = process.env.CONVEX_URL;
    if (!url) throw new Error("Set CONVEX_URL to the deployment to read (queries only).");
    const client = new ConvexHttpClient(url);
    const products: Product[] = [];
    for (let cursor: string | null = null; ;) {
        const page: { page: Product[]; isDone: boolean; continueCursor: string } =
            await client.query(anyApi.products.getComponentsForAudit, { limit: 800, cursor });
        products.push(...page.page);
        if (page.isDone) break;
        cursor = page.continueCursor;
    }
    const gaps = auditGaps();
    const options: Record<string, string> = {};
    const hasPhotoAlready: string[] = [];
    for (const product of products.sort((a, b) => a.websiteSku.localeCompare(b.websiteSku))) {
        if (product.category === "Component" || product.category === "Packaging") continue;
        const component = componentForOption(product.websiteSku, product.neckThreadSize, product.applicator);
        if (!component || !(component in photos || component in sharedReviewed)) continue;
        if ((reviewed as Record<string, string>)[product.websiteSku] || (sprayTops as Record<string, unknown>)[product.websiteSku]) {
            hasPhotoAlready.push(product.websiteSku);
            continue;
        }
        options[product.websiteSku] = component;
    }
    writeFileSync(OPTIONS, `${JSON.stringify(options, null, 1)}\n`);

    const bySku = new Map(products.map((p) => [p.websiteSku, p]));
    const filled = [...gaps.keys()].filter((sku) => options[sku]);
    const unmatched = [...gaps.entries()].filter(([sku]) => !options[sku]);
    const extra = Object.keys(options).filter((sku) => !gaps.has(sku));
    const used = new Set(Object.values(options));
    const unused = Object.keys(photos).filter((key) => !used.has(key));
    const group = <T,>(items: T[], key: (item: T) => string) => items.reduce((map, item) => map.set(key(item), [...(map.get(key(item)) ?? []), item]), new Map<string, T[]>());

    const lines = [
        "# Cap swatch photos from the PSD master library",
        "",
        "Generated by `scripts/catalog/map-cap-swatch-photos.mts` (photos cut by `scripts/catalog/build-cap-swatch-photos.py`).",
        `Checked against the 20 Nov production audit (\`${AUDIT}\`): ${gaps.size} options had no swatch photo.`,
        "",
        `- **${filled.length}** of those now show a photo of their component: the part cut from its PSD, or, for the short metallic 13-415 caps the library has no PSD for, the reviewed photo of the same cap from the 5 ml Cylinder (${filled.filter((sku) => options[sku] in sharedReviewed).length} options).`,
        `- **${unmatched.length}** still have no photo (no PSD or reviewed photo of that component). They keep the colour chip.`,
        `- **${extra.length}** further options are mapped that the audit did not list. Some were past the first 24 cards of their family, which is all that audit read. The rest already have a plate photo: a spray or pump among them now shows its PSD head instead (three of the index's 13-415 sprayer photos are overcaps), and any other closure keeps its plate photo and uses this one only if the plate lookup finds nothing.`,
        `- **${Object.keys(photos).length}** component photos were cut; **${unused.length}** are not mapped to any option (their options have a reviewed photo of their own, or the catalog has no option for the component).`,
        "",
        "## Coverage by family and closure",
        "",
        "| Family | Closure | Options | No photo (20 Nov) | No photo now |",
        "|---|---|---:|---:|---:|",
        ...auditSummary().map(({ family, closure, options: count, missing }) => {
            const still = unmatched.filter(([, where]) => where.startsWith(`${family} / ${closure} / `)).length;
            return `| ${family} | ${closure} | ${count} | ${missing || ""} | ${still || ""} |`;
        }),
        `| **All** | | **${auditSummary().reduce((n, row) => n + row.options, 0)}** | **${gaps.size}** | **${unmatched.length}** |`,
        "",
        "## Filled, by component",
        "",
        "| Component | Source | Options |",
        "|---|---|---:|",
        ...[...group(Object.entries(options), ([, c]) => c).entries()].sort().map(([component, rows]) =>
            `| ${component} | ${((photos as Record<string, { source: string }>)[component]?.source ?? `reviewed photo of ${(sharedReviewed as Record<string, string>)[component]}`).replace(/\|/g, "\\|")} | ${rows.length} |`),
        "",
        "## Still no photo (no PSD or reviewed photo of the component)",
        "",
        ...[...group(unmatched, ([, where]) => where).entries()].sort().map(([where, rows]) =>
            `- ${where}: ${rows.map(([sku]) => sku).join(", ")}${bySku.get(rows[0][0])?.neckThreadSize ? ` (neck ${bySku.get(rows[0][0])!.neckThreadSize})` : ""}`),
        "",
        "## PSD component photos with no option using them",
        "",
        "Their options have a reviewed photo of their own, or the catalog has no option for the component.",
        "",
        ...unused.map((key) => `- ${key}: ${(photos as Record<string, { source: string }>)[key].source}`),
        "",
        ...(extra.length ? ["## Options mapped that the 20 Nov audit did not list", "", ...extra.map((sku) => `- ${sku} → ${options[sku]}`), ""] : []),
    ];
    writeFileSync(REPORT, lines.join("\n"));
    console.log(`${Object.keys(options).length} options mapped; audit gaps filled ${filled.length}/${gaps.size}; ${unmatched.length} unmatched; ${unused.length} photos unused; ${hasPhotoAlready.length} resolvable options have a reviewed photo of their own`);
}

await main();
