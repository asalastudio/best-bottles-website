export type CylinderStorefrontAuditSnapshot = {
    familyKey: string;
    capacityMl: number;
    neckThreadSize: string;
    groupCount: number;
    configurationSkus: string[];
    wrongNeckSkus: string[];
    storefrontReady: boolean;
    canvasWidth: number;
    canvasHeight: number;
    layerCounts: Record<"body" | "cap" | "roller" | "sprayer" | "pump", number>;
    invalidLayerDimensions: string[];
    editorialHeroUrl: string | null;
};

const EXPECTED_LAYER_COUNTS = {
    body: 5,
    cap: 10,
    roller: 2,
    sprayer: 6,
    pump: 3,
} as const;

const REQUIRED_SWIRL_WHITE_SKUS = [
    ["GB-CYL-WHT-9ML-MRL-WHT", "metal"],
    ["GB-CYL-WHT-9ML-ROL-WHT", "plastic"],
] as const;

export function summarizeCylinderStorefrontAudit(
    snapshot: CylinderStorefrontAuditSnapshot,
): { ok: boolean; issues: string[] } {
    const issues: string[] = [];
    if (snapshot.familyKey !== "CYL-9ML" || snapshot.capacityMl !== 9 || snapshot.neckThreadSize !== "17-415") {
        issues.push(`Expected CYL-9ML · 9 mL · 17-415; received ${snapshot.familyKey} · ${snapshot.capacityMl} mL · ${snapshot.neckThreadSize}`);
    }
    if (snapshot.groupCount !== 15) issues.push(`Expected 15 product groups; received ${snapshot.groupCount}`);
    const uniqueSkus = new Set(snapshot.configurationSkus.filter(Boolean));
    if (uniqueSkus.size !== 145) issues.push(`Expected 145 unique configurations; received ${uniqueSkus.size}`);
    if (snapshot.wrongNeckSkus.length > 0) {
        issues.push(`Found ${snapshot.wrongNeckSkus.length} configuration${snapshot.wrongNeckSkus.length === 1 ? "" : "s"} from a non-17-415 platform`);
    }
    for (const [sku, material] of REQUIRED_SWIRL_WHITE_SKUS) {
        if (!uniqueSkus.has(sku)) issues.push(`Missing Swirl ${material} roller + white cap SKU ${sku}`);
    }
    if (!snapshot.storefrontReady) issues.push("Sanity Paper Doll family is not storefront-ready");
    if (snapshot.canvasWidth !== 2080 || snapshot.canvasHeight !== 2288) {
        issues.push(`Expected a 2080×2288 Paper Doll canvas; received ${snapshot.canvasWidth}×${snapshot.canvasHeight}`);
    }
    for (const [slot, expected] of Object.entries(EXPECTED_LAYER_COUNTS)) {
        const received = snapshot.layerCounts[slot as keyof typeof EXPECTED_LAYER_COUNTS] ?? 0;
        if (received !== expected) issues.push(`Expected ${expected} ${slot} layers; received ${received}`);
    }
    if (snapshot.invalidLayerDimensions.length > 0) {
        issues.push(`${snapshot.invalidLayerDimensions.length} Paper Doll layer${snapshot.invalidLayerDimensions.length === 1 ? " has" : "s have"} invalid dimensions`);
    }
    if (!snapshot.editorialHeroUrl) issues.push("Cylinder editorial hero is missing");
    return { ok: issues.length === 0, issues };
}
