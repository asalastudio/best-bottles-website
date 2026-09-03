import type { CartItem } from "@/components/CartProvider";
import { resolveChargedUnitPrice } from "@/lib/volumePricing";

type MatrixCatalogProduct = {
    graceSku?: string | null;
    websiteSku?: string | null;
    itemName?: string | null;
    webPrice1pc?: number | null;
    webPrice10pc?: number | null;
    webPrice12pc?: number | null;
    shopifyVariantId?: string | null;
    shopifySellable?: boolean | null;
    capColor?: string | null;
};

export type MatrixCartRow = MatrixCatalogProduct & {
    family?: string | null;
    category?: string | null;
    capacity?: string | null;
    color?: string | null;
    applicator?: string | null;
    neckThreadSize?: string | null;
};

export type MatrixCartComponent = MatrixCatalogProduct;

export type MatrixCartLine = {
    row: MatrixCartRow;
    /** `null` is the customer's explicit Bottle Only choice. */
    component: MatrixCartComponent | null;
    quantity: number;
};

function cartItemFor(
    product: MatrixCatalogProduct,
    quantity: number,
    context: Pick<MatrixCartRow, "family" | "capacity" | "color" | "applicator" | "neckThreadSize">,
    category: string | undefined,
): CartItem {
    const graceSku = product.graceSku?.trim();
    if (!graceSku) throw new Error("This configured item is missing a catalog SKU.");
    const itemName = product.itemName?.trim();
    if (!itemName) throw new Error(`Catalog SKU ${graceSku} is missing an item name.`);

    const shopifyVariantId = product.shopifyVariantId ?? null;
    const shopifySellable = product.shopifySellable ?? null;
    return {
        graceSku,
        itemName,
        quantity,
        unitPrice: resolveChargedUnitPrice(quantity, product),
        checkoutEligible: shopifySellable === false ? false : Boolean(shopifyVariantId),
        shopifyVariantId,
        shopifySellable,
        websiteSku: product.websiteSku ?? null,
        family: context.family ?? undefined,
        capacity: context.capacity ?? undefined,
        color: context.color ?? undefined,
        applicator: context.applicator ?? undefined,
        capColor: product.capColor ?? undefined,
        category,
        neckThreadSize: context.neckThreadSize ?? undefined,
        webPrice1pc: product.webPrice1pc ?? null,
        webPrice10pc: product.webPrice10pc ?? null,
        webPrice12pc: product.webPrice12pc ?? null,
    };
}

/**
 * Converts only the bottle and component records resolved by the Matrix into
 * the same cart contract the PDP uses. It never derives a SKU, price, or
 * compatibility relationship on the client.
 */
export function buildMatrixCartItems(lines: MatrixCartLine[]): CartItem[] {
    return lines.flatMap(({ row, component, quantity }) => {
        if (!Number.isInteger(quantity) || quantity < 1) {
            throw new Error("Each configured item needs a quantity of at least one.");
        }

        const bottle = cartItemFor(row, quantity, row, row.category ?? undefined);
        if (component === null) return [bottle];

        return [
            bottle,
            cartItemFor(component, quantity, row, "Component"),
        ];
    });
}

/**
 * The Matrix order bar and cart handoff must agree on the exact same priced
 * lines. An unknown price remains unknown; it never becomes a zero-price line
 * just to make an eligibility calculation convenient.
 */
export function summarizeMatrixOrder(lines: MatrixCartLine[], minimum: number) {
    const items = buildMatrixCartItems(lines);
    let subtotal = 0;
    let priced = true;
    for (const item of items) {
        if (item.unitPrice == null) {
            priced = false;
            continue;
        }
        subtotal += item.unitPrice * item.quantity;
    }

    return {
        items,
        subtotal,
        priced,
        units: items.reduce((total, item) => total + item.quantity, 0),
        meetsMinimum: priced && subtotal >= minimum,
    };
}
