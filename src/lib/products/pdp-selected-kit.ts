import { kitMatchesSelectedSku } from "../../../convex/lib/kitStageValidation";

type KitWithSku = {
    sku: string;
    websiteSku?: string | null;
    graceSku?: string | null;
} | null | undefined;

/** A kit is stage capability only when its stored identities match the selected SKU. */
export function resolveSelectedSkuKit<T extends KitWithSku>(
    selected: { websiteSku?: string | null; graceSku?: string | null },
    kit: T,
): T | null {
    return kitMatchesSelectedSku(kit, selected) ? kit : null;
}
