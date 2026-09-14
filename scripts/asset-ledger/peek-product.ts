/** Print the lifecycle fields of products by SKU. Usage: npx tsx scripts/asset-ledger/peek-product.ts [--prod] [--components] SKU... */
import { readFileSync } from "node:fs"; import path from "node:path";
import { ConvexHttpClient } from "convex/browser"; import { api } from "../../convex/_generated/api";
const root = process.cwd();
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
async function main() {
    const args = process.argv.slice(2); const prod = args.includes("--prod"); const comps = args.includes("--components");
    const c = new ConvexHttpClient(prod ? "https://precise-raccoon-123.convex.cloud" : process.env.NEXT_PUBLIC_CONVEX_URL!);
    for (const sku of args.filter(a => !a.startsWith("--"))) {
        const r: any = await c.query(api.products.lookupSku, { sku }); const p = r?.product;
        if (!p) { console.log(`${sku.padEnd(28)} NONE`); continue; }
        console.log(`${sku.padEnd(28)} grace=${p.graceSku} neck=${p.neckThreadSize} cat=${p.category} stock=${p.stockStatus} variant=${p.shopifyVariantId ?? "null"} inv=${p.shopifyInventoryItemId ?? "null"} sellable=${p.shopifySellable} price=${p.webPrice1pc} group=${p.productGroupId ?? "-"} src=${p.importSource} img=${p.imageUrl ? "y" : "n"} | ${p.itemName?.slice(0, 50)}`);
        if (comps) console.log("  components:", JSON.stringify(p.components).slice(0, 1500));
    }
}
main().catch(e => { console.error(e); process.exit(1); });
