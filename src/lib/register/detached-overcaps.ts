/**
 * Overcaps that look different off the bottle. A clear overcap's register
 * layer was cut from the capped photograph, so it carries the pump and collar
 * seen through the cover: right seated on the bottle (CAP ON), but parked
 * beside the glass (SIDECAR, EXPLODED, Build Your Bottle with the cover off)
 * it reads as a second pump (Jordan 2026-09-27). The master library's cap-off
 * photograph stands the empty cover beside the bottle as its own layer; it is
 * cut by scripts/register/cut_detached_overcap.py and drawn at the seated
 * cover's width. Keyed by component and by the seated layer's image, so a
 * re-cut register layer drops the override instead of mis-sizing it.
 */
import type { DetachedLook } from "@/lib/products/kit-frame";

type DetachedOvercap = {
    /** The seated overcap layer this stands in for (its image's sha256). */
    seatedLayerSha256: string;
    /** The cover's width in the seated layer's own pixels (its top half, above the collar). */
    seatedCoverWidth: number;
    url: string;
    width: number;
    height: number;
    /** The cover's width in this image's pixels. */
    coverWidth: number;
    source: string;
};

export const DETACHED_OVERCAPS: Readonly<Record<string, DetachedOvercap>> = {
    // The 18-415 matte silver lotion pump with the clear overcap: every LtnClOvrCap SKU (26 on 20 glasses).
    "CMP-LPM-MSLV-18-415-02": {
        seatedLayerSha256: "c4d4b9daf52cfda14d1e92d111a8c19467beadf960e1cfb558f7ed466e7966a3",
        seatedCoverWidth: 287,
        url: "/assets/register/overcaps/ltn-18-415-clear-overcap.webp",
        width: 299,
        height: 346,
        coverWidth: 293,
        source: "BB-PSD-Files-Master/2.  18-415 Bottles /14. Slim 30ml/1. Slim 30ml PSD/27. LBSlm30LtnClOvrCap.psd, layer 'Layer 19'",
    },
};

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The empty cover for a seated overcap part, at the seated cover's width,
 * centred on it and standing where it stands (only its size matters once it
 * is parked or lifted); null for every other part.
 */
export function detachedOvercap(part: {
    slot: string;
    componentId: string | null;
    image: { url: string; width: number };
    box: { x: number; y: number; width: number; height: number };
}): DetachedLook | null {
    const entry = part.slot === "overcap" && part.componentId ? DETACHED_OVERCAPS[part.componentId] : undefined;
    if (!entry || !part.image.url.includes(`${entry.seatedLayerSha256}.png`) || part.image.width <= 0) return null;
    const scale = (part.box.width / part.image.width) * (entry.seatedCoverWidth / entry.coverWidth);
    const width = entry.width * scale;
    const height = entry.height * scale;
    const x = part.box.x + part.box.width / 2 - width / 2;
    const y = part.box.y + part.box.height - height;
    const box = { x: round(x), y: round(y), width: round(width), height: round(height) };
    return {
        image: { url: entry.url, width: entry.width, height: entry.height },
        box,
        bounds: { left: box.x, top: box.y, right: round(x + width), bottom: round(y + height) },
    };
}
