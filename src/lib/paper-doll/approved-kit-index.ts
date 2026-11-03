import index from "./approved-kit-index.json";
const skus = new Set<string>(index.skus);
export const APPROVED_KIT_VERSION = index.version + "-cylinder9-colors-v2-20261102";
export function approvedMasterSku(sku: string | null | undefined): string | null {
    return sku && skus.has(sku) ? sku : null;
}
