#!/usr/bin/env tsx
/**
 * Close-ups of the cap/shoulder join, composed exactly as the stage draws CAP ON, for a proof sheet.
 *   npx tsx scripts/register/seats/seat-crops.ts <out.png> <graceSku,...> [--raw] [--label "text"] [--deployment dev]
 * --raw draws the closures where compose() alone puts them (before seat-drops.ts).
 */
import fs from "node:fs";
import sharp from "sharp";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { drawableRegisterKits } from "../../../src/lib/register/load";
import type { RegisterStagePayload } from "../../../src/lib/register/stage-kit";
import { setSeatDropsEnabled } from "../../../src/lib/register/seat-drops";

const argv = process.argv.slice(2);
const arg = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const [out, list] = argv;
const URLS: Record<string, string> = { dev: "https://helpful-elephant-638.convex.cloud", prod: "https://precise-raccoon-123.convex.cloud" };
const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const bytes = new Map<string, Buffer>();
const get = async (url: string) => { if (!bytes.has(url)) bytes.set(url, Buffer.from(await (await fetch(url)).arrayBuffer())); return bytes.get(url)!; };

async function main() {
    setSeatDropsEnabled(!argv.includes("--raw"));
    const skus = list.split(",").filter(Boolean);
    const client = new ConvexHttpClient(URLS[arg("--deployment") ?? "prod"]);
    const payload: RegisterStagePayload = { plates: {}, components: {}, bodies: {}, assemblies: {} };
    for (let i = 0; i < skus.length; i += 40) {
        const page = await client.query(anyApi.registerStage.forSkus, { graceSkus: skus.slice(i, i + 40) }) as RegisterStagePayload;
        Object.assign(payload.plates, page.plates); Object.assign(payload.components, page.components);
        Object.assign(payload.bodies, page.bodies); Object.assign(payload.assemblies, page.assemblies);
    }
    const kits = drawableRegisterKits(payload);
    const TW = 300, TH = 260, cols = Math.min(6, skus.length), rows = Math.ceil(skus.length / cols), head = arg("--label") ? 30 : 0;
    const tiles: sharp.OverlayOptions[] = [];
    for (const [i, sku] of skus.entries()) {
        const kit = kits[sku];
        const x0 = (i % cols) * TW, y0 = Math.floor(i / cols) * (TH + 40) + head;
        let caption = `${sku.replace(/^GB-/, "")}  (not drawn)`;
        if (kit) {
            const parts = [...kit.parts].filter((p) => !p.views || p.views.includes("capon")).sort((a, b) => a.zOrder - b.zOrder);
            const PAD = 600, W = kit.canvas.width + 2 * PAD, H = kit.canvas.height + 2 * PAD;
            const layers: sharp.OverlayOptions[] = [];
            for (const p of parts) {
                const img = await sharp(await get(p.image.url)).resize(Math.max(1, Math.round(p.box.width)), Math.max(1, Math.round(p.box.height)), { fit: "fill" }).png().toBuffer();
                layers.push({ input: img, left: Math.round(p.box.x) + PAD, top: Math.round(p.box.y) + PAD });
            }
            const canvas = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 245, g: 243, b: 239, alpha: 1 } } }).composite(layers).png().toBuffer();
            // frame the closure: its width plus 5 mm a side, from 14 mm above the seat to 8 mm below the closure's lowest point
            const px = kit.anchors.pxPerMm ?? 10, cx = kit.anchors.neckAxisX ?? kit.anchors.axisX;
            const closure = parts.filter((p) => p.slot !== "body" && !["roller", "diptube", "internals"].includes(p.slot));
            const half = Math.max(8 * px, ...closure.map((p) => Math.max(cx - p.box.x, p.box.x + p.box.width - cx))) + 5 * px;
            const low = Math.max(kit.anchors.seatY + 10 * px, ...closure.map((p) => Math.min(p.box.y + p.box.height, kit.anchors.seatY + 25 * px)));
            const left = Math.max(0, Math.round(cx - Math.min(half, 22 * px)) + PAD), top = Math.max(0, Math.round(kit.anchors.seatY - 14 * px) + PAD);
            const w = Math.min(W - left, Math.round(2 * Math.min(half, 22 * px))), h = Math.min(H - top, Math.round(low + 8 * px - (kit.anchors.seatY - 14 * px)));
            const tile = await sharp(canvas).extract({ left, top, width: w, height: h }).resize(TW - 6, TH - 6, { fit: "contain", background: { r: 245, g: 243, b: 239, alpha: 1 } }).png().toBuffer();
            tiles.push({ input: tile, left: x0 + 3, top: y0 + 3 });
            caption = `${sku.replace(/^GB-/, "")}  lowered ${(kit.register.seatDropMm ?? 0).toFixed(2)} mm`;
        }
        tiles.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="40"><text x="4" y="16" font-family="Helvetica" font-size="12" fill="#222">${esc(caption)}</text><text x="4" y="32" font-family="Helvetica" font-size="11" fill="#666">${esc(kit?.register.bodyId ?? "")}</text></svg>`), left: x0, top: y0 + TH });
    }
    if (head) tiles.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cols * TW}" height="30"><text x="6" y="21" font-family="Helvetica" font-size="16" fill="#222">${esc(arg("--label")!)}</text></svg>`), left: 0, top: 0 });
    const sheet = await sharp({ create: { width: cols * TW, height: rows * (TH + 40) + head, channels: 4, background: { r: 245, g: 243, b: 239, alpha: 1 } } }).composite(tiles).png().toBuffer();
    fs.writeFileSync(out, sheet);
    console.log("wrote", out);
}
main().catch((error) => { console.error(error); process.exit(1); });
