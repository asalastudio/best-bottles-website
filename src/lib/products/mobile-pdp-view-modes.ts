/**
 * Mobile PDP presentation state. A view mode decides how the currently
 * configured product is shown; it never touches the resolved SKU, price, or
 * cart payload. The main stage always shows the assembled bottle; "capOff" is
 * reached from the expanded viewer's segmented control, from Grace, or while
 * the roller picker previews the exposed applicator. Dimensions moved out of
 * the stage into the details disclosures below the configurator.
 */
export type ProductViewMode = "assembled" | "capOff";

/** The properties a customer can change one at a time on the mobile PDP. */
export type MobilePickerType = "glass" | "roller" | "capFinish";

export type MobileViewCapabilities = {
    /** A cap-off plate exists, or the kit carries a removable closure part. */
    hasCapOffAsset: boolean;
};

export type MobileViewModeOption = { id: ProductViewMode; label: string };

/** Data-driven Cap On | Cap Off control: a bottle with no removable cap never sees "Cap Off". */
export function getMobileViewModes(caps: MobileViewCapabilities): MobileViewModeOption[] {
    const modes: MobileViewModeOption[] = [
        { id: "assembled", label: caps.hasCapOffAsset ? "Cap On" : "Product" },
    ];
    if (caps.hasCapOffAsset) modes.push({ id: "capOff", label: "Cap Off" });
    return modes;
}

/** Keep a stored/previous mode only while the current configuration can render it. */
export function coerceMobileViewMode(mode: ProductViewMode, caps: MobileViewCapabilities): ProductViewMode {
    if (mode === "capOff" && !caps.hasCapOffAsset) return "assembled";
    return mode;
}

/**
 * The most informative stage view while a picker is open (PRD §83). `null`
 * means "preserve the current view". Roller exposes the applicator; a cap
 * finish can only be judged with the cap on; glass keeps whatever is shown.
 */
export function preferredViewForPicker(
    picker: MobilePickerType,
    _current: ProductViewMode,
    caps: MobileViewCapabilities,
): ProductViewMode | null {
    switch (picker) {
        case "roller":
            return caps.hasCapOffAsset ? "capOff" : "assembled";
        case "capFinish":
            return "assembled";
        case "glass":
            return null;
    }
}
