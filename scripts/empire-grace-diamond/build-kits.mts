/**
 * Local review kits for every Empire 50/100, Grace 55 and Diamond 60 ml SKU (Jordan, 4 Nov 2026: "let's start on
 * reconciling and fixing Empire, Grace, and Diamond"). The build Circle and Diva used (scripts/circle-boston/
 * build-circle-kits.mts, scripts/diva-vial/build-kits.mts):
 *
 * - Kits come from production's own register path: registerStage.forSkus (read-only) and drawableRegisterKits, so
 *   every component keeps its registered file and placement.
 * - Every kit carries its catalog-scale.generated.json entry (shoulder-to-foot at targetPct, foot on baselinePct)
 *   with the landmark at the glass's own neck base (Circle's rule: the first row 15% wider than the neck).
 * - Live (4 Nov): the perfume-spray and lotion-pump pages draw from the register with SIDECAR / CAP ON / EXPLODED;
 *   the reducer, vintage bulb, bulb-with-tassel and dropper pages show no view controls. This lists, per page,
 *   which SKUs the register can draw and which it cannot.
 *
 * Read-only against production. Writes public/local-kits/egd-masters-2026-11-04/kits.json and coverage.json.
 * Usage: npx tsx scripts/empire-grace-diamond/build-kits.mts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { drawableRegisterKits } from "../../src/lib/register/load";
import type { RegisterStagePayload } from "../../src/lib/register/stage-kit";

const OUT = "public/local-kits/egd-masters-2026-11-04";
const FAMILIES = ["Empire", "Grace", "Diamond"];
const scale = JSON.parse(readFileSync("src/lib/register/catalog-scale.generated.json", "utf8")) as Record<string, { targetPct: number; baselinePct: number; source: string }>;
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

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
    const convex = new ConvexHttpClient("https://precise-raccoon-123.convex.cloud");
    const prod: any[] = []; let cursor: string | null = null;
    for (;;) {
        const page = await convex.query(anyApi.products.getAllForPlates, { limit: 1000, cursor }) as any;
        for (const p of page.page) if (FAMILIES.includes(p.family) && p.category !== "Component") prod.push(p);
        if (page.isDone) break; cursor = page.continueCursor;
    }
    const groups = Object.fromEntries((await convex.query(anyApi.products.getAllGroupsForPlates, {}) as any[]).map(g => [g._id, g.slug]));
    const kits: Record<string, any> = {};
    for (let i = 0; i < prod.length; i += 50) {
        const payload = await convex.query(anyApi.registerStage.forSkus, { graceSkus: prod.slice(i, i + 50).map(p => p.graceSku) }) as RegisterStagePayload;
        for (const kit of Object.values(drawableRegisterKits(payload))) if (kit.sku) kits[kit.sku] = kit;
    }
    const necks = new Map<string, { row: number; height: number }>();
    const rows: Record<string, any> = {};
    const coverage: Record<string, { drawn: string[]; missing: string[] }> = {};
    for (const v of prod) {
        const page = groups[v.productGroupId] ?? "(no page)";
        const c = coverage[page] ??= { drawn: [], missing: [] };
        const kit = kits[v.websiteSku];
        const target = kit && scale[kit.register?.bodyId];
        if (!kit || !target) { c.missing.push(v.websiteSku); continue; }
        const body = kit.parts.find((p: any) => p.slot === "body");
        if (!necks.has(body.image.url)) necks.set(body.image.url, await neckBase(body.image.url));
        const n = necks.get(body.image.url)!;
        const box = body.box ?? { x: 0, y: 0, width: kit.canvas.width, height: kit.canvas.height };
        kit.glassSizing = { heightPct: target.targetPct, baselinePct: target.baselinePct,
            landmarkY: Math.round((box.y + n.row * box.height / n.height) * 100) / 100, source: target.source };
        kit.reviewMaster = "egd-2026-11-04";
        rows[v.websiteSku] = kit; c.drawn.push(v.websiteSku);
    }
    // The register draws no kit for the two white-pump clear-overcap lotions; each starts from its glass's clear-overcap
    // lotion kit (same glass, sizing and cover), and psd-heads.py replaces head and cover from its own parked PSD
    // (21. Empire 50ml / 56-57. LBEmp50WhtClOvrCp, 22. Empire Bottle 100ml / 51-52. LBEmp100WhtClOvrCp).
    const TWINS: Record<string, string> = { LBEmp50WhtClOvrCp: "LBEmp50LtnClOvrCap", LBEmp100WhtClOvrCp: "LBEmp100LtnClOvrCap" };
    for (const [sku, twin] of Object.entries(TWINS)) {
        const v = prod.find(p => p.websiteSku === sku), c = coverage[groups[v?.productGroupId] ?? ""];
        if (!v || rows[sku] || !rows[twin] || !c) continue;
        rows[sku] = { ...structuredClone(rows[twin]), sku, twinOf: twin };
        c.missing = c.missing.filter(s => s !== sku); c.drawn.push(sku);
    }
    mkdirSync(OUT, { recursive: true });
    const version = sha(JSON.stringify(rows)).slice(0, 12);
    writeFileSync(`${OUT}/kits.json`, JSON.stringify({ version, rows, defaultPdpSkus: Object.keys(rows) }, null, 1) + "\n");
    writeFileSync(`${OUT}/coverage.json`, JSON.stringify(coverage, null, 1) + "\n");
    for (const [page, c] of Object.entries(coverage).sort()) console.log(`${page.padEnd(48)} drawn ${String(c.drawn.length).padStart(2)}  missing ${String(c.missing.length).padStart(2)} ${c.missing.slice(0, 4).join(" ")}`);
    console.log(`built ${Object.keys(rows).length} of ${prod.length} kits (${Object.values(rows).filter((r: any) => r.twinOf).length} from a twin); version ${version}`);
}

main().catch(e => { console.error(e); process.exit(1); });
