import {
    PAPER_DOLL_CANVAS,
    PAPER_DOLL_CANVAS_PRESET,
} from "./contract";

export const PAPER_DOLL_PDP_CANVAS = PAPER_DOLL_CANVAS;
export const PAPER_DOLL_PDP_CANVAS_PRESET = PAPER_DOLL_CANVAS_PRESET;

export type StorefrontPaperDollLayer = {
    _key: string;
    slot: string;
    variantKey: string;
    sourceFilename?: string;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    offsetX?: number;
    offsetY?: number;
};

export type StorefrontPaperDollFamily = {
    _id: string;
    familyKey: string;
    displayName: string;
    canvasPreset: typeof PAPER_DOLL_PDP_CANVAS_PRESET;
    canvasWidth: number;
    canvasHeight: number;
    pipelineVersion: string;
    assetRevision: string;
    storefrontReady: true;
    layerOrderRollon: string[];
    layerOrderSpray: string[];
    layerOrderShortcap: string[];
    layerOrderLotion: string[];
    anchorsJson?: string;
    layerAssets: StorefrontPaperDollLayer[];
};

export type PaperDollValidationResult =
    | { ok: true; family: StorefrontPaperDollFamily; issues: [] }
    | { ok: false; issues: string[] };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function selectStorefrontPaperDollReleaseCandidate(value: unknown): unknown {
    if (!isRecord(value)) return value;
    const hasReleaseReference = cleanString(value.currentReleaseReference).length > 0;
    if (hasReleaseReference) return value.currentRelease;
    return isRecord(value.currentRelease) ? value.currentRelease : value;
}

function cleanString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map(cleanString).filter(Boolean);
}

function numericValue(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

function isSanityImageUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname === "cdn.sanity.io";
    } catch {
        return false;
    }
}

function parseLayer(value: unknown, index: number, issues: string[]): StorefrontPaperDollLayer | null {
    if (!isRecord(value)) {
        issues.push(`layerAssets[${index}] must be an object`);
        return null;
    }

    const slot = cleanString(value.slot);
    const variantKey = cleanString(value.variantKey);
    const label = `${slot || `layerAssets[${index}]`}:${variantKey || "?"}`;
    const imageUrl = cleanString(value.imageUrl);
    const imageWidth = numericValue(value.imageWidth);
    const imageHeight = numericValue(value.imageHeight);

    if (!slot) issues.push(`layerAssets[${index}].slot is required`);
    if (!variantKey) issues.push(`layerAssets[${index}].variantKey is required`);
    if (!imageUrl) {
        issues.push(`${label} is missing its Sanity image URL`);
    } else if (!isSanityImageUrl(imageUrl)) {
        issues.push(`${label} image URL must use https://cdn.sanity.io`);
    }
    if (imageWidth !== PAPER_DOLL_PDP_CANVAS.width || imageHeight !== PAPER_DOLL_PDP_CANVAS.height) {
        issues.push(
            `${label} asset must be ${PAPER_DOLL_PDP_CANVAS.width}×${PAPER_DOLL_PDP_CANVAS.height}; received ${Number.isNaN(imageWidth) ? "?" : imageWidth}×${Number.isNaN(imageHeight) ? "?" : imageHeight}`,
        );
    }

    if (!slot || !variantKey) return null;

    return {
        _key: cleanString(value._key) || `${slot}-${variantKey}-${index}`,
        slot,
        variantKey,
        sourceFilename: cleanString(value.sourceFilename) || undefined,
        imageUrl,
        imageWidth,
        imageHeight,
        offsetX: Number.isFinite(value.offsetX) ? Number(value.offsetX) : undefined,
        offsetY: Number.isFinite(value.offsetY) ? Number(value.offsetY) : undefined,
    };
}

export function validateStorefrontPaperDollFamily(value: unknown): PaperDollValidationResult {
    const issues: string[] = [];
    if (!isRecord(value)) return { ok: false, issues: ["paperDollFamily must be an object"] };

    const familyKey = cleanString(value.familyKey);
    const displayName = cleanString(value.displayName);
    const pipelineVersion = cleanString(value.pipelineVersion);
    const assetRevision = cleanString(value.assetRevision);
    const canvasWidth = numericValue(value.canvasWidth);
    const canvasHeight = numericValue(value.canvasHeight);

    if (!familyKey) issues.push("familyKey is required");
    if (!displayName) issues.push("displayName is required");
    if (value.canvasPreset !== PAPER_DOLL_PDP_CANVAS_PRESET) {
        issues.push(`canvasPreset must be ${PAPER_DOLL_PDP_CANVAS_PRESET}`);
    }
    if (canvasWidth !== PAPER_DOLL_PDP_CANVAS.width || canvasHeight !== PAPER_DOLL_PDP_CANVAS.height) {
        issues.push(
            `canvas must be ${PAPER_DOLL_PDP_CANVAS.width}×${PAPER_DOLL_PDP_CANVAS.height}; received ${Number.isNaN(canvasWidth) ? "?" : canvasWidth}×${Number.isNaN(canvasHeight) ? "?" : canvasHeight}`,
        );
    }
    if (!pipelineVersion) issues.push("pipelineVersion is required");
    if (!assetRevision) issues.push("assetRevision is required");
    if (value.storefrontReady !== true) issues.push("storefrontReady must be true");

    const layerOrderRollon = stringArray(value.layerOrderRollon);
    const layerOrderSpray = stringArray(value.layerOrderSpray);
    const layerOrderShortcap = stringArray(value.layerOrderShortcap);
    const layerOrderLotion = stringArray(value.layerOrderLotion);
    const orderEntries = [
        ["layerOrderRollon", layerOrderRollon],
        ["layerOrderSpray", layerOrderSpray],
        ["layerOrderShortcap", layerOrderShortcap],
        ["layerOrderLotion", layerOrderLotion],
    ] as const;
    if (!orderEntries.some(([, order]) => order.length > 0)) {
        issues.push("at least one layer order is required");
    }

    const rawLayers = Array.isArray(value.layerAssets) ? value.layerAssets : [];
    if (rawLayers.length === 0) issues.push("layerAssets must contain at least one layer");
    const layerAssets = rawLayers
        .map((layer, index) => parseLayer(layer, index, issues))
        .filter((layer): layer is StorefrontPaperDollLayer => Boolean(layer));

    const uniqueLayerKeys = new Set<string>();
    for (const layer of layerAssets) {
        const key = `${layer.slot}:${layer.variantKey}`;
        if (uniqueLayerKeys.has(key)) issues.push(`duplicate layer key ${key}`);
        uniqueLayerKeys.add(key);
    }
    const availableSlots = new Set(layerAssets.map((layer) => layer.slot));
    for (const [field, order] of orderEntries) {
        for (const slot of new Set(order)) {
            if (!availableSlots.has(slot)) issues.push(`${field} requires at least one ${slot} asset`);
        }
    }

    if (issues.length > 0) return { ok: false, issues };

    return {
        ok: true,
        issues: [],
        family: {
            _id: cleanString(value._id),
            familyKey,
            displayName,
            canvasPreset: PAPER_DOLL_PDP_CANVAS_PRESET,
            canvasWidth,
            canvasHeight,
            pipelineVersion,
            assetRevision,
            storefrontReady: true,
            layerOrderRollon,
            layerOrderSpray,
            layerOrderShortcap,
            layerOrderLotion,
            anchorsJson: cleanString(value.anchorsJson) || undefined,
            layerAssets,
        },
    };
}

export function assertStorefrontPaperDollFamily(value: unknown): StorefrontPaperDollFamily {
    const result = validateStorefrontPaperDollFamily(value);
    if (!result.ok) {
        throw new Error(`Paper Doll family failed storefront validation:\n- ${result.issues.join("\n- ")}`);
    }
    return result.family;
}
