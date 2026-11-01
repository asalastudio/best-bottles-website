import { cylinder5MasterSku, CYLINDER5_MASTER_VERSION } from "./cylinder5-master";
import { cylinder9MasterSku, CYLINDER9_MASTER_VERSION } from "./cylinder9-master";
export function cylinderMasterSku(sku: string | null | undefined): string | null {
    return cylinder5MasterSku(sku) ?? cylinder9MasterSku(sku);
}
export function cylinderMasterSource(sku: string) {
    if (cylinder5MasterSku(sku)) return { family: "cylinder5", version: CYLINDER5_MASTER_VERSION };
    if (cylinder9MasterSku(sku)) return { family: "cylinder9", version: CYLINDER9_MASTER_VERSION };
    return null;
}
