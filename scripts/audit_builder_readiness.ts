/** Read-only audit for every family using the requested necks, including families
 * absent from the customer family picker. No catalog, publication, or media writes.
 * npx tsx scripts/audit_builder_readiness.ts --url PUBLIC_CONVEX_URL --legacy --out /tmp/builder-readiness
 * Optional --family Cylinder, --threads 13-415,17-415,18-415, --check.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { resolveListedComponents, type ActiveComponent } from "../src/lib/bottle-builder/components";
import type { BuilderKit } from "../src/lib/bottle-builder/model";
import { auditFamilyReadiness } from "./lib/builder-readiness";
import { parseLegacyProductPage } from "./audit_product_truth_reconciliation.mjs";

type Product = ActiveComponent & { family?: string; category?: string; capacityMl?: number; productUrl?: string; shopifySellableReason?: string };
async function parallel<T, R>(items: T[], count: number, fn: (item: T) => Promise<R>) {
    const results = new Array<R>(items.length); let next = 0;
    await Promise.all(Array.from({ length: Math.min(count, items.length) }, async () => {
        while (next < items.length) { const i = next++; results[i] = await fn(items[i]); }
    })); return results;
}
async function main() {
    config({ path: ".env.local", quiet: true });
    const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
    const url = arg("--url") ?? process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw Error("A public Convex URL is required");
    const threads = (arg("--threads") ?? "13-415,17-415,18-415").split(",").map(t => t.trim());
    if (threads.some(t => !/^\d+-\d+$/.test(t))) throw Error("Use exact comma-separated neck threads");
    const out = path.resolve(arg("--out") ?? "data/audits/builder-readiness"); fs.mkdirSync(out, { recursive: true });
    const client = new ConvexHttpClient(url);
    const inventory: Product[] = []; let cursor: string | null = null;
    do {
        const page: { page: Record<string, unknown>[]; isDone: boolean; continueCursor: string } = await client.action(api.products.getProductExportPage, { cursor, numItems: 250 });
        inventory.push(...page.page as Product[]);
        if (page.isDone) break;
        if (cursor === page.continueCursor) throw Error("Catalog pagination did not advance");
        cursor = page.continueCursor;
    } while (true);
    const scoped = inventory.filter(p => threads.includes(p.neckThreadSize ?? "") && /bottle|vial/i.test(p.category ?? "")
        && (!arg("--family") || p.family === arg("--family")));
    const families = [...new Set(scoped.map(p => p.family).filter((f): f is string => Boolean(f)))].sort();
    const bySku = new Map<string, Product[]>();
    for (const p of inventory) for (const key of new Set([p.websiteSku, p.graceSku].filter((key): key is string => Boolean(key)))) bySku.set(key, [...(bySku.get(key) ?? []), p]);
    const records: (ReturnType<typeof auditFamilyReadiness>[number] & {
        sourceUrl: string | null; assemblySellableReason: string | null; componentSellableReason: string | null;
    })[] = [];
    for (const family of families) {
        const data = await client.query(api.matrix.getFamilyRows, { family });
        if (data.truncated) throw Error(`${family} matrix is truncated; audit cannot certify coverage`);
        const raw = data.rows.filter(r => threads.includes(r.neckThreadSize ?? "") && /bottle|vial/i.test(r.category ?? ""));
        const rows = await resolveListedComponents(raw, async sku => {
            const found = bySku.get(sku) ?? [];
            return found.length === 1 ? found[0] : null;
        });
        // Fetch kits even for rejected candidates so commerce cannot mask kit status.
        const kits = await parallel(rows, 8, row => client.query(api.productKits.forSku,
            { websiteSku: row.websiteSku ?? null, graceSku: row.graceSku ?? null })) as (BuilderKit | null)[];
        const audit = auditFamilyReadiness(rows, kits).map(r => ({ ...r,
            sourceUrl: bySku.get(r.sku ?? "")?.[0]?.productUrl ?? null,
            assemblySellableReason: bySku.get(r.sku ?? "")?.[0]?.shopifySellableReason ?? null,
            componentSellableReason: bySku.get(r.componentSku ?? "")?.[0]?.shopifySellableReason ?? null,
        }));
        records.push(...audit);
        console.log(`${family}: ${audit.filter(r => r.visible).length}/${audit.length} visible`);
    }
    const sourcePages: { url: string; sku?: string; neck?: string; family?: string; glass?: string; capacityMl?: number; sha256?: string; hasPurchase?: boolean; stockUnavailable?: boolean; error?: string }[] = [];
    const priorSource = process.argv.includes("--reuse-source") ? JSON.parse(fs.readFileSync(path.join(out, "readiness.json"), "utf8")) as { checkedAt: string; sourcePages: typeof sourcePages } : null;
    const sourceCache = new Map(priorSource?.sourcePages.map(p => [p.url, p.sha256]));
    if (process.argv.includes("--legacy")) {
        const sourceDirectory = path.join(out, "source-html"); fs.mkdirSync(sourceDirectory, { recursive: true });
        const seen = new Set<string>();
        const validSource = (value: string) => {
            try { const u = new URL(value); return u.protocol === "https:" && u.hostname === "www.bestbottles.com" && /^\/+product\//.test(u.pathname); } catch { return false; }
        };
        let queue = [...new Set(scoped.map(p => p.productUrl).filter((u): u is string => Boolean(u && validSource(u))))];
        while (queue.length) {
            if (seen.size + queue.length > 5000) throw Error("Source discovery exceeded audit limit; do not certify coverage");
            const discovered = await parallel(queue, 6, async original => {
                const sourceUrl = original.replace(".com//product/", ".com/product/"); seen.add(sourceUrl);
                try {
                    const cachedHash = sourceCache.get(sourceUrl);
                    let html: string;
                    if (cachedHash && fs.existsSync(path.join(sourceDirectory, `${cachedHash}.html`))) html = fs.readFileSync(path.join(sourceDirectory, `${cachedHash}.html`), "utf8");
                    else {
                        const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000) });
                        if (!response.ok) throw Error(`HTTP ${response.status}`);
                        html = await response.text();
                    }
                    const hash = createHash("sha256").update(html).digest("hex");
                    fs.writeFileSync(path.join(sourceDirectory, `${hash}.html`), html);
                    const product = parseLegacyProductPage({ html, url: sourceUrl });
                    // Require an actual Item Name, not a generic heading or an image fallback.
                    const sku = product.itemName || undefined;
                    sourcePages.push({ url: sourceUrl, sku, neck: product.neckThreadSize ?? undefined,
                        family: product.family ?? undefined, glass: product.color ?? undefined, capacityMl: product.capacityMl ?? undefined, sha256: hash,
                        hasPurchase: /name=["']Nprices["']/.test(html), stockUnavailable: /out of stock/i.test(html),
                        ...(!sku ? { error: "Product Item Name missing; source unresolved" } : {}) });
                    const associated = html.match(/<div id=["']assoc_pr["'][^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
                    return [...associated.matchAll(/href=["']([^"']+)["']/g)].map(m => new URL(m[1], sourceUrl).href.replace(".com//product/", ".com/product/")).filter(validSource);
                } catch (error) { sourcePages.push({ url: sourceUrl, error: String(error) }); return []; }
            });
            queue = [...new Set(discovered.flat())].filter(u => !seen.has(u));
            console.log(`Legacy: ${seen.size} pages inspected, ${queue.length} newly linked variants`);
        }
    }
    const represented = new Set(records.map(r => r.sku));
    const missingMatrix = scoped.filter(p => !represented.has(p.websiteSku ?? "")).map(p => ({ sku: p.websiteSku, family: p.family, neck: p.neckThreadSize }));
    const sourceOnly = sourcePages.filter(p => p.sku && threads.includes(p.neck ?? "") && !represented.has(p.sku));
    const sourceMismatches = sourcePages.flatMap(p => {
        const row = records.find(r => r.sku === p.sku);
        if (!row) return [];
        return (["neck", "family", "glass", "capacityMl"] as const).flatMap(field => p[field] != null && row[field] != null && p[field] !== row[field]
            ? [{ sku: p.sku, field, source: p[field], catalog: row[field], url: p.url }] : []);
    });
    const totals = threads.map(neck => { const rows = records.filter(r => r.neck === neck); return { neck,
        assemblies: rows.length, visible: rows.filter(r => r.visible).length,
        families: [...new Set(rows.map(r => r.family))].length }; });
    const report = { checkedAt: new Date().toISOString(), mode: "read-only", endpoint: url, threads, families,
        inventoryCount: inventory.length, totals, missingMatrix, sourceOnly, sourceMismatches,
        reusedSourceSnapshotAt: priorSource?.checkedAt ?? null,
        sourceScope: process.argv.includes("--legacy") ? "Catalog source URLs plus recursively linked variant selectors; not a complete independent legacy category census" : "Not checked",
        records, sourcePages };
    fs.writeFileSync(path.join(out, "readiness.json"), JSON.stringify(report, null, 2) + "\n");
    const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const columns = ["sku", "family", "capacityMl", "glass", "neck", "fitment", "finish", "visible", "blockers", "componentSku", "componentSellableReason", "assemblySellableReason", "componentStandaloneSellable", "sourceUrl"] as const;
    fs.writeFileSync(path.join(out, "assemblies.csv"), [columns.join(","), ...records.map(r => columns.map(k => csv(Array.isArray(r[k]) ? r[k].join(" | ") : r[k])).join(","))].join("\n") + "\n");
    console.log(JSON.stringify({ out, totals, missingMatrix: missingMatrix.length, sourceOnly: sourceOnly.length, sourceMismatches: sourceMismatches.length, sourceErrors: sourcePages.filter(p => p.error).length }, null, 2));
    // A catalog-derived crawl cannot certify a new family's complete legacy scope.
    // --check is deliberately fail-closed; review the source inventory and blockers.
    if (process.argv.includes("--check") && (records.some(r => !r.visible) || missingMatrix.length || sourceOnly.length || sourceMismatches.length || !sourcePages.length || sourcePages.some(p => p.error))) process.exitCode = 2;
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
