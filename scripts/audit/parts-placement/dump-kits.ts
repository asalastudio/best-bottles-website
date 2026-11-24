/** Read-only: write the kits exactly as the storefront resolves them (all source files merged and
 * patched by approved-component-kits.ts) so analyse.py measures what is drawn, not raw JSON.
 *   npx tsx scripts/audit/parts-placement/dump-kits.ts <out.json> */
import { writeFileSync } from "node:fs";
import { approvedComponentKits } from "../../../src/lib/paper-doll/approved-component-kits";

const rows = approvedComponentKits();
writeFileSync(process.argv[2] ?? "audit/resolved-kits.json", JSON.stringify({ rows }));
console.log(`${Object.keys(rows).length} resolved kits`);
