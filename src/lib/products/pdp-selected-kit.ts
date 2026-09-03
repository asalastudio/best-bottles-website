type KitWithSku = { sku: string } | null | undefined;

/** A kit is stage capability only when its stored SKU is the selected SKU. */
export function resolveSelectedSkuKit<T extends KitWithSku>(
    selected: { websiteSku?: string | null; graceSku?: string | null },
    kit: T,
): T | null {
    if (!kit?.sku) return null;
    const selectedSkus = [selected.websiteSku, selected.graceSku].filter((value): value is string => Boolean(value?.trim()));
    return selectedSkus.includes(kit.sku) ? kit : null;
}
