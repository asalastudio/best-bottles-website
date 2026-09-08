export type FocusedProductKind = "bottle" | "giftBag" | "giftBox" | "funnel" | "accessory";

export type FocusedProductPresentation = {
    kind: FocusedProductKind;
    configureHeading: string;
    configureHint: string;
    optionLabel: string;
    optionTitle: string;
    optionHint: string;
};

type FocusedProductVariantIdentity = {
    capColor?: string | null;
    color?: string | null;
    itemName?: string | null;
    websiteSku?: string | null;
};

const BOTTLE_PRESENTATION: FocusedProductPresentation = {
    kind: "bottle",
    configureHeading: "Configure this bottle",
    configureHint: "Tap a row to change an option. The bottle updates above.",
    optionLabel: "Closure Finish",
    optionTitle: "Select Closure Finish",
    optionHint: "Bottle updates above in real time.",
};

/**
 * Product copy must come from the catalog identity, not from the default
 * closure inferred from a URL. Packaging and accessories can share the same
 * variant picker mechanics as bottles without being described as bottles.
 */
export function focusedProductPresentation(
    category: string | null | undefined,
    family: string | null | undefined,
): FocusedProductPresentation {
    const identity = `${category ?? ""} ${family ?? ""}`.toLowerCase();

    if (identity.includes("gift bag") || /\bbag\b/.test(identity)) {
        return {
            kind: "giftBag",
            configureHeading: "Choose your bag",
            configureHint: "Tap a row to change an option. The bag updates above.",
            optionLabel: "Bag Color",
            optionTitle: "Select Bag Color",
            optionHint: "Bag updates above in real time.",
        };
    }

    if (identity.includes("gift box") || /\bbox\b/.test(identity)) {
        return {
            kind: "giftBox",
            configureHeading: "Choose your box",
            configureHint: "Tap a row to change an option. The box updates above.",
            optionLabel: "Box Option",
            optionTitle: "Select Box Option",
            optionHint: "Box updates above in real time.",
        };
    }

    if (identity.includes("funnel") || identity.includes("accessory tool")) {
        return {
            kind: "funnel",
            configureHeading: "Choose your funnel",
            configureHint: "Tap a row to change an option. The funnel updates above.",
            optionLabel: "Funnel Material",
            optionTitle: "Select Funnel Material",
            optionHint: "Funnel updates above in real time.",
        };
    }

    if (/packaging|accessor|funnel|tool|component|cap|closure/.test(identity)) {
        return {
            kind: "accessory",
            configureHeading: "Choose your product",
            configureHint: "Tap a row to change an option. The product updates above.",
            optionLabel: "Product Option",
            optionTitle: "Select Product Option",
            optionHint: "Product updates above in real time.",
        };
    }

    return BOTTLE_PRESENTATION;
}

/** Customer-facing option identity for non-bottle variants sharing a PDP. */
export function focusedProductOptionLabel(
    presentation: FocusedProductPresentation,
    variant: FocusedProductVariantIdentity,
): string | null {
    if (presentation.kind === "bottle") return null;

    // Packaging records inherited the legacy capColor field even though the
    // customer-facing value is the bag color.
    const color = variant.color?.trim() || variant.capColor?.trim();
    const identity = `${variant.websiteSku ?? ""} ${variant.itemName ?? ""} ${color ?? ""}`.toLowerCase();

    if (presentation.kind === "funnel") {
        if (identity.includes("plastic")) return "Plastic";
        if (identity.includes("silver")) return "Silver Metal";
        if (identity.includes("gold") || identity.includes("brass")) return "Brass";
    }

    if (presentation.kind === "giftBag") {
        const sizeMatch = variant.itemName?.match(/(?:size\s*:\s*)?([0-9.]+)\s*(?:inches|["\\])?\s*(?:x|tall\s*x?)\s*([0-9.]+)/i);
        const size = sizeMatch ? `${sizeMatch[1]} × ${sizeMatch[2]} in` : null;
        if (color && size) return `${color} · ${size}`;
    }

    if (color && !["n/a", "none", "standard", "default"].includes(color.toLowerCase())) return color;
    return variant.itemName?.trim() || null;
}
