/**
 * Map catalog cap options onto the component photos cut from the PSD master library
 * (scripts/catalog/build-cap-swatch-photos.py), by component SKU.
 *
 * A catalog option is a finished product (bottle plus closure, e.g. GBCrcl50RdcrBlkLthr). Its SKU names
 * the closure's finish; the rules below turn that into the closure's component SKU (CP18-415BlkLthr), the
 * key the photos are filed under. An option is mapped only when it has no photo today: no reviewed
 * close-up and no match in the live plate index (the same joins the card uses), so a card never swaps
 * one photo for another once the plates load.
 *
 * Reads the product list and plate index from Convex (queries only, nothing is written there).
 * Writes src/lib/products/cap-swatch-photo-options.generated.json ({ websiteSku: componentSku }) and
 * docs/CAP_SWATCH_PSD_MAPPING.md (what was matched, options with no PSD, PSDs with no option),
 * checked against the 20 Nov production audit in docs/CAP_SWATCH_COVERAGE_2026-11-20.md.
 *
 * Usage: CONVEX_URL=https://<deployment>.convex.cloud npx tsx scripts/catalog/map-cap-swatch-photos.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import reviewed from "../../src/lib/products/cylinder-cap-thumbnails.generated.json" with { type: "json" };
import sprayTops from "../../src/lib/products/tall-cylinder-spray-tops.json" with { type: "json" };
import photos from "../../src/lib/products/cap-swatch-photos.generated.json" with { type: "json" };
import { componentForOption } from "./cap-swatch-components";
import { CATALOG_CAP_FAMILY, catalogCapKind, catalogCapPlatePhoto, type CatalogCapKind, type CatalogCapPhoto } from "../../src/lib/products/catalog-cap-photos";

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
    const plateCache = new Map<string, CatalogCapPhoto[]>();
    const plates = async (familyId: string) => {
        if (!plateCache.has(familyId)) {
            const rows: CatalogCapPhoto[] = [];
            for (let cursor: string | null = null; ;) {
                const page: { page: CatalogCapPhoto[]; isDone: boolean; continueCursor: string } =
                    await client.query(anyApi.productPlates.byFamily, { familyId, cursor, limit: 200 });
                rows.push(...page.page);
                if (page.isDone) break;
                cursor = page.continueCursor;
            }
            plateCache.set(familyId, rows);
        }
        return plateCache.get(familyId)!;
    };

    const gaps = auditGaps();
    const options: Record<string, string> = {};
    const hasPhotoAlready: string[] = [];
    for (const product of products.sort((a, b) => a.websiteSku.localeCompare(b.websiteSku))) {
        if (product.category === "Component" || product.category === "Packaging") continue;
        const component = componentForOption(product.websiteSku, product.neckThreadSize);
        if (!component || !(component in photos)) continue;
        if ((reviewed as Record<string, string>)[product.websiteSku] || (sprayTops as Record<string, unknown>)[product.websiteSku]) {
            hasPhotoAlready.push(product.websiteSku);
            continue;
        }
        const kind: CatalogCapKind | null = catalogCapKind(product.applicator ? [product.applicator] : []);
        if (kind && product.neckThreadSize) {
            let rows = await plates(`${CATALOG_CAP_FAMILY[kind]}-${product.neckThreadSize}`);
            if (!rows.length && (kind === "plain" || kind === "pump")) rows = await plates(`roll-on-cap-${product.neckThreadSize}`);
            const preview = { id: product.websiteSku, label: "", websiteSku: product.websiteSku };
            if (catalogCapPlatePhoto(preview, rows, kind)) {
                hasPhotoAlready.push(product.websiteSku);
                continue;
            }
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
        `- **${filled.length}** of those now show the component cut from its PSD.`,
        `- **${unmatched.length}** still have no photo (no PSD for that component in the library). They keep the colour chip.`,
        `- **${extra.length}** further options, not in that audit, also have no reviewed or plate photo and now show their PSD component.`,
        `- **${Object.keys(photos).length}** component photos were cut; **${unused.length}** are not used by any option yet (their options already have a photo).`,
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
        "| Component | PSD | Options |",
        "|---|---|---:|",
        ...[...group(Object.entries(options), ([, c]) => c).entries()].sort().map(([component, rows]) =>
            `| ${component} | ${(photos as Record<string, { source: string }>)[component].source.replace(/\|/g, "\\|")} | ${rows.length} |`),
        "",
        "## Still no photo (no PSD in the library)",
        "",
        ...[...group(unmatched, ([, where]) => where).entries()].sort().map(([where, rows]) =>
            `- ${where}: ${rows.map(([sku]) => sku).join(", ")}${bySku.get(rows[0][0])?.neckThreadSize ? ` (neck ${bySku.get(rows[0][0])!.neckThreadSize})` : ""}`),
        "",
        "## PSD component photos with no option using them",
        "",
        "These options already have a reviewed or plate photo, or the catalog has no option for the component.",
        "",
        ...unused.map((key) => `- ${key}: ${(photos as Record<string, { source: string }>)[key].source}`),
        "",
        ...(extra.length ? ["## Options mapped that the 20 Nov audit did not list", "", ...extra.map((sku) => `- ${sku} → ${options[sku]}`), ""] : []),
    ];
    writeFileSync(REPORT, lines.join("\n"));
    console.log(`${Object.keys(options).length} options mapped; audit gaps filled ${filled.length}/${gaps.size}; ${unmatched.length} unmatched; ${unused.length} photos unused; ${hasPhotoAlready.length} resolvable options already had a photo`);
}

await main();
