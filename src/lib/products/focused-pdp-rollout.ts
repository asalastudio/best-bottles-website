export type FocusedPdpCapabilityInput = {
    hasVariants: boolean;
    hasApprovedPhoto: boolean;
    hasPlate: boolean;
    hasApproved3d: boolean;
    hasReleasedKit: boolean;
    hasDimensions: boolean;
};

export type FocusedPdpCapabilities = {
    canRenderFocusedShell: boolean;
    isPurchasable: boolean;
    hasPhotoMode: boolean;
    has3dMode: boolean;
    hasExplodedMode: boolean;
    hasDimensionsMode: boolean;
    requiresFinderContext: false;
};

/**
 * Resolves the focused PDP from the product group's actual readiness fields.
 * Product identity, including the staged 9 mL Cylinder reference product,
 * deliberately has no bearing on eligibility.
 */
export function resolveFocusedPdpCapabilities({
    hasVariants,
    hasApprovedPhoto,
    hasPlate,
    hasApproved3d,
    hasReleasedKit,
    hasDimensions,
}: FocusedPdpCapabilityInput): FocusedPdpCapabilities {
    const hasApprovedVisual = hasApprovedPhoto || hasPlate;
    const canRenderFocusedShell = hasVariants && hasApprovedVisual;

    return {
        canRenderFocusedShell,
        isPurchasable: hasVariants,
        hasPhotoMode: canRenderFocusedShell,
        has3dMode: canRenderFocusedShell && hasApproved3d,
        hasExplodedMode: canRenderFocusedShell && hasReleasedKit,
        hasDimensionsMode: canRenderFocusedShell && hasDimensions,
        requiresFinderContext: false,
    };
}
