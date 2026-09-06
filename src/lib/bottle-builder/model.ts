import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import type { CartItem } from "@/components/CartProvider";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { resolveChargedUnitPrice } from "@/lib/volumePricing";

export type CatalogRow = FunctionReturnType<typeof api.matrix.getFamilyRows>["rows"][number];
export type BuilderKit = NonNullable<FunctionReturnType<typeof api.productKits.forSku>>;
export type BuilderPart = BuilderKit["parts"][number];
export type BuilderConfiguration = {
    id: string;
    bodyId: string;
    family: string;
    capacityMl: number;
    neck: string;
    color: string;
    fitment: string;
    closure: string;
    kit: BuilderKit;
    product: CartItem;
    caseQuantity: number | null;
};
export type BuilderBody = {
    id: string;
    family: string;
    capacityMl: number;
    neck: string;
    configurations: BuilderConfiguration[];
};
export type BuilderSelection = {
    bodyId: string | null;
    color: string | null;
    fitment: string | null;
    closure: string | null;
    quantity: number;
};
export const ORDER_MINIMUM = 50;
export const MAX_QUANTITY = 1_000_000;
export const emptySelection = (): BuilderSelection => ({ bodyId: null, color: null, fitment: null, closure: null, quantity: 12 });
const slug = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "-");
const closureSlots = new Set(["cap", "overcap"]);
export const isClosurePart = (part: BuilderPart) => closureSlots.has(part.slot);

/** Uses the already resolved compatibility result from convex/matrix.ts.
 * A complete, orderable assembly is the purchase unit: never charge a second
 * loose component on top of an assembly that already includes that component.
 */
export function isBuilderCandidate(row: CatalogRow): boolean {
    return row.resolution !== "unknown"
        && Object.values(row.components).some(parts => parts.length > 0)
        && Boolean(row.graceSku && row.websiteSku && row.itemName && row.family && row.color && row.neckThreadSize)
        && /bottle|vial/i.test(row.category ?? "")
        && Boolean(row.capacityMl && row.capacityMl > 0)
        && Boolean(row.shopifyVariantId) && row.shopifySellable !== false
        && !/out of stock|discontinued|unavailable/i.test(row.stockStatus ?? "")
        && typeof row.webPrice1pc === "number" && Number.isFinite(row.webPrice1pc) && row.webPrice1pc > 0;
}

/** A capSplit body may contain its roller/pump. Only a cap-only assembly's
 * split is a bare bottle; other mechanisms require a full separated kit. */
export function configurationFromRow(row: CatalogRow, kit: BuilderKit | null): BuilderConfiguration | null {
    if (!isBuilderCandidate(row) || !kit || kit.conflicts.length
        || (kit.sku !== row.websiteSku && kit.sku !== row.graceSku)) return null;
    const app = row.applicator?.trim();
    const capOnly = app === "Cap/Closure" || ((!app || app === "N/A") && /\bcap\b/i.test(row.itemName ?? ""));
    if (kit.completeness !== "full" && !(capOnly && kit.completeness === "capSplit")) return null;
    const body = kit.parts.find(part => part.slot === "body");
    if (!body || !kit.parts.some(part => part.slot !== "body")) return null;
    if (body.derivation !== "psd-layer" && body.derivation !== "madison") return null;
    if (!kit.parts.every(part => part.image.width === kit.canvas.width && part.image.height === kit.canvas.height
        && part.image.url.startsWith("https://") && part.assembled.x === 0 && part.assembled.y === 0
        && part.bounds.right > part.bounds.left && part.bounds.bottom > part.bounds.top)) return null;
    if (!(kit.anchors.baselineY > kit.anchors.seatY && kit.anchors.seatY >= 0
        && kit.anchors.baselineY <= kit.canvas.height)) return null;
    const { family, color, capacityMl, neckThreadSize: neck } = row;
    // Fail closed on catalog/asset identity drift, including capacity aliases.
    const suffix = `-${slug(color!)}-${slug(neck!)}`;
    if (!kit.familyId.endsWith(suffix) || !kit.familyId.includes(`-${capacityMl}ml-`)) return null;
    // Short Cylinder 5.5 ml is an unresolved imported identity, not a new body.
    if (family === "Cylinder" && capacityMl === 5.5) return null;
    const fitment = capOnly ? "Screw Cap" : app === "Metal Roller Ball" ? "Metal Roller"
        : app === "Plastic Roller Ball" ? "Plastic Roller" : app === "Perfume Spray Pump" ? "Perfume Sprayer" : app;
    if (!fitment || fitment === "N/A") return null;
    const mechanism = kit.parts.filter(part => part.slot !== "body" && !isClosurePart(part));
    if (!capOnly && mechanism.length === 0) return null;
    const name = getCustomerFacingProductName({ variant: row });
    const closure = name.variantLabel;
    if (!closure) return null;
    return {
        id: row.websiteSku!, bodyId: `${kit.familyId.slice(0, -suffix.length)}|${neck}|${row.category}`,
        family: family!, capacityMl: capacityMl!, neck: neck!, color: color!, fitment, closure, kit,
        caseQuantity: row.caseQuantity && row.caseQuantity > 0 ? row.caseQuantity : null,
        product: {
            graceSku: row.graceSku!, websiteSku: row.websiteSku, itemName: name.displayName,
            shopifyVariantId: row.shopifyVariantId, shopifySellable: row.shopifySellable,
            checkoutEligible: true, productGroupSlug: row.productGroupSlug, quantity: 1,
            unitPrice: row.webPrice1pc, webPrice1pc: row.webPrice1pc,
            webPrice10pc: row.webPrice10pc, webPrice12pc: row.webPrice12pc,
            family: family!, capacity: `${capacityMl} ml`, color: color!, applicator: row.applicator,
            capColor: row.capColor, category: row.category, neckThreadSize: neck,
        },
    };
}

export function groupBuilderBodies(configurations: BuilderConfiguration[]): BuilderBody[] {
    const groups = new Map<string, BuilderBody>();
    const identities = new Map<string, BuilderConfiguration[]>();
    for (const config of configurations) {
        const key = JSON.stringify([config.bodyId, config.color, config.fitment, config.closure]);
        identities.set(key, [...(identities.get(key) ?? []), config]);
    }
    // Ambiguous selection tuples must not silently choose an arbitrary SKU.
    for (const entries of identities.values()) {
        const unique = [...new Map(entries.map(config => [config.id, config])).values()];
        if (unique.length !== 1) continue;
        const config = unique[0];
        const group = groups.get(config.bodyId) ?? {
            id: config.bodyId, family: config.family, capacityMl: config.capacityMl, neck: config.neck, configurations: [],
        };
        group.configurations.push(config);
        groups.set(group.id, group);
    }
    for (const body of groups.values()) body.configurations.sort((a, b) =>
        (a.color === b.color ? 0 : a.color === "Clear" ? -1 : b.color === "Clear" ? 1 : a.color.localeCompare(b.color))
        || a.fitment.localeCompare(b.fitment) || a.closure.localeCompare(b.closure));
    return [...groups.values()].sort((a, b) => a.capacityMl - b.capacityMl || a.neck.localeCompare(b.neck));
}

export function deriveBuilder(bodies: BuilderBody[], state: BuilderSelection) {
    const body = bodies.find(body => body.id === state.bodyId) ?? null;
    const configurations = body?.configurations ?? [];
    const colors = [...new Set(configurations.map(config => config.color))];
    const color = colors.includes(state.color ?? "") ? state.color : null;
    const colored = configurations.filter(config => config.color === color);
    const fitments = [...new Set(colored.map(config => config.fitment))];
    const fitment = fitments.includes(state.fitment ?? "") ? state.fitment : null;
    const fitted = colored.filter(config => config.fitment === fitment);
    const closures = [...new Set(fitted.map(config => config.closure))];
    const closure = closures.includes(state.closure ?? "") ? state.closure : null;
    const matches = fitted.filter(config => config.closure === closure);
    const configuration = matches.length === 1 ? matches[0] : null;
    return { body, colors, color, colored, fitments, fitment, fitted, closures, closure, configuration };
}

/** Reconcile at each transition, preserving downstream values only where an
 * exact currently available configuration still supports them. */
export function reconcileSelection(bodies: BuilderBody[], state: BuilderSelection): BuilderSelection {
    const next = { ...state };
    let derived = deriveBuilder(bodies, next);
    if (!derived.body) return { ...emptySelection(), quantity: state.quantity };
    next.color = derived.color ?? (derived.colors.length === 1 ? derived.colors[0] : null);
    derived = deriveBuilder(bodies, next);
    next.fitment = derived.fitment;
    next.closure = deriveBuilder(bodies, next).closure;
    const closures = deriveBuilder(bodies, next).closures;
    if (!next.closure && closures.length === 1) next.closure = closures[0];
    return next;
}

export function previewParts(config: BuilderConfiguration, stage: "body" | "fitment" | "complete"): BuilderPart[] {
    return [...config.kit.parts].filter(part => stage === "complete" || part.slot === "body"
        || (stage === "fitment" && !isClosurePart(part))).sort((a, b) => a.zOrder - b.zOrder);
}

export function builderCartItem(config: BuilderConfiguration, quantity: number): CartItem {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw new Error("Enter a valid whole-number quantity.");
    const unitPrice = resolveChargedUnitPrice(quantity, config.product);
    if (unitPrice == null || !Number.isFinite(unitPrice) || unitPrice <= 0 || !config.product.shopifyVariantId
        || config.product.shopifySellable === false) throw new Error("This combination is no longer available.");
    return { ...config.product, quantity, unitPrice };
}

/** Match the cart's merged-SKU pricing, in cents, including any tier change. */
export function builderOrder(config: BuilderConfiguration | null, quantity: number, cart: CartItem[]) {
    const validQuantity = Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY;
    const otherCents = cart.filter(item => item.graceSku !== config?.product.graceSku && item.checkoutEligible !== false
        && item.shopifySellable !== false && Boolean(item.shopifyVariantId))
        .reduce((sum, item) => sum + Math.round((resolveChargedUnitPrice(item.quantity, {
            ...item, webPrice1pc: item.webPrice1pc ?? item.unitPrice,
        }) ?? 0) * 100) * item.quantity, 0);
    const existingQuantity = cart.find(item => item.graceSku === config?.product.graceSku)?.quantity ?? 0;
    const priceAt = (qty: number) => config ? resolveChargedUnitPrice(qty + existingQuantity, config.product) : null;
    const totalAt = (qty: number) => otherCents + Math.round((priceAt(qty) ?? 0) * 100) * (qty + existingQuantity);
    const unitPrice = validQuantity ? priceAt(quantity) : null;
    const total = unitPrice == null ? null : Math.round(unitPrice * 100) * quantity / 100;
    // Search pricing intervals, including lower rates at quantity breaks.
    const breaks = [1, 10, 12, ...(config?.product.priceTiers ?? []).map(t => t.minQty)]
        .map(q => Math.max(1, q - existingQuantity));
    let minimumQuantity: number | null = null;
    if (config) for (const start of [...new Set(breaks)].sort((a, b) => a - b)) {
        const cents = Math.round((priceAt(start) ?? 0) * 100);
        if (cents <= 0) continue;
        const required = Math.max(start, Math.ceil((ORDER_MINIMUM * 100 - otherCents) / cents) - existingQuantity, 1);
        if (required <= MAX_QUANTITY && totalAt(required) >= ORDER_MINIMUM * 100
            && (minimumQuantity === null || required < minimumQuantity)) minimumQuantity = required;
    }
    return { unitPrice, total, minimumQuantity, validQuantity,
        remainingUnits: minimumQuantity === null ? null : Math.max(0, minimumQuantity - (validQuantity ? quantity : 0)),
        canAdd: Boolean(config && validQuantity && unitPrice && totalAt(quantity) >= ORDER_MINIMUM * 100),
        cartCredit: otherCents / 100 + (config ? Math.round((priceAt(0) ?? 0) * 100) * existingQuantity / 100 : 0),
    };
}
