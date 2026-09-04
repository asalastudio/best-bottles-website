/**
 * Mobile PDP presentation state. A view mode decides how the currently
 * configured product is shown; it never touches the resolved SKU, price, or
 * cart payload. "exploded" / "threeD" are deliberately absent from this phase.
 */
export type ProductViewMode = "assembled" | "capOff" | "dimensions";

/** The properties a customer can change one at a time on the mobile PDP. */
export type MobilePickerType = "glass" | "roller" | "capFinish";

export type MobileViewCapabilities = {
    /** A cap-off plate exists, or the kit carries a removable closure part. */
    hasCapOffAsset: boolean;
    /** At least one real dimension field is present for the selected variant. */
    hasDimensions: boolean;
};

export type MobileViewModeOption = { id: ProductViewMode; label: string };

/** Data-driven view rail: a bottle with no removable cap never sees "Cap Off". */
export function getMobileViewModes(caps: MobileViewCapabilities): MobileViewModeOption[] {
    const modes: MobileViewModeOption[] = [
        { id: "assembled", label: caps.hasCapOffAsset ? "Cap On" : "Product" },
    ];
    if (caps.hasCapOffAsset) modes.push({ id: "capOff", label: "Cap Off" });
    if (caps.hasDimensions) modes.push({ id: "dimensions", label: "Dimensions" });
    return modes;
}

/** Keep a stored/previous mode only while the current configuration can render it. */
export function coerceMobileViewMode(mode: ProductViewMode, caps: MobileViewCapabilities): ProductViewMode {
    if (mode === "capOff" && !caps.hasCapOffAsset) return "assembled";
    if (mode === "dimensions" && !caps.hasDimensions) return "assembled";
    return mode;
}

/**
 * The most informative view while a picker is open (PRD §83). `null` means
 * "preserve the customer's current view". Glass keeps the current view unless
 * it is Dimensions, where a glass change would be invisible.
 */
export function preferredViewForPicker(
    picker: MobilePickerType,
    current: ProductViewMode,
    caps: MobileViewCapabilities,
): ProductViewMode | null {
    switch (picker) {
        case "roller":
            return caps.hasCapOffAsset ? "capOff" : "assembled";
        case "capFinish":
            return "assembled";
        case "glass":
            return current === "dimensions" ? "assembled" : null;
    }
}
