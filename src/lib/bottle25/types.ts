/**
 * The 2.5D bottle renderer — data model.
 *
 * A rendered product is composed, never stored:
 *
 *     BottleMaster + GlassMaterial + Closure  ->  rendered product
 *
 * A master describes a PHYSICAL FORM (a cylinder of this diameter, this tall,
 * with this wall). It is not a SKU and it is not a picture of one: the same
 * `cylinder-9ml` serves clear, amber, cobalt and frosted, with any closure that
 * fits its neck. Nothing here may grow a per-SKU field — the moment a master
 * knows about a SKU, we are back to one image per configuration.
 */

/** Renderers a master can be drawn by. The commerce data never changes when a
 *  family graduates from one to the next — only `renderer` does. */
export type RendererKind = "image" | "shader2d" | "glb";

/**
 * How the glass is shaped in cross-section, viewed side-on.
 *
 * This is what lets one shader serve many bottles WITHOUT a per-bottle
 * thickness map. For a cylinder the path a ray travels through glass is exact
 * arithmetic — see `thicknessProfile` in the shader — so a new cylindrical
 * body needs three measured numbers and no new art. Shapes that are not
 * solids of revolution supply maps instead (`thicknessMapUrl`), which the
 * shader prefers whenever it is given one.
 */
export type CrossSection =
    | { kind: "cylinder" }
    | { kind: "map" };            // thicknessMapUrl carries the geometry

/** Normalised to the frame: 0..1 across the canvas, y measured from the TOP
 *  so it reads the same way as the plate coordinates it comes from. */
export type Anchor = { x: number; y: number };

export type BottleMaster = {
    id: string;
    label: string;
    renderer: RendererKind;
    crossSection: CrossSection;

    /** Millimetres, from the drawings and the thickness bake. The renderer
     *  converts to frame units using the silhouette's measured width, so the
     *  same master works at any canvas size. */
    dimensions: {
        heightMm: number;
        diameterMm: number;
        /** median glass wall — the "virtual inner wall" of the 2.5D model */
        wallMm: number;
        /** the thickest path through the base puck */
        baseMm: number;
    };

    /** Where the silhouette comes from. A body part from the component kit is
     *  the alpha mask AND nothing else — no colour of the bottle is taken from
     *  it, or the glass could not change colour. */
    silhouette: { kitSlot: "body" };

    /** Optional maps. None are required; each one that exists overrides the
     *  procedural equivalent. */
    maps?: {
        thicknessMapUrl?: string;
        normalMapUrl?: string;
        roughnessMapUrl?: string;
    };

    anchors: { neck: Anchor; closure: Anchor; baseline: Anchor };
    neckFinish: string;
    compatibleClosureIds: string[];
    /** the 3D body this master graduates to, when it does */
    glbBodyId?: string;
};

/**
 * A glass. Absorption is per-millimetre and per-channel, so colour density
 * follows the thickness the geometry actually has: a cobalt wall reads light
 * where it is 2.45 mm and deep through the 12.7 mm base, from ONE material.
 */
export type GlassMaterial = {
    id: string;
    label: string;
    /** Beer-Lambert absorption per mm, per channel. 0 = water-clear. */
    absorption: [number, number, number];
    ior: number;
    roughness: number;
    /** 0 = polished, 1 = acid-etched; drives blur, micro-normal and specular width */
    frost: number;
    fresnelStrength: number;
    refractionStrength: number;
    specularIntensity: number;
    edgeIntensity: number;
    /** a faint surface tint for glasses whose colour is in the surface, not the volume */
    surfaceTint?: [number, number, number];
    provenance: string;
};

export type Closure = {
    id: string;
    label: string;
    renderer: RendererKind;
    /** which kit the paper-doll parts come from, and which slots to take.
     *  Deliberately NOT a list of URLs: the URLs are content-addressed and
     *  live in the index, so hard-coding them here would go stale. */
    source: { websiteSku: string; slots: string[] };
    compatibleNeckFinishes: string[];
};

export type ProductConfiguration = {
    bottleMasterId: string;
    glassMaterialId: string;
    closureId: string;
};
