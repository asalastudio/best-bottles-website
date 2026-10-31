/**
 * Catalog hero coverage check against a Convex deployment.
 *
 * Read-only. Reads every product group and its variants through the public
 * catalogue queries, resolves the card hero exactly as the storefront does
 * (`getCatalogHero`, alias-aware), and reports which groups have one. Pass
 * `--expect SKU,SKU,...` to assert that each listed SKU's own hero is eligible
 * inside the production group it actually lives in; the exit code is 1 when any
 * expected SKU does not.
 *
 *   NEXT_PUBLIC_CATALOG_HERO_PILOT=families-2026-09-22 npx tsx scripts/check_catalog_hero_coverage.mts
 *   ... --url https://precise-raccoon-123.convex.cloud --json out.json --expect GBElg15MinarCu,LB3mlClear
 */
import { writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { getCatalogHero, isCatalogHeroPilotEnabled } from "../src/lib/products/catalog-heroes";

const args = process.argv.slice(2);
const get = (flag: string, fallback: string | null = null) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback; };
const url = get("--url", process.env.CONVEX_HERO_CHECK_URL ?? "https://precise-raccoon-123.convex.cloud")!;
const expect = (get("--expect") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const jsonOut = get("--json");

type Group = { _id: string; slug: string; family?: string | null; category?: string | null };
type Variant = { websiteSku?: string | null; graceSku?: string | null };

async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length); let i = 0;
    await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
    return out;
}

const client = new ConvexHttpClient(url);
const groups = (await client.query(anyApi.products.getAllCatalogGroups, {})) as Group[];
const detail = await pool(groups, 8, async (g) => (await client.query(anyApi.products.getProductGroup, { slug: g.slug })) as { group: Group; variants: Variant[] } | null);

const rows = groups.map((g, i) => {
    const variants = detail[i]?.variants ?? [];
    const hero = getCatalogHero(g.slug, variants);
    return { slug: g.slug, family: g.family ?? null, category: g.category ?? null, variants: variants.length, heroSku: hero?.websiteSku ?? null, heroUrl: hero?.url ?? null };
});
const withHero = rows.filter((r) => r.heroUrl);
const byFamily: Record<string, { groups: number; withHero: number }> = {};
for (const r of rows) { const f = byFamily[r.family ?? "(none)"] ??= { groups: 0, withHero: 0 }; f.groups++; if (r.heroUrl) f.withHero++; }

const skuToGroup = new Map<string, string>();
groups.forEach((g, i) => { for (const v of detail[i]?.variants ?? []) if (v.websiteSku) skuToGroup.set(v.websiteSku, g.slug); });
const expectations = expect.map((sku) => {
    const slug = skuToGroup.get(sku) ?? null;
    // Resolve with only this SKU's variant in the group: the card shows one hero
    // per group, so the question is whether this SKU's hero is eligible there.
    const own = slug ? (detail[groups.findIndex((g) => g.slug === slug)]?.variants ?? []).filter((v) => v.websiteSku === sku) : [];
    const hero = slug ? getCatalogHero(slug, own, sku) : null;
    return { sku, group: slug, resolved: hero?.websiteSku === sku, heroUrl: hero?.url ?? null };
});
const failed = expectations.filter((e) => !e.resolved);

const summary = { url, pilotEnabled: isCatalogHeroPilotEnabled(), groups: rows.length, groupsWithHero: withHero.length, groupsWithoutHero: rows.length - withHero.length, byFamily, expectations, failed: failed.length };
console.log(JSON.stringify({ ...summary, byFamily: undefined }, null, 1));
console.log("by family (groups with hero / groups):", Object.entries(byFamily).sort((a, b) => b[1].groups - a[1].groups).map(([k, v]) => `${k} ${v.withHero}/${v.groups}`).join(", "));
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ ...summary, rows }, null, 1));
if (failed.length) { console.error("Expected SKUs without a hero in their production group:", failed.map((f) => `${f.sku} (${f.group ?? "not in catalogue"})`).join(", ")); process.exit(1); }
