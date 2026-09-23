/** Read-only check of the reviewed 13-415 sheet against one Convex deployment.
 * Run: npx tsx scripts/audit-13-415-components.ts /tmp/neck-13-415-audit
 * The caller chooses the output directory so an environment-specific snapshot
 * cannot accidentally masquerade as production catalog truth in Git.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { COMPONENTS_13_415 } from "../convex/component13_415Catalog";

config({ path: ".env.local", quiet: true });
const endpoint = process.env.NEXT_PUBLIC_CONVEX_URL;
const out = process.argv[2];
if (!endpoint || !out) throw new Error("Pass an output directory and configure NEXT_PUBLIC_CONVEX_URL");

const examples = [
    ["Cylinder 5 mL", "GBCyl5BlkSht"],
    ["Tulip 5 mL", "GBTulipAmb5BlkSht"],
    ["Sleek 5 mL", "GBSleek5BlkSht"],
    ["Tulip 6 mL", "GBTulip6BlkSht"],
    ["Sleek 8 mL", "GBSleek8BlkSht"],
    ["Pillar 9 mL", "GBPillar9BlkShSht"],
    ["Tall Cylinder 9 mL", "GBTallCyl9BlkSht"],
    ["Bell 10 mL", "GBBell10BlkShSht"],
    ["Rectangle 10 mL", "GBRect10BlkSht"],
    ["Tall Rectangle 10 mL", "GBTallRect10BlkSht"],
    ["Royal 13 mL", "GBRoyal13BlkSht"],
    ["Circle 15 mL", "GBCrcl15BlkSht"],
    ["Elegant 15 mL", "GBElg15BlkSht"],
    ["Flair 15 mL", "GBFlair15BlkSht"],
    ["Square 15 mL", "GBSqr15BlkSht"],
] as const;

const client = new ConvexHttpClient(endpoint);
type Product = {
    websiteSku: string; graceSku: string; category: string; family: string | null;
    neckThreadSize: string | null; componentGroup?: string | null; itemName: string;
    stockStatus: string | null; shopifyVariantId?: string | null;
};
async function product(sku: string): Promise<Product | null> {
    const result = await client.query(api.products.lookupSku, { sku });
    return result?.product ?? null;
}
function csv(rows: string[][]): string {
    return rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n") + "\n";
}
async function main() {
const components: string[][] = [["group", "website_sku", "grace_sku", "catalog_status", "component_group", "name", "stock_status", "shopify_variant", "review_note"]];
for (const identity of COMPONENTS_13_415) {
    const found = await product(identity.websiteSku);
    const identityMatches = found?.graceSku === identity.graceSku && found.category === "Component" && found.neckThreadSize === "13-415";
    const status = !found ? "missing_loose_component" : !identityMatches ? "identity_mismatch" : /__RETIRED__/i.test(found.websiteSku) ? "retired" : "cataloged";
    components.push([identity.kind, identity.websiteSku, identity.graceSku, status, found?.componentGroup ?? "", found?.itemName ?? "", found?.stockStatus ?? "", found?.shopifyVariantId ?? "",
        !found && identity.kind === "short-lined" ? "Exact assembled bottle SKUs exist; do not invent a loose sellable variant" : ""]);
}
for (const material of ["Plastic", "Metal"]) {
    components.push(["roller-insert", "", "", "unverified_loose_sku", "", `${material} roller insert`, "", "", "Sheet identifies the part, but no exact standalone 13-415 SKU was verified"]);
}
const bottles: string[][] = [["format", "example_sku", "catalog_status", "family", "neck", "category", "review_note"]];
for (const [format, sku] of examples) {
    const found = await product(sku);
    const status = !found ? "missing" : found.neckThreadSize !== "13-415" || found.category !== "Glass Bottle" ? "identity_mismatch" : "cataloged";
    bottles.push([format, sku, status, found?.family ?? "", found?.neckThreadSize ?? "", found?.category ?? "", "Example identity check only; component seating and tube length need exact assembly evidence"]);
}
await mkdir(out, { recursive: true });
await Promise.all([
    writeFile(path.join(out, "components.csv"), csv(components)),
    writeFile(path.join(out, "bottle-formats.csv"), csv(bottles)),
    writeFile(path.join(out, "snapshot.json"), JSON.stringify({ checkedAt: new Date().toISOString(), endpoint, componentCount: components.length - 1, formatCount: bottles.length - 1 }, null, 2) + "\n"),
]);
process.stdout.write(`${components.length - 1} component/material rows and ${bottles.length - 1} bottle formats checked in ${out}\n`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
