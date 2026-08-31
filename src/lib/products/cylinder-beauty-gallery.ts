export const CYLINDER_BEAUTY_GLASS_KEYS = ["CLR", "AMB", "BLU", "FRS", "SWL"] as const;

export type CylinderBeautyGlassKey = typeof CYLINDER_BEAUTY_GLASS_KEYS[number];

export type CylinderBeautyHero = {
    glassKey: CylinderBeautyGlassKey;
    glassLabel: "Clear" | "Amber" | "Cobalt Blue" | "Frosted" | "Swirl";
    imageUrl: string;
    imageWidth: 2080;
    imageHeight: 2288;
    alt: string;
};

export type StorefrontCylinderBeautyGallery = {
    _id: string;
    familyKey: "CYL-9ML";
    displayName: string;
    canvasWidth: 2080;
    canvasHeight: 2288;
    referenceRoller: "metal-roller";
    referenceCapFinish: "matte-silver";
    assetRevision: string;
    storefrontReady: true;
    heroes: CylinderBeautyHero[];
};

const GLASS_LABELS: Record<CylinderBeautyGlassKey, CylinderBeautyHero["glassLabel"]> = {
    CLR: "Clear",
    AMB: "Amber",
    BLU: "Cobalt Blue",
    FRS: "Frosted",
    SWL: "Swirl",
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requiredString(value: unknown, field: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`Cylinder beauty gallery ${field} must be a non-empty string`);
    }
    return value;
}

function isGlassKey(value: unknown): value is CylinderBeautyGlassKey {
    return typeof value === "string"
        && (CYLINDER_BEAUTY_GLASS_KEYS as readonly string[]).includes(value);
}

export function assertStorefrontCylinderBeautyGallery(
    value: unknown,
): StorefrontCylinderBeautyGallery {
    if (!isRecord(value)) throw new Error("Cylinder beauty gallery must be an object");
    if (value.familyKey !== "CYL-9ML") throw new Error("Cylinder beauty gallery must target CYL-9ML");
    if (value.storefrontReady !== true) throw new Error("Cylinder beauty gallery is not storefront ready");
    if (value.canvasWidth !== 2080 || value.canvasHeight !== 2288) {
        throw new Error("Cylinder beauty gallery canvas must be exactly 2080 x 2288");
    }
    if (value.referenceRoller !== "metal-roller" || value.referenceCapFinish !== "matte-silver") {
        throw new Error("Cylinder beauty gallery must use the metal roller and matte-silver cap reference");
    }
    if (!Array.isArray(value.heroes) || value.heroes.length !== CYLINDER_BEAUTY_GLASS_KEYS.length) {
        throw new Error("Cylinder beauty gallery must contain exactly five heroes");
    }

    const byGlass = new Map<CylinderBeautyGlassKey, CylinderBeautyHero>();
    for (const candidate of value.heroes) {
        if (!isRecord(candidate) || !isGlassKey(candidate.glassKey)) {
            throw new Error("Cylinder beauty gallery contains an invalid glass key");
        }
        if (byGlass.has(candidate.glassKey)) {
            throw new Error(`Cylinder beauty gallery contains duplicate glass key ${candidate.glassKey}`);
        }
        if (candidate.glassLabel !== GLASS_LABELS[candidate.glassKey]) {
            throw new Error(`Cylinder beauty gallery label does not match ${candidate.glassKey}`);
        }
        if (candidate.imageWidth !== 2080 || candidate.imageHeight !== 2288) {
            throw new Error(`Cylinder beauty hero ${candidate.glassKey} must be exactly 2080 x 2288`);
        }
        byGlass.set(candidate.glassKey, {
            glassKey: candidate.glassKey,
            glassLabel: GLASS_LABELS[candidate.glassKey],
            imageUrl: requiredString(candidate.imageUrl, `${candidate.glassKey} imageUrl`),
            imageWidth: 2080,
            imageHeight: 2288,
            alt: requiredString(candidate.alt, `${candidate.glassKey} alt`),
        });
    }

    const heroes = CYLINDER_BEAUTY_GLASS_KEYS.map((glassKey) => byGlass.get(glassKey));
    if (heroes.some((hero) => !hero)) {
        throw new Error("Cylinder beauty gallery must include CLR, AMB, BLU, FRS, and SWL exactly once");
    }

    return {
        _id: requiredString(value._id, "_id"),
        familyKey: "CYL-9ML",
        displayName: requiredString(value.displayName, "displayName"),
        canvasWidth: 2080,
        canvasHeight: 2288,
        referenceRoller: "metal-roller",
        referenceCapFinish: "matte-silver",
        assetRevision: requiredString(value.assetRevision, "assetRevision"),
        storefrontReady: true,
        heroes: heroes as CylinderBeautyHero[],
    };
}

export function resolveCylinderBeautyHero(
    gallery: StorefrontCylinderBeautyGallery | null,
    glassKey: string | null | undefined,
): CylinderBeautyHero | null {
    if (!gallery) return null;
    return gallery.heroes.find((hero) => hero.glassKey === glassKey)
        ?? gallery.heroes.find((hero) => hero.glassKey === "CLR")
        ?? null;
}
