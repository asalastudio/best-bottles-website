import type { KitPartLike } from "@/lib/products/pdp-redesign/stage";

/** Copper cleanup only. Original PSD source files remain preserved. */
export const CYLINDER25_COPPER_OVERCAP = {
    url: "https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/reviewed-master-media/2026-11-02/e8eb5bb9035ca88d0583c89bca01b3636f4a7ebb1aa3957f01ee2c4a0f277bdd.png",
    key: "reviewed-master-media/2026-11-02/e8eb5bb9035ca88d0583c89bca01b3636f4a7ebb1aa3957f01ee2c4a0f277bdd.png",
    sha256: "e8eb5bb9035ca88d0583c89bca01b3636f4a7ebb1aa3957f01ee2c4a0f277bdd",
    bytes: 1960607, width: 1008, height: 1560,
} as const;

// Register visible copper, excluding the detached white polygons in the source.
const SOURCES = {
    "CMP-LPM-CPR-18-415": { suffix: "overcap-bfba49c70defb6ddc31527dd8e74970467b87043bd83986cf1a9cd9780fcb056.png", left: 43, right: 371, bottom: 635 },
    "CMP-SPR-MTCP-18-415-03": { suffix: "overcap-9c8127ece5a3a9b4f5a8509fb88c6784582d6228f3aa59f56ff6de3a830bbfb9.png", left: 17, right: 345, bottom: 635 },
} as const;
const OUTLINE = { left: 101, top: 154, right: 904, bottom: 1532 };

/** Same visible width, axis and seated bottom; uniform scale in every view. */
export function withCylinder25CopperOvercap<P extends KitPartLike>(parts: P[], bodyId: string): P[] {
    if (bodyId !== "cylinder-25ml-18-415") return parts;
    return parts.map(part => {
        const source = part.componentId ? SOURCES[part.componentId as keyof typeof SOURCES] : undefined;
        if (part.slot !== "overcap" || !part.box || !source || !part.image.url.endsWith(source.suffix)) return part;
        const oldScale = part.box.width / part.image.width;
        const width = (source.right - source.left) * oldScale;
        const axis = part.box.x + (source.left + source.right) / 2 * oldScale;
        const bottom = part.box.y + source.bottom / part.image.height * part.box.height;
        const scale = width / (OUTLINE.right - OUTLINE.left);
        const x = axis - (OUTLINE.left + OUTLINE.right) / 2 * scale;
        const y = bottom - OUTLINE.bottom * scale;
        return { ...part, image: { ...CYLINDER25_COPPER_OVERCAP },
            box: { x, y, width: CYLINDER25_COPPER_OVERCAP.width * scale, height: CYLINDER25_COPPER_OVERCAP.height * scale },
            bounds: { left: axis - width / 2, top: y + OUTLINE.top * scale, right: axis + width / 2, bottom },
        };
    });
}
