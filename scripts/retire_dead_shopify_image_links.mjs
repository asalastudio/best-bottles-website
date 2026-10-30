/**
 * Retire dead Shopify CDN image links in a Convex deployment's `products` rows.
 *
 * For every variant whose `imageUrl` or `imageUrlCapOff` is a cdn.shopify.com
 * URL that no longer resolves (HEAD 404/410, re-checked here, never trusted
 * from an older audit), the plan repoints the field to the SKU's paper-doll
 * plate (`productPlates.forSkus`: the full `image` front, `imageCapOff` for the
 * cap-off view, the same 1000x1100 plates the dev deployment already carries
 * in these fields) when one exists, otherwise clears it to null. Live Shopify URLs
 * are left alone. The dead value is preserved in `legacyShopify*` by the
 * mutation.
 *
 * Dry run by default: prints per-family counts and writes the plan to
 * data/audits/dead-shopify-image-links-<date>/plan.json. `--apply` sends the
 * plan, 250 patches per call, through the internal mutation
 * `imageReconciliation:retireDeadImageLinks` with `npx convex run --push`,
 * which also pushes this checkout's convex/ functions to the target, so run it
 * from the commit the deployment is on.
 *
 *   node scripts/retire_dead_shopify_image_links.mjs                 # dry run against production
 *   node scripts/retire_dead_shopify_image_links.mjs --family Round  # one family
 *   node scripts/retire_dead_shopify_image_links.mjs --url https://helpful-elephant-638.convex.cloud --dev
 *   node scripts/retire_dead_shopify_image_links.mjs --apply         # production, after reviewing the plan
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { REPO_ROOT } from "./lib/local-paths.mjs";

const PRODUCTION_URL = "https://precise-raccoon-123.convex.cloud";
const args = process.argv.slice(2);
const get = (flag, fallback = null) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback; };
const options = {
    url: get("--url", PRODUCTION_URL),
    dev: args.includes("--dev"),
    family: get("--family"),
    apply: args.includes("--apply"),
    concurrency: Number(get("--concurrency", "24")),
    outDir: get("--out", path.join(REPO_ROOT, "data/audits", `dead-shopify-image-links-${new Date().toISOString().slice(0, 10)}`)),
};
if (options.apply && options.url === PRODUCTION_URL && !options.dev && !args.includes("--yes-production")) {
    console.error("Refusing to apply to production without --yes-production.");
    process.exit(2);
}

const isShopify = (u) => { try { return new URL(u).hostname === "cdn.shopify.com"; } catch { return false; } };
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }

const statusCache = new Map();
async function probe(url) {
    if (statusCache.has(url)) return statusCache.get(url);
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
    let status = 0, error = null;
    try {
        let r = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctl.signal });
        if (r.status === 405 || r.status === 403) r = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, redirect: "follow", signal: ctl.signal });
        status = r.status;
    } catch (e) { error = String(e?.cause?.code ?? e?.name ?? e).slice(0, 40); }
    finally { clearTimeout(t); }
    const verdict = { status, error, dead: status === 404 || status === 410 };
    statusCache.set(url, verdict);
    return verdict;
}

async function main() {
    const client = new ConvexHttpClient(options.url);
    const groups = options.family
        ? await client.query(anyApi.products.getProductGroupsByFamily, { family: options.family })
        : await client.query(anyApi.products.getAllCatalogGroups, {});
    const detail = await pool(groups, 8, async (g) => { try { return await client.query(anyApi.products.getProductGroup, { slug: g.slug }); } catch (e) { return { group: g, variants: [], error: String(e).slice(0, 160) }; } });
    const variants = detail.flatMap((d) => (d?.variants ?? []).map((v) => ({ ...v, groupSlug: d.group.slug, family: d.group.family ?? v.family ?? null })));

    const candidates = [];
    for (const v of variants) for (const field of ["imageUrl", "imageUrlCapOff"]) if (v[field] && isShopify(v[field])) candidates.push({ variant: v, field, url: v[field] });
    const distinct = [...new Set(candidates.map((c) => c.url))];
    process.stderr.write(`${options.url}: ${groups.length} groups, ${variants.length} variants, ${candidates.length} Shopify image fields (${distinct.length} distinct URLs); probing…\n`);
    let done = 0;
    await pool(distinct, options.concurrency, async (u) => { await probe(u); if (++done % 500 === 0) process.stderr.write(`  probed ${done}/${distinct.length}\n`); });

    const dead = candidates.filter((c) => statusCache.get(c.url).dead);
    const unknown = candidates.filter((c) => { const s = statusCache.get(c.url); return !s.dead && s.status !== 200 && s.status !== 206; });
    const skus = [...new Set(dead.flatMap((c) => [c.variant.websiteSku, c.variant.graceSku]).filter(Boolean))];
    const plates = {};
    for (let i = 0; i < skus.length; i += 200) {
        const r = await client.query(anyApi.productPlates.forSkus, { skus: skus.slice(i, i + 200) });
        Object.assign(plates, r.plates);
    }

    const patches = []; const skipped = [];
    for (const c of dead) {
        const v = c.variant;
        if (!v.websiteSku) { skipped.push({ reason: "no websiteSku", graceSku: v.graceSku, field: c.field, url: c.url }); continue; }
        const plate = plates[v.websiteSku] ?? (v.graceSku ? plates[v.graceSku] : undefined) ?? null;
        const next = c.field === "imageUrl" ? plate?.image ?? null : plate?.imageCapOff ?? null;
        patches.push({ websiteSku: v.websiteSku, field: c.field, expect: c.url, next, action: next ? "repoint-to-plate" : "clear", family: v.family, groupSlug: v.groupSlug, status: statusCache.get(c.url).status });
    }

    const count = (arr, f) => { const b = {}; for (const r of arr) { const k = f(r); b[k] = (b[k] || 0) + 1; } return Object.fromEntries(Object.entries(b).sort((a, b) => b[1] - a[1])); };
    const summary = {
        url: options.url, generatedAt: new Date().toISOString(), family: options.family ?? "ALL",
        groups: groups.length, variants: variants.length, shopifyFields: candidates.length, distinctShopifyUrls: distinct.length,
        deadFields: dead.length, deadDistinctUrls: new Set(dead.map((c) => c.url)).size, liveFields: candidates.length - dead.length - unknown.length, unknownFields: unknown.length,
        skusAffected: new Set(dead.map((c) => c.variant.websiteSku ?? c.variant.graceSku)).size,
        byAction: count(patches, (p) => `${p.field}:${p.action}`),
        byFamily: Object.fromEntries(Object.entries(count(patches, (p) => p.family ?? "(none)")).map(([fam]) => [fam, count(patches.filter((p) => p.family === fam || (!p.family && fam === "(none)")), (p) => p.action)])),
        skipped: skipped.length,
    };
    mkdirSync(options.outDir, { recursive: true });
    const planPath = path.join(options.outDir, options.family ? `plan-${options.family.toLowerCase().replace(/\W+/g, "-")}.json` : "plan.json");
    writeFileSync(planPath, JSON.stringify({ summary, patches, skipped, unknown: unknown.map((c) => ({ websiteSku: c.variant.websiteSku, field: c.field, url: c.url, ...statusCache.get(c.url) })) }, null, 1));
    console.log(JSON.stringify(summary, null, 1));
    console.log(`plan: ${path.relative(REPO_ROOT, planPath)} (${patches.length} patches)`);

    if (!options.apply) { console.log("\nDry run. Review the plan, then re-run with --apply (and --yes-production for production)."); return; }
    if (!patches.length) { console.log("Nothing to apply."); return; }
    const sourceLabel = `retire-dead-shopify-image-links:${summary.generatedAt}`;
    for (let i = 0; i < patches.length; i += 250) {
        const chunk = patches.slice(i, i + 250).map(({ websiteSku, field, expect, next }) => ({ websiteSku, field, expect, next }));
        const cli = ["convex", "run", "imageReconciliation:retireDeadImageLinks", JSON.stringify({ sourceLabel, patches: chunk }), "--push", "--typecheck", "try"];
        if (options.url === PRODUCTION_URL && !options.dev) cli.push("--prod");
        process.stderr.write(`applying patches ${i + 1}-${i + chunk.length} of ${patches.length}\n`);
        const run = spawnSync("npx", cli, { cwd: REPO_ROOT, stdio: "inherit", env: process.env });
        if (run.status !== 0) process.exit(run.status ?? 1);
    }
}
main().catch((e) => { console.error(e); process.exit(1); });
