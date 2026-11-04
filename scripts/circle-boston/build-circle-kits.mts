/**
 * Local review kits for every Circle SKU the register draws (3 Nov 2026).
 *
 * - Kits come from production's own register path: registerStage.forSkus (read-only) and
 *   drawableRegisterKits, so every component keeps its registered file and placement. The clear and
 *   frosted register bodies already match (outline IoU 0.99), one body per size and glass.
 * - The audit found no Circle kit carrying the scaler: the product page and builder fit the plate to
 *   the stage, so the bottle drew oversized (the 100 ml sprayer left the top of the stage) and
 *   readiness held 15/50/100 ml. Every kit now carries its catalog-scale.generated.json entry:
 *   shoulder-to-foot at targetPct, foot on baselinePct, the landmark at the glass's own neck base.
 * - Circle 30 ml has no register kit; it is built from its PSDs separately.
 *
 * Usage: npx tsx scripts/circle-boston/build-circle-kits.mts <prod.json from production-variants.mts>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { drawableRegisterKits } from "../../src/lib/register/load";
import type { RegisterStagePayload } from "../../src/lib/register/stage-kit";

const OUT = "public/local-kits/circle-masters-2026-11-03";
const scale = JSON.parse(readFileSync("src/lib/register/catalog-scale.generated.json", "utf8")) as Record<string, { targetPct: number; baselinePct: number; source: string }>;
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

/** Rows of the body image above which the neck ends: the first row 15% wider than the neck. */
async function neckBase(url: string): Promise<{ row: number; height: number }> {
    const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const widths: number[] = []; let top = -1;
    for (let y = 0; y < info.height; y++) {
        let n = 0;
        for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 40) n++;
        widths.push(n); if (n && top < 0) top = y;
    }
    const neck = [...widths.slice(top + 15, top + 60)].sort((a, b) => a - b)[22];
    let row = top + 20; while (widths[row] <= neck * 1.15) row++;
    return { row, height: info.height };
}

async function main() {
    const prod = JSON.parse(readFileSync(process.argv[2], "utf8")) as Array<{ family: string; websiteSku: string; graceSku: string }>;
    const circle = prod.filter(p => p.family === "Circle");
    const convex = new ConvexHttpClient("https://precise-raccoon-123.convex.cloud");
    const kits: Record<string, any> = {};
    for (let i = 0; i < circle.length; i += 50) {
        const payload = await convex.query(anyApi.registerStage.forSkus, { graceSkus: circle.slice(i, i + 50).map(p => p.graceSku) }) as RegisterStagePayload;
        for (const kit of Object.values(drawableRegisterKits(payload))) if (kit.sku) kits[kit.sku] = kit;
    }
    const necks = new Map<string, { row: number; height: number }>();
    const rows: Record<string, any> = {}; const missing: string[] = [];
    for (const v of circle) {
        const kit = kits[v.websiteSku];
        const target = kit && scale[kit.register?.bodyId];
        if (!kit || !target) { missing.push(v.websiteSku); continue; }
        const body = kit.parts.find((p: any) => p.slot === "body");
        if (!necks.has(body.image.url)) necks.set(body.image.url, await neckBase(body.image.url));
        const n = necks.get(body.image.url)!;
        const box = body.box ?? { x: 0, y: 0, width: kit.canvas.width, height: kit.canvas.height };
        kit.glassSizing = { heightPct: target.targetPct, baselinePct: target.baselinePct,
            landmarkY: Math.round((box.y + n.row * box.height / n.height) * 100) / 100, source: target.source };
        rows[v.websiteSku] = kit;
    }
    mkdirSync(OUT, { recursive: true });
    const version = sha(JSON.stringify(rows)).slice(0, 12);
    writeFileSync(`${OUT}/kits.json`, JSON.stringify({ version, rows, defaultPdpSkus: Object.keys(rows) }, null, 1) + "\n");
    console.log(`built ${Object.keys(rows).length} Circle kits, missing ${missing.length}: ${missing.join(", ")}; version ${version}`);
}

main().catch(e => { console.error(e); process.exit(1); });
