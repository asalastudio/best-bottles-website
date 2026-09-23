import fs from "node:fs";
import { FOUR_FAMILY_COMPONENT_REPAIR as scope, planCircleKitRepair } from "../../convex/repairs/fourFamilyComponents";
import type { BuilderKit } from "../../src/lib/bottle-builder/model";

const dir = "data/repairs/four-family-components-2026-09-22";
const snapshot = JSON.parse(fs.readFileSync(`${dir}/production-before.json`, "utf8"));
const rows: Record<string, BuilderKit> = {};
for (const recipe of scope.kitRoles) {
    const before = snapshot.kits[recipe.sku] as BuilderKit;
    rows[recipe.sku] = { ...before, ...planCircleKitRepair(recipe.sku, before, before.plateSha256) };
}
fs.writeFileSync(`${dir}/local-kits.json`, JSON.stringify({version: scope.version, rows}, null, 2) + "\n");
console.log(`Staged ${Object.keys(rows).length} kits locally; no asset upload or catalog writes.`);
