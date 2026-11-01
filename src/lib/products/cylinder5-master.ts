import library from "./cylinder5-master-index.json";
const skus = new Set(library.skus);
export const CYLINDER5_MASTER_VERSION = library.version;
export function cylinder5MasterSku(sku: string | null | undefined): string | null {
    return sku && skus.has(sku) ? sku : null;
}
