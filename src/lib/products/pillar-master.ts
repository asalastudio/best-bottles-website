export const PILLAR_POUR_CAP_SUFFIXES = [
    "BlkShSht", "BlkSht", "WhtSht", "CuSht", "GlMattSht", "SlMattSht",
    "Gl", "GlSht", "Sl", "SlSht",
] as const;
const pillarPourSkus = new Set<string>(PILLAR_POUR_CAP_SUFFIXES.map(suffix => `GBPillar9${suffix}`));

export function isPillarPourSku(sku: string): boolean {
    return pillarPourSkus.has(sku);
}

const PILLAR_MASTER_SKUS = new Set([
    "GBPillar9SpryBlkMatt", "GBPillar9SpryBlkShn", "GBPillar9SpryBluMatt",
    "GBPillar9SpryGlMatt", "GBPillar9SpryGlShn", "GBPillar9SprySlMatt",
    "GBPillar9SprySlShn",
]);

const PILLAR_ROLLON_FINISH = /^GBPillar9(?:Mtl)?Roll(?:BlkSh|CuMatt|GlMatt|GlSh|PinkDot|SlDot|SlMatt|SlSh)$/;

export function isPillarRollOnSku(sku: string): boolean {
    return sku === "GBPillar9RollBlkDot" || sku === "GBPillar9MtlRollBlkdot" || PILLAR_ROLLON_FINISH.test(sku);
}

export const PILLAR_MASTER_VERSION = "pillar-9ml-owner-reference-v3";

export function pillarReviewSku(sku?: string | null): string | null {
    return process.env.NODE_ENV === "development" && sku && (PILLAR_MASTER_SKUS.has(sku) || isPillarRollOnSku(sku)) ? sku : null;
}
