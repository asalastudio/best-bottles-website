import { v } from "convex/values";

/**
 * Component register (docs/COMPONENT_REGISTER_PHASE_2_SCHEMA.md). The register in
 * data/register/ is the source of truth; these tables are loaded from it by
 * scripts/register/push-register.ts and never edited by hand.
 *
 * Fields are split by owner. `*RegisterFields` come from the register and are
 * rewritten on every push. Image fields (body plates, component layers) belong
 * to the Phase 3 anchor tooling, and a register push never touches them.
 */

export const registerAssetV = v.object({
    url: v.string(),
    key: v.string(),
    sha256: v.string(),
    bytes: v.number(),
    width: v.number(),
    height: v.number(),
});

export const registerSlotV = v.union(
    v.literal("body"), v.literal("fitment"), v.literal("roller"), v.literal("cap"), v.literal("overcap"),
    v.literal("sprayer"), v.literal("pump"), v.literal("diptube"), v.literal("collar"), v.literal("bulb"),
    v.literal("tassel"), v.literal("reducer"), v.literal("pipette"),
);

export const confidenceV = v.union(v.literal("high"), v.literal("medium"), v.literal("low"));

export const registerStampV = v.object({
    snapshot: v.string(),     // the Convex export the register was built from
    source: v.string(),
    confidence: confidenceV,
});

export const anchorStatusV = v.union(v.literal("unmeasured"), v.literal("measured"), v.literal("approved"));
export const storageProviderV = v.union(v.literal("vercel-blob"), v.literal("r2"));

export const componentTypeV = v.union(
    v.literal("cap"), v.literal("roll-on-cap"), v.literal("faux-leather-cap"),
    v.literal("fine-mist-sprayer"), v.literal("vintage-bulb-sprayer"), v.literal("tassel-bulb-sprayer"),
    v.literal("lotion-pump"), v.literal("dropper"), v.literal("plug-applicator"),
    v.literal("roller-insert"), v.literal("reducer"), v.literal("wand"),
    v.literal("cap-review"), v.literal("sprayer-review"), v.literal("review"),
);

export const assemblyStatusV = v.union(
    v.literal("verified"), v.literal("candidate"), v.literal("exception"), v.literal("quarantine"), v.literal("retired"),
);

export const buildStatusV = v.union(v.literal("resolved"), v.literal("partial"), v.literal("unresolved"));

// ---------- bodies ----------

export const bodyRegisterFields = {
    bodyId: v.string(),                        // "[shape-]profile-<capacity>ml-<neck>"
    builderBodyId: v.string(),                 // mirrors builderBodyIdentity() in src/lib/bottle-builder/model.ts
    family: v.string(),
    shape: v.union(v.string(), v.null()),
    capacityMl: v.union(v.number(), v.null()),
    neck: v.string(),
    category: v.string(),
    compatibilityClass: v.string(),            // glass-<neck> | plastic-bottle | metal-atomizer | aluminum-bottle | glass-jar | cream-jar | roll-on-bottle
    classSource: v.string(),
    glassVariants: v.array(v.string()),
    fitmentTypes: v.array(v.string()),
    dims: v.object({
        heightBareMm: v.union(v.number(), v.null()),   // bare glass, never the assembly
        diameterMm: v.union(v.number(), v.null()),
        widthMm: v.union(v.number(), v.null()),
        confidence: v.string(),                        // verified | high | medium | low | none | "" (from body-dims.csv)
        source: v.string(),
    }),
    representative: v.object({ graceSku: v.string(), websiteSku: v.string() }),
    status: v.union(v.literal("current"), v.literal("retired")),
    register: registerStampV,
};
export const bodyRowV = v.object(bodyRegisterFields);

// ---------- body plates (written by the Phase 3 anchor tooling) ----------

export const bodyPlateFields = {
    plateKey: v.string(),                      // `${bodyId}|${glass}`
    bodyId: v.string(),
    glass: v.string(),
    image: registerAssetV,                     // transparent bare glass, native resolution
    thumb: v.union(registerAssetV, v.null()),
    pxPerMm: v.number(),
    anchors: v.object({
        axisX: v.number(),                     // closure axis, plate px
        seatY: v.number(),                     // neck seat
        baselineY: v.number(),                 // foot
        shoulderY: v.union(v.number(), v.null()),
    }),
    anchorStatus: anchorStatusV,
    anchorMeasuredBy: v.union(v.string(), v.null()),
    source: v.object({
        library: v.string(),
        path: v.string(),
        psdSha256: v.union(v.string(), v.null()),
        layer: v.union(v.string(), v.null()),
    }),
    derivedFrom: v.union(v.string(), v.null()),  // productPlates.front.sha256 when cut from an existing cap-off plate
    storageProvider: storageProviderV,
    revision: v.number(),
    importedAt: v.number(),
};

// ---------- components ----------

export const componentLayerV = v.object({
    slot: registerSlotV,
    layerName: v.union(v.string(), v.null()),
    z: v.union(v.literal("behind-body"), v.literal("front")),
    image: registerAssetV,                     // native resolution, transparent
    image2x: v.union(registerAssetV, v.null()),
    pxPerMm: v.number(),
    anchor: v.object({ x: v.number(), y: v.number() }),   // lands on the body's (axisX, seatY)
    anchorStatus: anchorStatusV,
    explodeIndex: v.number(),
});

export const componentRegisterFields = {
    componentId: v.string(),                   // graceSku for products; LIB-<neck>-<name> for parts
    graceSku: v.union(v.string(), v.null()),
    websiteSku: v.union(v.string(), v.null()),
    sellable: v.boolean(),
    type: componentTypeV,
    neck: v.string(),
    finish: v.object({
        capColor: v.union(v.string(), v.null()),
        capStyle: v.union(v.string(), v.null()),
        color: v.union(v.string(), v.null()),
        trimColor: v.union(v.string(), v.null()),
        dotted: v.boolean(),
        rollerMaterial: v.union(v.literal("metal"), v.literal("plastic"), v.null()),
    }),
    itemName: v.string(),
    psd: v.union(v.null(), v.object({          // master COMPONENT library only
        library: v.string(),
        path: v.string(),
        stem: v.string(),
        canvas: v.union(v.object({ width: v.number(), height: v.number() }), v.null()),
        match: v.union(v.literal("exact"), v.literal("alias-map"), v.literal("case-insensitive")),
    })),
    status: v.union(v.literal("current"), v.literal("retired"), v.literal("quarantine")),
    statusReason: v.union(v.string(), v.null()),
    register: registerStampV,
};
export const componentRowV = v.object(componentRegisterFields);

// ---------- assemblies ----------

export const assemblyRegisterFields = {
    graceSku: v.string(),
    websiteSku: v.union(v.string(), v.null()),
    bodyId: v.string(),
    plateKey: v.string(),                      // `${bodyId}|${glass}`
    neck: v.string(),
    glass: v.string(),
    compatibilityClass: v.string(),
    fitmentType: v.union(v.string(), v.null()),
    capColor: v.union(v.string(), v.null()),
    capStyle: v.union(v.string(), v.null()),
    assemblyType: v.union(
        v.literal("2-part"), v.literal("3-part"), v.literal("complete-set"), v.literal("component"), v.null(),
    ),
    compatible: v.array(v.string()),           // the neck's interchangeable set, as componentIds
    unresolvedListed: v.array(v.string()),
    excludedByRule: v.array(v.string()),
    build: v.object({                          // this SKU's OWN parts: what the renderer draws
        parts: v.array(v.object({ role: registerSlotV, componentId: v.string() })),
        status: buildStatusV,
        reason: v.union(v.string(), v.null()),
    }),
    status: assemblyStatusV,
    statusReason: v.string(),
    legacy: v.object({                         // what the PDP and builder draw today, for the parity gate
        kitPlateSha256: v.union(v.string(), v.null()),
        capOffPlateSha256: v.union(v.string(), v.null()),
    }),
    register: registerStampV,
};
export const assemblyRowV = v.object(assemblyRegisterFields);

export const REGISTER_ROW_LIMIT = 100;
