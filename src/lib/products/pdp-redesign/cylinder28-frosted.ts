import type { KitLike } from "./stage";

/** The reviewed Sunburst bodies (jumbo-glass-2026-11-04). Hosted copies: scripts/paperdoll/publish-jumbo28-glass.mjs. */
export const CYLINDER28_CLEAR_BODY_URL = "/reviews/cylinder28-sunburst-2026-11-04/clear-candidate.png";
export const CYLINDER28_FROSTED_BODY_URL = "/reviews/cylinder28-sunburst-2026-11-04/frosted-candidate.png";
const FROSTED_BODY_IMAGE = {
    url: CYLINDER28_FROSTED_BODY_URL, key: "", width: 1024, height: 1536, bytes: 1323294,
    sha256: "829743ec8dcd65fb7d45cce9e7107e7db8f66fa9047514ea995f1b8164287ad5",
};
/** The frosted review image's visible bounds on the clear kit's canvas. */
const FROSTED_BODY_BOX = { x: 194.1256, y: 211.3608, width: 611.1520, height: 886.5801 };

/** 28 ml frosted Cylinder roll-on SKU → the clear SKU with the same roller and cap. */
export const CYLINDER28_CLEAR_TWIN: Record<string, { websiteSku: string; graceSku: string }> = {
    GBCylFrst28MtlRollBlk: { websiteSku: "GBMtlRoll28Blk", graceSku: "GB-CYL-CLR-28ML-MRL-01" },
    GBCylFrst28MtlRollWht: { websiteSku: "GBMtlRoll28Wht", graceSku: "GB-CYL-CLR-28ML-MRL-02" },
    GBCylFrst28RollBlk: { websiteSku: "GBRoll28Blk", graceSku: "GB-CYL-CLR-28ML-RBL" },
    GBCylFrst28RollWht: { websiteSku: "GBCyl1ozRollWht", graceSku: "GB-CYL-CLR-28ML-RBL-WHT" },
};

/**
 * The clear twin's kit with the frosted body, or null unless that kit draws the reviewed clear body.
 * Same roller, cap, canvas and seating; only the body image and its box change. Call it on the review
 * kit (before its images are hosted) so both bodies are swapped as one reviewed pair.
 */
export function frostedFromClearKit<K extends KitLike>(clear: K | null | undefined, sku: string): K | null {
    if (!clear?.parts.some((part) => part.slot === "body" && part.image.url === CYLINDER28_CLEAR_BODY_URL)) return null;
    return {
        ...clear,
        sku,
        register: clear.register ? { ...clear.register, glass: "Frosted", plateKey: `${clear.register.bodyId}|Frosted` } : clear.register,
        parts: clear.parts.map((part) => part.slot === "body" ? {
            ...part,
            box: FROSTED_BODY_BOX,
            image: { ...part.image, ...FROSTED_BODY_IMAGE },
            image2x: null,
        } : part),
    };
}
