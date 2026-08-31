import path from "node:path";

export const CYLINDER_BEAUTY_ASSETS = [
    {
        glassKey: "CLR",
        glassLabel: "Clear",
        outputSlug: "clear",
        filename: "cylinder-clear-metal-roller-matte-silver-sandstone-v1.png",
    },
    {
        glassKey: "AMB",
        glassLabel: "Amber",
        outputSlug: "amber",
        filename: "cylinder-amber-metal-roller-matte-silver-sandstone-v1.png",
    },
    {
        glassKey: "BLU",
        glassLabel: "Cobalt Blue",
        outputSlug: "cobalt-blue",
        filename: "cylinder-cobalt-metal-roller-matte-silver-sandstone-v1.png",
    },
    {
        glassKey: "FRS",
        glassLabel: "Frosted",
        outputSlug: "frosted",
        filename: "cylinder-frosted-metal-roller-matte-silver-sandstone-v1.png",
    },
    {
        glassKey: "SWL",
        glassLabel: "Swirl",
        outputSlug: "swirl",
        filename: "cylinder-swirl-metal-roller-matte-silver-sandstone-v1.png",
    },
];

export function resolveCylinderBeautyUploads(outputRoot) {
    if (typeof outputRoot !== "string" || outputRoot.trim().length === 0) {
        throw new Error("Cylinder beauty output root is required");
    }
    return CYLINDER_BEAUTY_ASSETS.map((asset) => ({
        ...asset,
        absolutePath: path.resolve(outputRoot, asset.filename),
    }));
}

export function buildCylinderBeautyGalleryDocument(uploadedAssets) {
    const missing = CYLINDER_BEAUTY_ASSETS.filter(
        (asset) => typeof uploadedAssets?.[asset.glassKey] !== "string"
            || uploadedAssets[asset.glassKey].trim().length === 0,
    );
    if (missing.length > 0) {
        throw new Error(`All five Cylinder beauty assets are required; missing ${missing.map((asset) => asset.glassKey).join(", ")}`);
    }

    return {
        _id: "paperDollBeautyGallery.CYL-9ML",
        _type: "paperDollBeautyGallery",
        familyKey: "CYL-9ML",
        displayName: "Cylinder 9 mL · Sandstone Beauty Gallery",
        canvasWidth: 2080,
        canvasHeight: 2288,
        referenceRoller: "metal-roller",
        referenceCapFinish: "matte-silver",
        generator: "Google Gemini Nano Banana Pro (gemini-3-pro-image)",
        assetRevision: "sandstone-v1",
        storefrontReady: true,
        heroes: CYLINDER_BEAUTY_ASSETS.map((asset) => ({
            _key: asset.glassKey.toLowerCase(),
            _type: "glassBeautyHero",
            glassKey: asset.glassKey,
            glassLabel: asset.glassLabel,
            image: {
                _type: "image",
                asset: {
                    _type: "reference",
                    _ref: uploadedAssets[asset.glassKey],
                },
            },
            alt: `${asset.glassLabel} empty 9 mL Cylinder bottle with exposed metal roller and matte-silver cap on natural sandstone`,
        })),
        reviewNotes: "Programmatic Nano Banana Pro sandstone-v1 set. Empty bottles, shared baseline, matte-silver cap, exact 2080 × 2288 finishing, five-up reviewed 2026-08-04.",
    };
}
