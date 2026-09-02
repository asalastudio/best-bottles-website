#!/usr/bin/env node
// Snapshot the live plate and kit index for the data audit.
//   node scripts/paperdoll/export-plate-index.mjs -> data/paper-doll/plates-snapshot.json
import { writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) { console.error("NEXT_PUBLIC_CONVEX_URL is not set"); process.exit(1); }
const convex = new ConvexHttpClient(url);

const families = await convex.query(api.productPlates.families, {});
const plates = [];
for (const family of families) {
    let cursor = null;
    for (let page = 0; page < 50; page++) {
        const result = await convex.query(api.productPlates.byFamily, { familyId: family.familyId, cursor, limit: 500 });
        plates.push(...result.page);
        if (result.isDone) break;
        cursor = result.continueCursor;
    }
}
// integrity issues straight from the sweep, so the audit reports what the gate reports
const sweep = async (fn) => {
    let cursor = null, checked = 0; const issues = [];
    for (let page = 0; page < 200; page++) {
        const r = await convex.query(fn, { cursor, pageSize: 200 });
        checked += r.checked; issues.push(...r.issues);
        if (r.isDone) break; cursor = r.continueCursor;
    }
    return { checked, issues };
};
const plateSweep = await sweep(api.productPlates.integrity);
const kitSweep = await sweep(api.productKits.integrity);

const out = { generatedAt: new Date().toISOString(), deployment: url, families, plates, plateIntegrity: plateSweep, kitIntegrity: kitSweep };
writeFileSync("data/paper-doll/plates-snapshot.json", JSON.stringify(out, null, 0).replace(/},{"sku"/g, '},\n{"sku"'));
console.log(`families ${families.length}, plates ${plates.length}, plate issues ${plateSweep.issues.length}, kit rows ${kitSweep.checked}`);
