/**
 * Flat stills of the four 1 ml plug vials (25 Nov 2026), drawn from their approved kits exactly as the catalog card's
 * master draws them: the same stage layout ("sidecar"), the same catalog viewport, the same parts, boxes, opacity and
 * blend. They replace the 27 Sep assembled photographs (old glass) wherever a still is needed before or without the
 * master: the card's server-painted placeholder, product page fallbacks, Line items, cap-dot previews and the mobile
 * sticky thumb. Compositing only: no generated imagery, no Hub spend. Each layer is a repository file or the public
 * Blob file the approved kit already names (read only).
 *
 * Every pixel is computed over the bone stage (#f5f3ef) the master draws on, then kept only where some layer has
 * coverage, so the still matches the master on bone and is transparent elsewhere.
 * Usage: npx tsx --conditions=react-server scripts/diva-vial/one-ml-composites.mts
 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { approvedComponentKit } from "@/lib/paper-doll/approved-component-kits";
import { catalogTasselViewport, stageLayout } from "@/lib/products/pdp-redesign/stage";

const SKUS = ["GB1mlAmbVBlk", "GB1mlAmbVialWht", "GB1mlVBlk", "GB1mlVWht"] as const;
const OUT = "public/images/pdp/one-ml-small-glass-2026-11-25";
const WIDTH = 1200;                         // 10:11, the card frame
const BONE = [245, 243, 239];

async function layerFile(url: string): Promise<Buffer> {
    if (url.startsWith("/")) return fs.readFileSync(`public${url}`);
    const response = await fetch(url);
    if (!response.ok) throw Error(`${url}: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
}

fs.mkdirSync(OUT, { recursive: true });
const manifest: Record<string, { url: string; sha256: string; width: number; height: number; layers: string[] }> = {};
for (const sku of SKUS) {
    const kit = approvedComponentKit(sku);
    if (!kit) throw Error(`No approved kit for ${sku}`);
    const layout = stageLayout(kit, "sidecar", { websiteSku: sku });
    if (!layout) throw Error(`No sidecar layout for ${sku}`);
    const { canvas } = layout;
    const viewport = catalogTasselViewport(sku, layout);
    const scale = WIDTH / viewport.width;
    const height = Math.round(viewport.height * scale);
    const color = new Float32Array(WIDTH * height * 3);
    for (let i = 0; i < WIDTH * height; i++) color.set(BONE, i * 3);
    const coverage = new Float32Array(WIDTH * height);
    for (const part of layout.parts) {
        if (part.clipBottomPct !== undefined || part.maskImage) throw Error(`${sku}: ${part.slot} needs a clip or mask, not handled`);
        const x = (((part.box?.leftPct ?? 0) + part.dxPct) / 100 * canvas.width - viewport.x) * scale;
        const y = (((part.box?.topPct ?? 0) + part.dyPct) / 100 * canvas.height - viewport.y) * scale;
        const w = (part.box?.widthPct ?? 100) / 100 * canvas.width * scale;
        const h = (part.box?.heightPct ?? 100) / 100 * canvas.height * scale;
        const source = sharp(await layerFile(part.url)).ensureAlpha();
        const meta = await source.metadata();
        // SVG <image> default preserveAspectRatio: xMidYMid meet.
        const fit = Math.min(w / meta.width!, h / meta.height!);
        const dw = Math.max(1, Math.round(meta.width! * fit)), dh = Math.max(1, Math.round(meta.height! * fit));
        const left = Math.round(x + (w - dw) / 2), top = Math.round(y + (h - dh) / 2);
        const { data } = await source.resize(dw, dh, { kernel: "lanczos3" }).raw().toBuffer({ resolveWithObject: true });
        const opacity = part.opacity ?? 1;
        for (let r = 0; r < dh; r++) {
            const py = top + r; if (py < 0 || py >= height) continue;
            for (let c = 0; c < dw; c++) {
                const px = left + c; if (px < 0 || px >= WIDTH) continue;
                const s = (r * dw + c) * 4, a = data[s + 3] / 255 * opacity;
                if (!a) continue;
                const d = (py * WIDTH + px) * 3;
                for (let k = 0; k < 3; k++) {
                    const top = data[s + k];
                    const mixed = part.blendMode === "multiply" ? color[d + k] * top / 255 : top;
                    color[d + k] = color[d + k] * (1 - a) + mixed * a;
                }
                coverage[py * WIDTH + px] = 1 - (1 - coverage[py * WIDTH + px]) * (1 - a);
            }
        }
    }
    const rgba = Buffer.alloc(WIDTH * height * 4);
    for (let i = 0; i < WIDTH * height; i++) {
        const a = coverage[i];
        // Straight alpha: the colour over bone at this coverage, un-mixed from the bone behind it.
        for (let k = 0; k < 3; k++) rgba[i * 4 + k] = a > 0 ? Math.max(0, Math.min(255, Math.round((color[i * 3 + k] - BONE[k] * (1 - a)) / a))) : 0;
        rgba[i * 4 + 3] = Math.round(a * 255);
    }
    const png = await sharp(rgba, { raw: { width: WIDTH, height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
    const sha = createHash("sha256").update(png).digest("hex");
    const url = `/${OUT.replace(/^public\//, "")}/${sku}.${sha.slice(0, 12)}.png`;
    for (const old of fs.readdirSync(OUT).filter(name => name.startsWith(`${sku}.`))) fs.rmSync(`${OUT}/${old}`);
    fs.writeFileSync(`public${url}`, png);
    manifest[sku] = { url, sha256: sha, width: WIDTH, height, layers: layout.parts.map(part => part.url) };
    console.log(sku, url, `${WIDTH}x${height}`);
}
// The 1 ml hero rows (Line items, cart, finder, Grace workspace, PDP fallbacks) showed the old glass too: they now
// name the still of the same SKU. Identity framing (the still is already framed); the old photo's cap-swap framing is
// not carried over, since the cap no longer sits where it did.
const heroSwaps: Record<string, { table: string; from: string; to: string }[]> = {};
for (const table of ["src/lib/products/catalog-hero-vials-release.json", "src/lib/products/catalog-heroes.json"]) {
    const text = fs.readFileSync(table, "utf8");
    const rows = JSON.parse(text) as Array<Record<string, unknown> & { websiteSku: string; url: string }>;
    let changed = false;
    for (const row of rows) {
        const still = manifest[row.websiteSku];
        if (!still || !["vial-1ml-amber-Plug", "vial-1ml-clear-Plug"].includes(row.groupSlug as string)) continue;
        if (row.url !== still.url) {
            (heroSwaps[row.websiteSku] ??= []).push({ table, from: row.url, to: still.url });
            Object.assign(row, { url: still.url, width: still.width, height: still.height, framing: { scale: 1, translateXPercent: 0, translateYPercent: 0 } });
            changed = true;
        }
    }
    if (!changed) continue;
    // Keep each table's own formatting (catalog-heroes.json escapes non-ASCII, as Python wrote it).
    let out = JSON.stringify(rows, null, 2);
    if (/\\u[0-9a-f]{4}/.test(text)) out = out.replace(/[\u007f-￿]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
    fs.writeFileSync(table, out + "\n");
}
const previous = fs.existsSync(`${OUT}/manifest.json`) ? JSON.parse(fs.readFileSync(`${OUT}/manifest.json`, "utf8")) as { heroSwaps?: typeof heroSwaps } : {};
// A re-run finds the rows already pointing at the stills: keep the recorded original photos.
const recorded = Object.keys(heroSwaps).length ? heroSwaps : previous.heroSwaps ?? {};
fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ stills: manifest, heroSwaps: recorded }, null, 1) + "\n");
