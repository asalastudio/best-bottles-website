export type PdpStageMode = "photo" | "3d" | "exploded" | "dimensions";

export type PdpDimensions = {
    heightWithCap?: string | null;
    heightWithoutCap?: string | null;
    diameter?: string | null;
};

export type PdpStageModeCapabilities = {
    hasApprovedImageOrPlate?: boolean;
    hasApprovedGeometry?: boolean;
    hasReleasedExplodedKit?: boolean;
    dimensions?: PdpDimensions | null;
    photoOnly?: boolean;
    productFamily?: string | null;
};

export type PdpStageModeOption = {
    id: PdpStageMode;
    label: string;
};

const HAS_VALUE = (value: string | null | undefined) => Boolean(value?.trim());

export function hasRealPdpDimensions(dimensions: PdpDimensions | null | undefined): boolean {
    return Boolean(dimensions) && [
        dimensions?.heightWithCap,
        dimensions?.heightWithoutCap,
        dimensions?.diameter,
    ].some(HAS_VALUE);
}

export function getPdpStageModes(capabilities: PdpStageModeCapabilities): PdpStageModeOption[] {
    const photoOnly = capabilities.photoOnly === true
        || capabilities.productFamily?.trim().toLowerCase() === "diva";
    const modes: PdpStageModeOption[] = [];

    if (capabilities.hasApprovedImageOrPlate) modes.push({ id: "photo", label: "Photo" });
    if (capabilities.hasApprovedGeometry && !photoOnly) modes.push({ id: "3d", label: "3D" });
    if (capabilities.hasReleasedExplodedKit) modes.push({ id: "exploded", label: "Exploded" });
    if (hasRealPdpDimensions(capabilities.dimensions)) modes.push({ id: "dimensions", label: "Dimensions" });

    return modes;
}

export function preservePdpStageMode(
    activeMode: PdpStageMode,
    availableModes: readonly PdpStageModeOption[],
): PdpStageMode | null {
    if (availableModes.some((mode) => mode.id === activeMode)) return activeMode;
    if (availableModes.some((mode) => mode.id === "photo")) return "photo";
    return availableModes[0]?.id ?? null;
}
