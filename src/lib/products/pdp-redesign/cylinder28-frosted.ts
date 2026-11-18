import type { KitLike } from "./stage";

const CLEAR_BODY_URL = "/reviews/cylinder28-sunburst-2026-11-04/clear-candidate.png";
const FROSTED_BODY_URL = "/reviews/cylinder28-sunburst-2026-11-04/frosted-candidate.png";
/** The frosted review image's visible bounds on the clear kit's canvas. */
const FROSTED_BODY_BOX = { x: 194.1256, y: 211.3608, width: 611.1520, height: 886.5801 };

/** 28 ml frosted Cylinder roll-on SKU → the clear SKU with the same roller and cap. */
export const CYLINDER28_CLEAR_TWIN: Record<string, { websiteSku: string; graceSku: string }> = {
    GBCylFrst28MtlRollBlk: { websiteSku: "GBMtlRoll28Blk", graceSku: "GB-CYL-CLR-28ML-MRL-01" },
    GBCylFrst28MtlRollWht: { websiteSku: "GBMtlRoll28Wht", graceSku: "GB-CYL-CLR-28ML-MRL-02" },
    GBCylFrst28RollBlk: { websiteSku: "GBRoll28Blk", graceSku: "GB-CYL-CLR-28ML-RBL" },
    GBCylFrst28RollWht: { websiteSku: "GBCyl1ozRollWht", graceSku: "GB-CYL-CLR-28ML-RBL-WHT" },
};

/** The clear twin's kit with the frosted body, or null unless that kit draws the reviewed clear body. */
export function frostedFromClearKit(clear: KitLike | null | undefined, sku: string): KitLike | null {
    if (!clear?.parts.some((part) => part.slot === "body" && part.image.url === CLEAR_BODY_URL)) return null;
    return {
        ...clear,
        sku,
        parts: clear.parts.map((part) => part.slot === "body" ? {
            ...part,
            box: FROSTED_BODY_BOX,
            image: { ...part.image, url: FROSTED_BODY_URL },
        } : part),
    };
}
