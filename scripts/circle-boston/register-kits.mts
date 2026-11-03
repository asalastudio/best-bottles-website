/**
 * Read-only: the register kits production draws for every Circle and Boston Round variant
 * (registerStage.forSkus + drawableRegisterKits), plus each SKU's local review kit if a dev file
 * carries one. Usage: npx tsx scripts/circle-boston/register-kits.mts <prod.json> <out.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { drawableRegisterKits } from "../../src/lib/register/load";
import type { RegisterStagePayload } from "../../src/lib/register/stage-kit";

const prod = JSON.parse(readFileSync(process.argv[2], "utf8")) as Array<{ websiteSku: string; graceSku: string }>;
const client = new ConvexHttpClient("https://precise-raccoon-123.convex.cloud");
const kits: Record<string, any> = {};
for (let i = 0; i < prod.length; i += 50) {
    const payload = await client.query(anyApi.registerStage.forSkus, { graceSkus: prod.slice(i, i + 50).map(p => p.graceSku) }) as RegisterStagePayload;
    for (const kit of Object.values(drawableRegisterKits(payload))) if (kit.sku) kits[kit.sku] = kit;
}
writeFileSync(process.argv[3], JSON.stringify(kits));
console.log(Object.keys(kits).length, "register kits of", prod.length);
