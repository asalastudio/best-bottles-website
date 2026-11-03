/**
 * Local review kits for every 60 ml and 100 ml Elegant SKU (3 Nov 2026).
 *
 * - Kits come from production's own register path: registerStage.forSkus (read-only) and
 *   drawableRegisterKits, so every component keeps its registered file and placement. The 24
 *   60 ml reducer kits keep their reviewed local reducer part from elegant60-reducer-2026-10-31.
 * - One body master per size and glass. The 60 ml clear master is the Sunburst r3 regeneration of the
 *   register plate (regenerate-clear.py: the candidate's body was filled white, Jordan "fake"), its
 *   edges within 1-3 px of the plate. 100 ml clear uses the new candidate, which matches the approved
 *   register plate (outline IoU 0.980 at 60 ml, 0.986 at 100 ml; neck, shoulder and base within
 *   about one point). Frosted uses the Sunburst r2 bodies (regenerate-frosted.py): registered
 *   uniformly onto the register plate (outline IoU 0.974 / 0.969, every row width within 0.6% of
 *   the height) and cut with the plate's own alpha.
 * - Every body, the reducer kits' included, is placed uniformly on the stage datum: neck top on
 *   seatY, foot on baselineY, centred on axisX, where the register plates already sit. Never stretched.
 * - Every kit carries the scaler (catalog-scale.generated.json): shoulder-to-foot 47% (60 ml) or
 *   57% (100 ml), foot on 91%, landmark at the glass's own neck base. Without it the product page
 *   and builder fit the plate, which is what made the 30 ml masters oversized.
 *
 * Closures are seated on the shoulder, and the tubes drawn, by universal-dip-tube-60-100.py.
 *
 * Usage: npx tsx scripts/elegant-masters/build-60-100-kits.mts <elegant-prod.json>
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import sharp from "sharp";
import { anyApi } from "convex/server";
const api = anyApi;
import { drawableRegisterKits } from "../../src/lib/register/load";
import type { RegisterStagePayload } from "../../src/lib/register/stage-kit";

const OUT = "public/local-kits/elegant60-100-masters-2026-11-03";
const CANDIDATES: Record<string, string> = {
    "elegant-60ml-18-415|Clear": "public/reviews/elegant-master-candidates-2026-11-03/elegant60-clear-master-r3.png",
    "elegant-100ml-18-415|Clear": "public/reviews/elegant-master-candidates-2026-11-03/elegant100-clear-candidate.png",
    "elegant-60ml-18-415|Frosted": "public/reviews/elegant-master-candidates-2026-11-03/elegant60-frosted-candidate-r2.png",
    "elegant-100ml-18-415|Frosted": "public/reviews/elegant-master-candidates-2026-11-03/elegant100-frosted-candidate-r2.png",
};
const BODIES = ["elegant-60ml-18-415", "elegant-100ml-18-415"];
const scale = JSON.parse(readFileSync("src/lib/register/catalog-scale.generated.json", "utf8")) as Record<string, { targetPct: number; baselinePct: number; source: string }>;
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

type Outline = { top: number; bottom: number; left: number; right: number; neckBase: number; width: number; height: number };
async function outline(file: string): Promise<Outline> {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const widths: number[] = []; let top = -1, bottom = -1, left = info.width, right = 0;
    for (let y = 0; y < info.height; y++) {
        let n = 0;
        for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 40) { n++; left = Math.min(left, x); right = Math.max(right, x); }
        widths.push(n); if (n) { if (top < 0) top = y; bottom = y; }
    }
    const neck = [...widths.slice(top + 15, top + 60)].sort((a, b) => a - b)[22];
    let neckBase = top + 20; while (widths[neckBase] <= neck * 1.15) neckBase++;
    return { top, bottom, left, right: right + 1, neckBase, width: info.width, height: info.height };
}

async function main() {
    const prod = JSON.parse(readFileSync(process.argv[2], "utf8")) as Array<{ sku: string; grace: string; slug: string }>;
    const wanted = prod.filter(v => /^elegant-(60|100)ml-/.test(v.slug)).map(v => v.grace);
    const convex = new ConvexHttpClient("https://precise-raccoon-123.convex.cloud");
    const kits: Record<string, any> = {};
    for (let i = 0; i < wanted.length; i += 50) {
        const payload = await convex.query(api.registerStage.forSkus, { graceSkus: wanted.slice(i, i + 50) }) as RegisterStagePayload;
        for (const kit of Object.values(drawableRegisterKits(payload))) if (kit.sku) kits[kit.sku] = kit;
    }
    const reducers = JSON.parse(readFileSync("public/local-kits/elegant60-reducer-2026-10-31/kits.json", "utf8")).rows as Record<string, any>;
    for (const [sku, kit] of Object.entries(reducers)) kits[sku] = structuredClone(kit);

    mkdirSync(OUT, { recursive: true });
    const masters: Record<string, { image: any; outline: Outline }> = {};
    for (const [key, file] of Object.entries(CANDIDATES)) {
        const bytes = readFileSync(file); const name = `body-${key.replace("|", "-").toLowerCase()}.${sha(bytes).slice(0, 12)}.png`;
        copyFileSync(file, `${OUT}/${name}`);
        const o = await outline(file);
        masters[key] = { outline: o, image: { url: `/local-kits/elegant60-100-masters-2026-11-03/${name}`, key: "", sha256: sha(bytes), bytes: bytes.length, width: o.width, height: o.height } };
    }

    // Any glass without a candidate keeps its approved register body, taken from its first register kit.
    for (const kit of Object.values(kits) as any[]) {
        const key = `${kit.register?.bodyId}|${kit.register?.glass}`;
        const body = kit.parts.find((p: any) => p.slot === "body");
        if (masters[key] || !BODIES.includes(kit.register?.bodyId) || !body?.image.url.startsWith("http")) continue;
        const file = `/tmp/claude-elegant-body-${sha(Buffer.from(body.image.url)).slice(0, 12)}`;
        writeFileSync(file, Buffer.from(await (await fetch(body.image.url)).arrayBuffer()));
        masters[key] = { outline: await outline(file), image: { ...body.image } };
    }

    const rows: Record<string, any> = {}; const report: any[] = []; const missing: string[] = [];
    for (const v of prod.filter(v => /^elegant-(60|100)ml-/.test(v.slug))) {
        const kit = kits[v.sku];
        if (!kit || !BODIES.includes(kit.register?.bodyId)) { missing.push(v.sku); continue; }
        const master = masters[`${kit.register.bodyId}|${kit.register.glass}`];
        if (!master) { missing.push(v.sku); continue; }
        // Every kit draws its glass on the stage datum: the neck top on seatY, the foot on baselineY,
        // centred on axisX. That is where the register plates already sit (outline 261-1061 at x 500),
        // so the components keep their seats; the reducer kits' r5 bodies are replaced the same way.
        const body = kit.parts.find((p: any) => p.slot === "body");
        const { axisX, seatY, baselineY } = kit.register.datum;
        const o = master.outline, s = (baselineY - seatY) / (o.bottom - o.top);
        body.box = { x: axisX - (o.left + o.right) / 2 * s, y: seatY - o.top * s, width: o.width * s, height: o.height * s };
        body.bounds = { left: body.box.x + o.left * s, top: seatY, right: body.box.x + o.right * s, bottom: baselineY };
        body.image = { ...master.image }; body.image2x = null; body.mask = null;
        kit.plateSha256 = master.image.sha256;
        const target = scale[kit.register.bodyId];
        kit.glassSizing = { heightPct: target.targetPct, baselinePct: target.baselinePct, landmarkY: Math.round((body.box.y + o.neckBase * s) * 100) / 100, source: target.source };
        rows[v.sku] = kit;
        report.push({ sku: v.sku, slug: v.slug, glass: kit.register.glass, body: body.image.url.split("/").pop(), slots: kit.parts.map((p: any) => p.slot).join("+"), landmarkY: kit.glassSizing.landmarkY });
    }
    const version = sha(Buffer.from(JSON.stringify(rows))).slice(0, 12);
    writeFileSync(`${OUT}/kits.json`, JSON.stringify({ version, rows, defaultPdpSkus: Object.keys(rows) }, null, 1) + "\n");
    writeFileSync(`${OUT}/build-report.json`, JSON.stringify({ version, built: report.length, missing, rows: report }, null, 1) + "\n");
    console.log(`built ${report.length} kits, missing ${missing.length}: ${missing.join(", ")}; version ${version}`);
}

main().catch(e => { console.error(e); process.exit(1); });
