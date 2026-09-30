#!/usr/bin/env tsx
/**
 * Cap seat audit (Jordan 2026-09-30: "a lot of the caps are sitting too high up on the bottles ... the cap has to sit
 * on the shoulder properly, with its edge resting on the shoulder").
 *
 * For every SKU the register draws, compose its CAP ON picture exactly as the stage does and measure the background
 * showing between the closure's outer edge and the glass under it: at the columns from 75 to 95 % of the closure
 * skirt's half width (the skirt = the run of columns about the neck axis whose bottom stays within 2.5 mm of the
 * lowest skirt row, so a bulb sprayer's hose and bulb do not count), the rows of background between the closure's
 * lowest pixel and the first glass pixel below it. The worst column is the gap. 0 = the edge rests on the glass.
 *
 *   npx tsx scripts/register/seats/audit-seats.ts                      # prod, drops ON: what customers will see
 *   npx tsx scripts/register/seats/audit-seats.ts --raw                # prod, drops OFF: where compose() alone puts them
 *   npx tsx scripts/register/seats/audit-seats.ts --write              # measure --raw and write src/lib/register/seat-drops.generated.json
 *   ... --deployment dev    --out <dir> (default output/seat-audit)
 *   ... --only-body <bodyId>   measure one body; with --write, replace only that body's entries in the table
 *
 * --write lowers every closure whose gap exceeds 0.2 mm by that gap, but no further than keeps its top 0.5 mm above the glass
 * rim. Left where they are (Jordan 2026-09-30): Boston rounds (20-400), whose caps sit on the bead at the top of a long neck
 * as the real bottles do, and the short ribbed caps (13-415 black and white), too short to reach a long neck's shoulder.
 */
import fs from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { drawableRegisterKits } from "../../../src/lib/register/load";
import type { RegisterKit, RegisterStagePayload } from "../../../src/lib/register/stage-kit";
import { SEAT_FIXED_SLOTS } from "../../../src/lib/register/compose";
import { setSeatDropsEnabled } from "../../../src/lib/register/seat-drops";
import { readRegister } from "../registerRows";

const ROOT = resolve(__dirname, "..", "..", "..");
const argv = process.argv.slice(2);
const arg = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const write = argv.includes("--write");
const raw = write || argv.includes("--raw");
const deployment = arg("--deployment") ?? "prod";
const onlyBody = arg("--only-body");
if (argv.includes("--only-body") && (!onlyBody || onlyBody.startsWith("--"))) {
    // without a body id, --write would replace the whole table
    console.error("--only-body needs a body id, e.g. --only-body cylinder-9ml-17-415");
    process.exit(1);
}
const outDir = resolve(ROOT, arg("--out") ?? "output/seat-audit");
const URLS: Record<string, string> = { dev: "https://helpful-elephant-638.convex.cloud", prod: "https://precise-raccoon-123.convex.cloud" };
const MIN_DROP_MM = 0.2;
const RIM_COVER_MM = 0.5;
// Jordan 2026-09-30: "short ribbed caps and boston rounds dont need to be moved". A Boston round's cap sits on the bead of
// a long neck; a short ribbed cap is too short to reach a long 13-415 neck's shoulder and shows some neck (as approved 28 Sep).
const LEFT_ALONE_BODY = (bodyId: string) => bodyId.startsWith("boston-round-");
const SHORT_RIBBED_CAPS = new Set(["CMP-CAP-BLK-S-13-415", "CMP-CAP-WHT-S-13-415"]);
const LEFT_ALONE = (bodyId: string, closure: string) => LEFT_ALONE_BODY(bodyId) || closure.split("+").some((id) => SHORT_RIBBED_CAPS.has(id));

type Alpha = { w: number; h: number; a: Uint8Array };
const bytes = new Map<string, Promise<Buffer>>();
function fetchBytes(url: string): Promise<Buffer> {
    if (!bytes.has(url)) bytes.set(url, (async () => {
        for (let attempt = 0; attempt < 4; attempt++) {
            try { const r = await fetch(url); if (r.ok) return Buffer.from(await r.arrayBuffer()); } catch { /* retry */ }
            await new Promise((done) => setTimeout(done, 500 * (attempt + 1)));
        }
        throw new Error(`fetch failed: ${url}`);
    })());
    return bytes.get(url)!;
}
async function alphaAt(url: string, w: number, h: number): Promise<Alpha> {
    const { data, info } = await sharp(await fetchBytes(url)).resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), { fit: "fill" })
        .ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
    return { w: info.width, h: info.height, a: new Uint8Array(data) };
}

export type SeatMeasure = { gapMm: number | null; maxDropMm: number; skirtHalfMm: number; cx: number; skirtBottomY: number; canvasPxPerMm: number };

/** The visible gap under the closure's edge in one kit's CAP ON picture. */
async function measure(kit: RegisterKit, platePxPerMm: number): Promise<SeatMeasure | null> {
    const parts = [...kit.parts].filter((p) => !p.views || p.views.includes("capon")).sort((a, b) => a.zOrder - b.zOrder);
    const body = parts.find((p) => p.slot === "body");
    if (!body) return null;
    const closure = parts.filter((p) => p.zOrder > body.zOrder && !SEAT_FIXED_SLOTS.has(p.slot) && !(p as { detached?: unknown }).detached);
    if (!closure.length) return null;
    // the frame's own scale: an Elegant photographed body is drawn at a different image scale than its plate
    const pxmm = kit.anchors.pxPerMm ?? (body.box.width / body.image.width) * platePxPerMm;
    const B = await alphaAt(body.image.url, body.box.width, body.box.height);
    const bx = Math.round(body.box.x), by = Math.round(body.box.y);
    const glassAt = (c: number, y: number) => { const u = c - bx, v = y - by; return u >= 0 && u < B.w && v >= 0 && v < B.h && B.a[v * B.w + u] > 128; };
    const bottom = new Map<number, number>();
    for (const p of closure) {
        const A = await alphaAt(p.image.url, p.box.width, p.box.height);
        const px = Math.round(p.box.x), py = Math.round(p.box.y);
        for (let u = 0; u < A.w; u++) for (let v = A.h - 1; v >= 0; v--) {
            if (A.a[v * A.w + u] > 128) { const c = px + u, y = py + v; if (!bottom.has(c) || bottom.get(c)! < y) bottom.set(c, y); break; }
        }
    }
    const cx = Math.round(kit.anchors.neckAxisX ?? kit.anchors.axisX);
    const near: number[] = [];
    for (let c = cx - Math.round(pxmm); c <= cx + Math.round(pxmm); c++) { const v = bottom.get(c); if (v != null) near.push(v); }
    if (!near.length) return null;
    const base = Math.max(...near), tol = 2.5 * pxmm;
    let l = cx, r = cx;
    while (bottom.has(l - 1) && Math.abs(bottom.get(l - 1)! - base) <= tol) l--;
    while (bottom.has(r + 1) && Math.abs(bottom.get(r + 1)! - base) <= tol) r++;
    const skirtHalf = Math.min(cx - l, r - cx);
    const edgeHalf = Math.min(skirtHalf, (body.bounds.right - body.bounds.left) / 2);
    const gaps: number[] = [];
    for (let f = 0.75; f <= 0.951; f += 0.025) for (const side of [-1, 1]) {
        const c = Math.round(cx + side * f * edgeHalf), b0 = bottom.get(c);
        if (b0 == null) continue;
        let y = b0 + 1; const limit = b0 + Math.round(25 * pxmm);
        while (y < limit && !glassAt(c, y)) y++;
        if (y < limit) gaps.push((y - b0 - 1) / pxmm);
    }
    // the closure must keep covering the rim: its top may come down to RIM_COVER_MM above the glass rim's top, no lower
    // (a short ribbed cap on a long 13-415 neck would otherwise show the rim through its top)
    let rimTop = Infinity, closureTop = Infinity;
    for (let c = cx - Math.round(pxmm); c <= cx + Math.round(pxmm); c++) {
        for (let y = by; y < by + B.h; y++) if (glassAt(c, y)) { rimTop = Math.min(rimTop, y); break; }
    }
    for (const p of closure) {
        const A = await alphaAt(p.image.url, p.box.width, p.box.height);
        const px = Math.round(p.box.x), py = Math.round(p.box.y);
        for (let c = cx - Math.round(pxmm); c <= cx + Math.round(pxmm); c++) {
            const u = c - px; if (u < 0 || u >= A.w) continue;
            for (let v = 0; v < A.h; v++) if (A.a[v * A.w + u] > 128) { closureTop = Math.min(closureTop, py + v); break; }
        }
    }
    const maxDropMm = Number.isFinite(rimTop) && Number.isFinite(closureTop) ? Math.max(0, (rimTop - closureTop) / pxmm - RIM_COVER_MM) : 0;
    return { gapMm: gaps.length ? Math.max(...gaps) : null, maxDropMm, skirtHalfMm: skirtHalf / pxmm, cx, skirtBottomY: base, canvasPxPerMm: pxmm };
}

async function main() {
    setSeatDropsEnabled(!raw);
    fs.mkdirSync(outDir, { recursive: true });
    const register = readRegister(resolve(ROOT, "data", "register"));
    const skus = register.assemblies
        .filter((a) => a.buildStatus === "resolved" && !["quarantine", "retired"].includes(a.status) && (!onlyBody || a.bodyId === onlyBody))
        .map((a) => a.graceSku);
    const bySku = new Map(register.assemblies.map((a) => [a.graceSku, a]));
    const client = new ConvexHttpClient(URLS[deployment]);
    const payload: RegisterStagePayload = { plates: {}, components: {}, bodies: {}, assemblies: {} };
    for (let i = 0; i < skus.length; i += 40) {
        const page = await client.query(anyApi.registerStage.forSkus, { graceSkus: skus.slice(i, i + 40) }) as RegisterStagePayload;
        Object.assign(payload.plates, page.plates); Object.assign(payload.components, page.components);
        Object.assign(payload.bodies, page.bodies); Object.assign(payload.assemblies, page.assemblies);
    }
    const kits = drawableRegisterKits(payload);
    const memo = new Map<string, SeatMeasure | null>();
    const rows: Array<Record<string, unknown>> = [];
    for (const sku of skus) {
        const kit = kits[sku];
        const assembly = payload.assemblies[sku];
        if (!kit || !assembly) continue;
        const signature = kit.register.seatSignature ?? null;
        const memoKey = JSON.stringify(kit.parts.filter((p) => !p.views || p.views.includes("capon")).map((p) => [p.image.url, p.box]));
        if (!memo.has(memoKey)) memo.set(memoKey, await measure(kit, payload.plates[assembly.plateKey].pxPerMm));
        const m = memo.get(memoKey);
        const row = bySku.get(sku)!;
        rows.push({ sku, websiteSku: row.websiteSku, bodyId: row.bodyId, plateKey: assembly.plateKey, fitment: row.fitmentType, capColor: row.capColor,
            signature, droppedMm: kit.register.seatDropMm ?? 0, closure: kit.register.componentIds.join("+"), ...(m ?? { gapMm: null }) });
    }
    const name = `${raw ? "raw" : "seated"}${onlyBody ? `-${onlyBody}` : ""}`;
    fs.writeFileSync(resolve(outDir, `${deployment}-${name}.json`), JSON.stringify(rows, null, 1));
    const measured = rows.filter((r) => typeof r.gapMm === "number");
    const band = (g: number) => (g <= 0.2 ? "resting (<=0.2)" : g <= 0.6 ? "0.2-0.6" : g <= 1 ? "0.6-1.0" : g <= 2 ? "1-2" : ">2");
    const bands: Record<string, number> = {};
    for (const r of measured) bands[band(r.gapMm as number)] = (bands[band(r.gapMm as number)] ?? 0) + 1;
    console.log(`${deployment} ${name}: ${rows.length} SKUs drawn, ${measured.length} measured, gaps`, bands);

    if (write) {
        // A Swirl plate is its body's Clear glass with a carved surface: the carve notches the silhouette at the shoulder's
        // outer edge, where the widest gap column falls (9 mL 17-415: 4.6 mm there against 1.7 on Clear, under 1 mm one
        // column in). A Swirl closure takes the gap its Clear twin measured.
        const clearGap = new Map<string, number>();
        for (const r of measured) if ((r.plateKey as string).endsWith("|Clear")) clearGap.set(`${r.bodyId}|${r.closure}`, r.gapMm as number);
        for (const r of measured) {
            const twin = (r.plateKey as string).endsWith("|Swirl") ? clearGap.get(`${r.bodyId}|${r.closure}`) : undefined;
            if (twin !== undefined) r.gapMm = twin;
        }
        const groups = new Map<string, Array<Record<string, unknown>>>();
        for (const r of measured) {
            if (!r.signature || LEFT_ALONE(r.bodyId as string, r.closure as string)) continue;
            const list = groups.get(r.signature as string) ?? [];
            list.push(r); groups.set(r.signature as string, list);
        }
        const entries: Record<string, { dropMm: number; plateKey: string; closure: string; skus: number; limitedByRim?: true }> = {};
        for (const [signature, list] of [...groups].sort()) {
            const gaps = list.map((r) => r.gapMm as number).sort((a, b) => a - b);
            const gap = gaps[Math.floor(gaps.length / 2)];
            const maxDrop = Math.min(...list.map((r) => r.maxDropMm as number));
            const drop = Math.min(gap, maxDrop);
            if (drop > MIN_DROP_MM) entries[signature] = { dropMm: Math.round(drop * 100) / 100, plateKey: list[0].plateKey as string, closure: list[0].closure as string, skus: list.length, ...(maxDrop < gap ? { limitedByRim: true as const } : {}) };
        }
        const file = resolve(ROOT, "src/lib/register/seat-drops.generated.json");
        let rule = `scripts/register/seats/audit-seats.ts --write on ${deployment}: each closure lowered by the background showing under its edge (> ${MIN_DROP_MM} mm) so the edge rests on the shoulder, but never so far that its top comes within ${RIM_COVER_MM} mm of the glass rim (limitedByRim); Boston rounds (20-400) and the short ribbed caps left alone (Jordan 2026-09-30); a Swirl closure takes its Clear twin's gap`;
        let all: Record<string, unknown> = entries;
        if (onlyBody) {
            // keep every other body's entries; this body's are replaced (its old entries name images it no longer draws)
            const previous = JSON.parse(fs.readFileSync(file, "utf8")) as { rule: string; entries: Record<string, { plateKey: string }> };
            const kept = Object.fromEntries(Object.entries(previous.entries).filter(([, e]) => !e.plateKey.startsWith(`${onlyBody}|`)));
            all = Object.fromEntries(Object.entries({ ...kept, ...entries }).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
            const note = `; ${onlyBody} re-measured on ${deployment} ${new Date().toISOString().slice(0, 10)} (a Swirl closure takes its Clear twin's gap)`;
            rule = previous.rule.replace(new RegExp(`; ${onlyBody} re-measured on [^;]*`), "") + note;
        }
        fs.writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), rule, entries: all }, null, 1) + "\n");
        console.log(`wrote ${Object.keys(entries).length} drops (${Object.values(entries).reduce((n, e) => n + e.skus, 0)} SKUs) to ${file}`);
    }
}

main().catch((error) => { console.error(error); process.exit(1); });
