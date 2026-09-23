import type { BuilderPart } from "./model";

/** Collar-to-glass boundary measured on the exact published 1000 x 1100
 * Cylinder 25 ml PSD layers. Hash matching prevents reuse after artwork changes.
 * Coordinates stay in source space so the existing registration moves both
 * material regions together. Bulb and collar remain opaque above this line. */
const GLASS_START_Y: Readonly<Record<string, number>> = {
    "5e82aaa7e8696571b0c3de135c4a9e5c1264c411ddfd21aa5e41345e68a07dd1": 416,
    "a599761e47d1c0c797db9c79f29fc6338860475d61e61a678f6a09402f9ffc22": 418,
    "ad4df4d26db119752fa301f818f074132ee636b50f21920eefd7f4680bbb6b69": 418,
};

export function dropperGlassStartY(part: BuilderPart): number | undefined {
    if (part.slot !== "pipette" || part.image.width !== 1000 || part.image.height !== 1100) return undefined;
    return GLASS_START_Y[part.image.sha256];
}
