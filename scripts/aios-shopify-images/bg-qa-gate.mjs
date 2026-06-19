/**
 * Bone-background QA gate for the Shopify PDP media push.
 *
 * The catalog's original "50% white" problem happened because white-canvas
 * masters were pushed to Shopify with no background check. This gate decodes a
 * candidate PNG, samples its four corners, and classifies the canvas so the push
 * can reject anything that isn't the on-brand cream/bone studio background
 * (#EEE6D4 family, warm) — or a transparent cutout (which blends with the tile).
 *
 * Verdicts:
 *   "pass"   — cream/bone (warm) or transparent → safe to push
 *   "fail"   — white / neutral-light → the offender; reject
 *   "review" — undecodable / dark / saturated / ambiguous → hold for a human
 *
 * Pure Node (zlib only) so the push script keeps zero extra deps.
 */
import zlib from "node:zlib";

function decodePng(buf) {
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not-png");
    let off = 8, W = 0, H = 0, bd = 0, ct = 0, il = 0;
    const idat = []; let plte = null, trns = null;
    while (off < buf.length) {
        const len = buf.readUInt32BE(off);
        const type = buf.toString("ascii", off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (type === "IHDR") { W = data.readUInt32BE(0); H = data.readUInt32BE(4); bd = data[8]; ct = data[9]; il = data[12]; }
        else if (type === "PLTE") plte = data;
        else if (type === "tRNS") trns = data;
        else if (type === "IDAT") idat.push(data);
        else if (type === "IEND") break;
        off += 12 + len;
    }
    if (bd !== 8 || il !== 0) throw new Error(`unsupported png bd=${bd} il=${il}`);
    const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 4 ? 2 : 1;
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = W * ch;
    const rec = Buffer.alloc(H * stride);
    for (let y = 0; y < H; y++) {
        const f = raw[y * (stride + 1)];
        const s = y * (stride + 1) + 1, ro = y * stride, po = (y - 1) * stride;
        for (let x = 0; x < stride; x++) {
            const a = x >= ch ? rec[ro + x - ch] : 0;
            const b = y > 0 ? rec[po + x] : 0;
            const c = x >= ch && y > 0 ? rec[po + x - ch] : 0;
            let v = raw[s + x];
            if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
            else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
            rec[ro + x] = v & 0xff;
        }
    }
    const px = (x, y) => {
        const i = y * stride + x * ch;
        if (ct === 3) { const idx = rec[i]; const al = trns && idx < trns.length ? trns[idx] : 255; return [plte[idx * 3], plte[idx * 3 + 1], plte[idx * 3 + 2], al]; }
        if (ch >= 3) return [rec[i], rec[i + 1], rec[i + 2], ch === 4 ? rec[i + 3] : 255];
        return [rec[i], rec[i], rec[i], ch === 2 ? rec[i + 1] : 255];
    };
    return { W, H, px };
}

const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** Classify a PNG buffer's canvas background. Returns { verdict, bg, corners, reason }. */
export function classifyBackground(buf) {
    let img;
    try { img = decodePng(buf); }
    catch (e) { return { verdict: "review", bg: "undecodable", corners: [], reason: e.message }; }
    const { W, H, px } = img;
    const inset = Math.max(4, Math.round(Math.min(W, H) * 0.02));
    const corners = [px(inset, inset), px(W - 1 - inset, inset), px(inset, H - 1 - inset), px(W - 1 - inset, H - 1 - inset)];
    if (corners.filter((c) => c[3] < 12).length >= 2) return { verdict: "pass", bg: "transparent", corners, reason: "transparent canvas blends with tile" };
    const r = median(corners.map((c) => c[0])), g = median(corners.map((c) => c[1])), b = median(corners.map((c) => c[2]));
    const brightness = Math.min(r, g, b), warmth = r - b;
    const lumaSpread = Math.max(...corners.map((c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2])) - Math.min(...corners.map((c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]));
    const tag = `rgb(${r},${g},${b}) warmth=${warmth} bright=${brightness} grad=${Math.round(lumaSpread)}`;
    if (brightness >= 235 && warmth <= 6) return { verdict: "fail", bg: "white", corners, reason: `neutral-light canvas — ${tag}` };
    if (warmth >= 8 && brightness >= 150) return { verdict: "pass", bg: warmth >= 8 && brightness >= 215 ? "cream/bone" : "warm/tan", corners, reason: `on-brand warm canvas — ${tag}` };
    if (brightness < 60) return { verdict: "review", bg: "dark", corners, reason: `unexpectedly dark canvas — ${tag}` };
    return { verdict: "review", bg: "ambiguous", corners, reason: `neither clearly white nor cream — ${tag}` };
}

/** Fetch a URL and classify its background. Network/format errors → "review". */
export async function gateImageUrl(url, { timeoutMs = 20000 } = {}) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) return { verdict: "review", bg: "fetch-error", corners: [], reason: `HTTP ${res.status}` };
        return classifyBackground(Buffer.from(await res.arrayBuffer()));
    } catch (e) {
        return { verdict: "review", bg: "fetch-error", corners: [], reason: String(e.message || e) };
    }
}

/** Whether a verdict is allowed to push. review passes only when allowReview. */
export function gatePasses(result, { allowReview = false } = {}) {
    return result.verdict === "pass" || (allowReview && result.verdict === "review");
}
