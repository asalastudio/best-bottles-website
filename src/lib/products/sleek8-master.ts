/** One local material candidate shared by every exact 8 ml Sleek configuration. */
export const SLEEK8_MASTER_REVIEW_VERSION = "sleek8-80dd51d7543a-v1";
const SKUS: ReadonlySet<string> = new Set([
    "GBSleek8BlkShSht",
    "GBSleek8BlkSht",
    "GBSleek8CuSht",
    "GBSleek8Gl",
    "GBSleek8GlMattSht",
    "GBSleek8GlSht",
    "GBSleek8MtlRollBlkDot",
    "GBSleek8MtlRollBlkSh",
    "GBSleek8MtlRollCuMatt",
    "GBSleek8MtlRollGlMatt",
    "GBSleek8MtlRollGlSh",
    "GBSleek8MtlRollPinkDot",
    "GBSleek8MtlRollSlDot",
    "GBSleek8MtlRollSlMatt",
    "GBSleek8MtlRollSlSh",
    "GBSleek8RollBlkDot",
    "GBSleek8RollBlkSh",
    "GBSleek8RollCuMatt",
    "GBSleek8RollGlMatt",
    "GBSleek8RollGlSh",
    "GBSleek8RollPinkDot",
    "GBSleek8RollSlDot",
    "GBSleek8RollSlMatt",
    "GBSleek8RollSlSh",
    "GBSleek8Sl",
    "GBSleek8SlMattSht",
    "GBSleek8SlSht",
    "GBSleek8SpryBlkMatt",
    "GBSleek8SpryBlkSh",
    "GBSleek8SpryBluMatt",
    "GBSleek8SpryCuMatt",
    "GBSleek8SpryGlMatt",
    "GBSleek8SpryGlSh",
    "GBSleek8SprySlMatt",
    "GBSleek8SprySlSh",
    "GBSleek8WhtSht"
]);
export function sleek8ReviewSku(sku?: string | null): string | null {
    return process.env.NODE_ENV === "development" && !process.env.VERCEL && sku && SKUS.has(sku) ? sku : null;
}
