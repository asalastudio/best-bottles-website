/**
 * Plan (never apply) the additive mirror of production catalogue records that
 * the shared dev deployment lacks or holds stale, so the builder on dev sees
 * the same catalogue the storefront sells:
 *   1. products present on prod, absent on dev  -> createProductFromTwin args + prod Shopify ids
 *   2. product groups present on prod, absent on dev, needed by (1)
 *   3. component stock statuses that drifted (prod is Shopify-synced truth)
 *   4. tassel assemblies whose applicator lost "with Tassel" (name is the evidence)
 * Read-only: writes data/asset-ledger/dev-mirror-plan-2026-09-14.json.
 */
import { readFileSync, writeFileSync } from "node:fs"; import path from "node:path";
import { ConvexHttpClient } from "convex/browser"; import { api } from "../../convex/_generated/api";
for (const line of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const PROD = "https://precise-raccoon-123.convex.cloud";
const dev = JSON.parse(readFileSync("data/asset-ledger/dev-products-dump.json", "utf8")) as any[];
const prod = JSON.parse(readFileSync("data/asset-ledger/prod-products-dump.json", "utf8")) as any[];
const devGroups = JSON.parse(readFileSync("data/asset-ledger/dev-groups-dump.json", "utf8")) as any[];
const prodGroups = JSON.parse(readFileSync("data/asset-ledger/prod-groups-dump.json", "utf8")) as any[];
const plan = JSON.parse(readFileSync("data/legacy/promote-plan.json", "utf8")).rows as any[];
const legacy = new Set((JSON.parse(readFileSync("data/legacy/legacy-catalog.json", "utf8")).rows as any[]).map(r => r.sku));

async function main() {
    const pc = new ConvexHttpClient(PROD), dc = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const devSkus = new Set(dev.map(p => p.websiteSku)); const devGrace = new Set(dev.map(p => p.graceSku));
    const prodSlugById = new Map(prodGroups.map(g => [g._id, g.slug])); const devSlugs = new Set(devGroups.map(g => g.slug));
    const planBySku = new Map(plan.map(r => [r.websiteSku, r]));
    // test fixtures and the blank-SKU alias are not catalogue records
    const absent = prod.filter(p => p.websiteSku && !/__RETIRED__|^HMAC-|TEST/.test(p.websiteSku) && !/^Internal$/i.test(p.category ?? "") && !devSkus.has(p.websiteSku));
    const products: any[] = [], groupsNeeded = new Set<string>(), problems: any[] = [];
    for (const a of absent) {
        const full: any = (await pc.query(api.products.lookupSku, { sku: a.websiteSku }))?.product;
        if (!full) { problems.push({ sku: a.websiteSku, why: "prod lookupSku returned nothing" }); continue; }
        const slug = prodSlugById.get(full.productGroupId) ?? null;
        if (!slug) { problems.push({ sku: a.websiteSku, why: "prod product has no group" }); continue; }
        if (!devSlugs.has(slug)) groupsNeeded.add(slug);
        // twin: the promote plan's reviewed twin when it exists on dev, else a dev
        // product of the same prod group + colour + applicator + category.
        let twin = planBySku.get(a.websiteSku)?.twinWebsiteSku;
        if (!twin || !devSkus.has(twin)) {
            const sib = prod.filter(p => p.websiteSku !== a.websiteSku && prodSlugById.get((p as any).productGroupId) === slug);
            // same mould, glass, neck and category on dev; prefer the same applicator family
            const same = dev.filter(d => !/__RETIRED__/.test(d.websiteSku ?? "") && d.category === full.category && d.family === full.family && d.color === full.color
                && d.neckThreadSize === full.neckThreadSize && String(d.capacity ?? "") === String(full.capacity ?? ""));
            const sameApp = same.filter(d => (d.itemName ?? "").toLowerCase().includes((full.applicator ?? "").split(" ")[0].toLowerCase()));
            twin = (sameApp[0] ?? same[0])?.websiteSku ?? sib.find(p => devSkus.has(p.websiteSku))?.websiteSku ?? null;
        }
        if (!twin) { problems.push({ sku: a.websiteSku, why: "no twin on dev" }); continue; }
        if (devGrace.has(full.graceSku)) { problems.push({ sku: a.websiteSku, why: `grace SKU ${full.graceSku} already used on dev` }); continue; }
        products.push({
            websiteSku: full.websiteSku, graceSku: full.graceSku, twinWebsiteSku: twin, groupSlug: slug,
            color: full.color ?? "", capColor: full.capColor ?? null, itemName: full.itemName ?? "", itemDescription: full.itemDescription ?? "",
            priceTiers: full.priceTiers ?? [], category: full.category, family: full.family, applicator: full.applicator ?? null,
            inLegacy: legacy.has(full.websiteSku), prodImportSource: full.importSource ?? null,
            shopify: { variantId: full.shopifyVariantId ?? null, inventoryItemId: full.shopifyInventoryItemId ?? null, sellable: full.shopifySellable ?? null, reason: full.shopifySellableReason ?? null },
            stockStatus: full.stockStatus ?? null, imageUrl: full.imageUrl ?? null, productUrl: full.productUrl ?? null,
            // fields the twin copy would otherwise carry wrongly; patched after creation from the prod record
            postPatch: Object.fromEntries(Object.entries({ applicator: full.applicator, capStyle: full.capStyle, stockStatus: full.stockStatus, imageUrl: full.imageUrl,
                productUrl: full.productUrl, productId: full.productId, neckThreadSize: full.neckThreadSize, capacity: full.capacity, capacityMl: full.capacityMl,
                shape: full.shape, components: full.components }).filter(([, v]) => v !== undefined)),
            source: "dev-mirror-2026-09-14 (prod record, additive)",
        });
    }
    const groups = [];
    for (const slug of [...groupsNeeded].filter(x => products.some(p => p.groupSlug === x))) {
        const g: any = (await pc.query(api.products.getAllCatalogGroups, {})).find((x: any) => x.slug === slug);
        if (g) { const { _id, _creationTime, ...fields } = g; groups.push(fields); } else problems.push({ slug, why: "prod group not found in catalog groups" });
    }
    // 3. stock drift on components (dev out of stock, prod in stock)
    const prodBySku = new Map(prod.map(p => [p.websiteSku, p]));
    const stock = dev.filter(d => d.websiteSku && !/__RETIRED__/.test(d.websiteSku) && /component/i.test(d.category ?? ""))
        .map(d => ({ d, p: prodBySku.get(d.websiteSku) })).filter(({ d, p }) => p && (d.stockStatus ?? "").toLowerCase() !== (p.stockStatus ?? "").toLowerCase())
        .map(({ d, p }) => ({ websiteSku: d.websiteSku, graceSku: d.graceSku, from: d.stockStatus, to: p.stockStatus }));
    // 4. tassel applicator from the catalogue name
    const tassel = dev.filter(d => d.websiteSku && !/__RETIRED__/.test(d.websiteSku) && /with tassel/i.test(d.itemName ?? "") && /bottle/i.test(d.category ?? ""));
    const applicator: any[] = [];
    for (const t of tassel) {
        const full: any = (await dc.query(api.products.lookupSku, { sku: t.websiteSku }))?.product;
        if (full && full.applicator === "Vintage Bulb Sprayer") applicator.push({ id: full._id, websiteSku: full.websiteSku, from: full.applicator, to: "Vintage Bulb Sprayer with Tassel", evidence: full.itemName });
    }
    const outPlan = { generatedAt: new Date().toISOString(), devDeployment: process.env.NEXT_PUBLIC_CONVEX_URL, prodDeployment: PROD,
        counts: { products: products.length, groups: groups.length, stock: stock.length, applicator: applicator.length, problems: problems.length },
        products, groups, stock, applicator, problems };
    writeFileSync("data/asset-ledger/dev-mirror-plan-2026-09-14.json", JSON.stringify(outPlan, null, 1) + "\n");
    console.log(JSON.stringify(outPlan.counts));
    const byCat: Record<string, number> = {}; for (const p of products) byCat[`${p.category} / ${p.family}`] = (byCat[`${p.category} / ${p.family}`] ?? 0) + 1; console.log(byCat);
    console.log("not in legacy:", products.filter(p => !p.inLegacy).map(p => p.websiteSku).join(", ") || "none");
    console.log("without prod variant:", products.filter(p => !p.shopify.variantId).map(p => p.websiteSku).join(", ") || "none");
    console.log("groups:", groups.map(g => g.slug).join(", ")); console.log("problems:", JSON.stringify(problems));
    console.log("stock:", JSON.stringify(stock)); console.log("applicator:", applicator.length, applicator.map(a => a.websiteSku).join(", "));
}
main().catch(e => { console.error(e); process.exit(1); });
