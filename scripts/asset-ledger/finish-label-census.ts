/** Which active component SKUs on dev yield no finish label from the reviewed token vocabulary. Read-only. */
import { readFileSync } from "node:fs";
import { getFinishFromWebsiteSku } from "../../src/lib/paper-doll/tokens.generated";
const P = JSON.parse(readFileSync("data/asset-ledger/dev-products-dump.json", "utf8")) as any[];
const comps = P.filter(p => /component/i.test(p.category ?? "") && p.websiteSku && !/__RETIRED__/.test(p.websiteSku));
const nul = comps.filter(p => !getFinishFromWebsiteSku(p.websiteSku)?.label);
console.log(`active components ${comps.length}; no finish label: ${nul.length}`);
for (const p of nul.sort((a, b) => a.websiteSku.localeCompare(b.websiteSku))) console.log(`  ${p.websiteSku.padEnd(34)} capColor=${String(p.capColor ?? "").padEnd(14)} ${p.itemName?.slice(0, 70)}`);
console.log("\nlabels present (sample):"); for (const p of comps.filter(p => getFinishFromWebsiteSku(p.websiteSku)?.label).slice(0, 12)) console.log(`  ${p.websiteSku.padEnd(30)} -> ${getFinishFromWebsiteSku(p.websiteSku)!.label}`);
