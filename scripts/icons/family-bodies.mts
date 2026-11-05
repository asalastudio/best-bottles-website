/**
 * Read-only: one representative clear glass body photograph per bottle family, for the family shape icons
 * (Jordan, 4 Nov 2026: "the shapes of the bottle as icons" in the Bottle Family filter). For each family it takes the
 * clear SKU of the family's most common size and asks production's register (registerStage.forSkus, read-only) for
 * that SKU's body layer. Writes scripts/icons/family-bodies.json ({ family: { sku, url } }).
 * Usage: npx tsx scripts/icons/family-bodies.mts
 */
import { writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { drawableRegisterKits } from "../../src/lib/register/load";
import type { RegisterStagePayload } from "../../src/lib/register/stage-kit";

const convex = new ConvexHttpClient("https://precise-raccoon-123.convex.cloud");
const rows: any[] = []; let cursor: string | null = null;
for (;;) {
    const page = await convex.query(anyApi.products.getAllForPlates, { limit: 1000, cursor }) as any;
    rows.push(...page.page.filter((p: any) => p.category === "Glass Bottle" && p.family));
    if (page.isDone) break; cursor = page.continueCursor;
}
const byFamily = new Map<string, any[]>();
for (const p of rows) byFamily.set(p.family, [...(byFamily.get(p.family) ?? []), p]);
const out: Record<string, { sku: string; capacityMl: number | null; url: string }> = {};
for (const [family, list] of byFamily) {
    const clear = list.filter(p => /clear/i.test(p.color ?? "")).length ? list.filter(p => /clear/i.test(p.color ?? "")) : list;
    const sizes = new Map<number, number>(); for (const p of clear) sizes.set(p.capacityMl ?? 0, (sizes.get(p.capacityMl ?? 0) ?? 0) + 1);
    const size = [...sizes].sort((a, b) => b[1] - a[1])[0][0];
    const candidates = clear.filter(p => (p.capacityMl ?? 0) === size);
    for (let i = 0; i < candidates.length && !out[family]; i += 25) {
        const payload = await convex.query(anyApi.registerStage.forSkus, { graceSkus: candidates.slice(i, i + 25).map(p => p.graceSku) }) as RegisterStagePayload;
        for (const kit of Object.values(drawableRegisterKits(payload)) as any[]) {
            const body = kit.parts?.find((part: any) => part.slot === "body");
            if (body?.image?.url) { out[family] = { sku: kit.sku, capacityMl: size, url: body.image.url }; break; }
        }
    }
    console.log(family.padEnd(16), out[family] ? `${out[family].sku} (${size} ml)` : "no register body");
}
writeFileSync("scripts/icons/family-bodies.json", JSON.stringify(out, null, 1) + "\n");
