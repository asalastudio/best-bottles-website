const PILLAR_MASTER_SKUS = new Set([
    "GBPillar9SpryBlkMatt", "GBPillar9SpryBlkShn", "GBPillar9SpryBluMatt",
    "GBPillar9SpryGlMatt", "GBPillar9SpryGlShn", "GBPillar9SprySlMatt",
    "GBPillar9SprySlShn", "GBPillar9BlkShSht", "GBPillar9RollBlkDot", "GBPillar9MtlRollBlkdot",
]);

export const PILLAR_MASTER_VERSION = "pillar-9ml-owner-reference-v1";

export function pillarReviewSku(sku?: string | null): string | null {
    return process.env.NODE_ENV === "development" && sku && PILLAR_MASTER_SKUS.has(sku) ? sku : null;
}
