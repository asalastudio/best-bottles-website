import library from "./cylinder9-master-index.json";

export const CYLINDER9_MASTER_VERSION = library.version;
export function cylinder9MasterSku(sku: string | null | undefined): string | null {
    return sku && Object.hasOwn(library.skus, sku) ? sku : null;
}
