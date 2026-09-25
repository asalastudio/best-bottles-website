#!/usr/bin/env node
/**
 * Add cap-off views to PRODUCTION plate rows that already have an approved cap-on plate.
 *
 * promote-plates-to-prod.mjs is additive per SKU and leaves any SKU with a prod row
 * alone, so cap-off views published to dev for an existing plate never reach customers.
 * This tool adds ONLY the two cap-off assets (and the cap-off PSD hash) to a prod row:
 *   - the prod row's front must still be the bytes the batch was built against;
 *   - the prod row must not carry a cap-off view yet;
 *   - the dev row must already index exactly these cap-off assets (the dev ship);
 *   - every asset URL is HEAD-verified on the public store before anything is written.
 * Both deployments read the same public store, so this is an index write only.
 *
 *   node scripts/asset-ledger/add-capoff-to-prod.mjs --manifest <cap-off manifest>            # dry run
 *   node scripts/asset-ledger/add-capoff-to-prod.mjs --manifest <cap-off manifest> --apply --ship "<phrase>"
 *
 * Env: BEST_BOTTLES_CONVEX_WRITE_TOKEN must be PRODUCTION's write token for --apply
 * (`npx convex env get BEST_BOTTLES_CONVEX_WRITE_TOKEN --prod`).
 */
import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";

const DEV_URL = "https://helpful-elephant-638.convex.cloud";
const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const SHIP_PHRASE = "add cap-off views to the production plate index";
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const manifestPath = value("--manifest");
const apply = flag("--apply");
const ship = value("--ship");
if (!manifestPath) throw new Error("--manifest <path> is required");
if (apply && ship !== SHIP_PHRASE) throw new Error(`refusing to write: --apply needs --ship "${SHIP_PHRASE}"`);
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (apply && !writeToken) throw new Error("BEST_BOTTLES_CONVEX_WRITE_TOKEN (production) is not set");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const rows = manifest.rows.filter((r) => r.plateCapOff && r.thumbCapOff);
if (!rows.length) throw new Error("the manifest has no rows with a cap-off view");
const skus = rows.map((r) => r.websiteSku);
const dev = new ConvexHttpClient(DEV_URL);
const prod = new ConvexHttpClient(PROD_URL);
const [devPlates, prodPlates] = await Promise.all([
    dev.query("productPlates:forSkus", { skus }),
    prod.query("productPlates:forSkus", { skus }),
]);
const shaOf = (url) => (url ?? "").split("/").pop().split(".")[0];
async function head(url) {
    try { const res = await fetch(url, { method: "HEAD" }); return res.ok && (res.headers.get("content-type") || "").startsWith("image/webp"); } catch { return false; }
}

const entries = [];
const held = [];
for (const row of rows) {
    const sku = row.websiteSku;
    const d = devPlates.plates?.[sku] ?? null;
    const p = prodPlates.plates?.[sku] ?? null;
    const problems = [];
    if (!p) problems.push("no prod row (use promote-plates-to-prod.mjs for new SKUs)");
    else {
        if (shaOf(p.image) !== row.plate.sha256) problems.push(`prod front ${shaOf(p.image).slice(0, 12)} is not the batch front ${row.plate.sha256.slice(0, 12)}`);
        if (p.imageCapOff) problems.push("prod already has a cap-off view");
    }
    if (!d) problems.push("no dev row");
    else if (shaOf(d.imageCapOff) !== row.plateCapOff.sha256) problems.push("dev does not index this cap-off (ship it to dev first)");
    if (!problems.length) {
        // The dev row is the authority for the URLs: they were HEAD-verified when it was written.
        const frontCapOff = { url: d.imageCapOff, key: row.plateCapOff.storeKey, sha256: row.plateCapOff.sha256, bytes: row.plateCapOff.bytes, width: row.plateCapOff.width, height: row.plateCapOff.height };
        const thumbCapOff = { url: d.thumbCapOff, key: row.thumbCapOff.storeKey, sha256: row.thumbCapOff.sha256, bytes: row.thumbCapOff.bytes, width: row.thumbCapOff.width, height: row.thumbCapOff.height };
        if (!frontCapOff.url.endsWith(`/${frontCapOff.key}`)) problems.push("dev cap-off URL does not end with the batch store key");
        if (!thumbCapOff.url.endsWith(`/${thumbCapOff.key}`)) problems.push("dev cap-off thumb URL does not end with the batch store key");
        if (!problems.length && !(await head(frontCapOff.url) && await head(thumbCapOff.url))) problems.push("cap-off asset not reachable on the public store");
        if (!problems.length) entries.push({ sku, expectFrontSha256: row.plate.sha256, frontCapOff, thumbCapOff, psdSha256CapOff: row.plateCapOff.sourceSha256 ?? null });
    }
    if (problems.length) held.push({ sku, problems });
}

console.log(`${apply ? "APPLY" : "DRY RUN"} → ${PROD_URL}: ${entries.length} row(s) to gain a cap-off view, ${held.length} held`);
for (const h of held) console.log(`  held ${h.sku}: ${h.problems.join("; ")}`);
for (let i = 0; i < entries.length; i += 50) {
    const slice = entries.slice(i, i + 50);
    const results = apply
        ? await prod.mutation("productPlates:addCapOffViews", { writeToken, dryRun: false, entries: slice })
        : slice.map((e) => ({ sku: e.sku, outcome: "would-add" }));
    for (const r of results) console.log(`  ${r.outcome} ${r.sku}${r.reason ? ` (${r.reason})` : ""}`);
}
if (!apply && entries.length) console.log(`To write: --apply --ship "${SHIP_PHRASE}" with production's write token in BEST_BOTTLES_CONVEX_WRITE_TOKEN`);
if (held.length) process.exitCode = 1;
