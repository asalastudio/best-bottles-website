/**
 * The 2.5D registries: forms, glasses, closures. Three small tables that
 * compose, so eight configurations need eight rows of data and zero new art.
 *
 * Adding a cylindrical body is one master + one bake. Adding a colour is one
 * GlassMaterial and no art at all. Adding a cap is one Closure pointing at a
 * kit that already exists.
 */

import type { BottleMaster, Closure, GlassMaterial } from "./types";

export const BOTTLE_MASTERS: Record<string, BottleMaster> = {
    "cylinder-9ml": {
        id: "cylinder-9ml",
        label: "Cylinder 9 mL",
        renderer: "shader2d",
        crossSection: { kind: "cylinder" },
        // diameter and height from the body GLB's own bounds (±9.99mm, 69.2mm
        // tall); wall and base from its thickness bake sidecar (median 2.45mm,
        // max 12.7mm). Nothing here is estimated.
        dimensions: { heightMm: 69.2, diameterMm: 19.98, wallMm: 2.45, baseMm: 12.7 },
        silhouette: { kitSlot: "body" },
        maps: { thicknessMapUrl: "/bottle25/cylinder-9ml.thickness2d.png" },
        // normalised to the frame, y from the top — the kit's own anchors
        anchors: {
            neck: { x: 0.5035, y: 0.2555 },
            closure: { x: 0.5035, y: 0.2555 },
            baseline: { x: 0.5035, y: 0.9627 },
        },
        neckFinish: "17-415",
        compatibleClosureIds: ["roll-on-gold", "roll-on-black", "roll-on-silver-dot"],
        glbBodyId: "Cyl-round-17-415-70x20",
    },
};

/**
 * Absorption is per millimetre, per channel, applied through the thickness the
 * bake measured. That is why one material gives a light wall and a deep base:
 * the 2.45mm side transmits exp(-k*4.9) and the 12.7mm puck exp(-k*19.9).
 *
 * Hues follow the shipped GLASS_PRESETS (src/lib/materials/glassPresets.ts) so
 * the 2.5D lane and the GLB lane cannot drift apart on colour.
 */
export const GLASS_MATERIALS: Record<string, GlassMaterial> = {
    clear: {
        id: "clear", label: "Clear",
        absorption: [0.0016, 0.0012, 0.0014],
        ior: 1.52, roughness: 0.02, frost: 0,
        fresnelStrength: 1.0, refractionStrength: 1.0,
        specularIntensity: 1.0, edgeIntensity: 1.0,
        provenance: "IOR and hue from GLASS_PRESETS.clear (measured glass, physicallybased.info). " +
            "Absorption is the faint green of soda-lime seen through 20mm at the base.",
    },
    amber: {
        id: "amber", label: "Amber",
        absorption: [0.028, 0.075, 0.20],
        ior: 1.54, roughness: 0.02, frost: 0,
        fresnelStrength: 1.0, refractionStrength: 1.0,
        specularIntensity: 1.0, edgeIntensity: 1.05,
        provenance: "hue matched to GLASS_PRESETS.amber (#8f4a16 @ 15mm); split into per-mm " +
            "absorption so the base darkens on its own.",
    },
    cobalt: {
        id: "cobalt", label: "Cobalt",
        absorption: [0.185, 0.105, 0.014],
        ior: 1.52, roughness: 0.02, frost: 0,
        fresnelStrength: 1.05, refractionStrength: 1.0,
        specularIntensity: 1.05, edgeIntensity: 1.05,
        provenance: "deep cobalt, not electric: blue is absorbed least, red most, so thin walls " +
            "stay a true blue instead of going cyan.",
    },
    frosted: {
        id: "frosted", label: "Frosted",
        absorption: [0.004, 0.004, 0.004],
        ior: 1.50, roughness: 0.42, frost: 1,
        fresnelStrength: 0.55, refractionStrength: 0.25,
        specularIntensity: 0.45, edgeIntensity: 0.8,
        surfaceTint: [0.97, 0.96, 0.95],
        provenance: "acid-etched: the surface scatters, so refraction drops, the specular widens " +
            "and the background arrives diffused rather than bent.",
    },
};

export const CLOSURES: Record<string, Closure> = {
    "roll-on-gold": {
        id: "roll-on-gold", label: "Gold roll-on",
        renderer: "image",
        source: { websiteSku: "GBCyl9MtlRollShnGl", slots: ["roller", "cap"] },
        compatibleNeckFinishes: ["17-415"],
    },
    "roll-on-black": {
        id: "roll-on-black", label: "Black roll-on",
        renderer: "image",
        source: { websiteSku: "GBCyl9MtlRollShBlk", slots: ["roller", "cap"] },
        compatibleNeckFinishes: ["17-415"],
    },
    "roll-on-silver-dot": {
        id: "roll-on-silver-dot", label: "Silver dotted roll-on",
        renderer: "image",
        source: { websiteSku: "GBCyl9MtlRollSlDot", slots: ["roller", "cap"] },
        compatibleNeckFinishes: ["17-415"],
    },
};

export const listGlasses = () => Object.values(GLASS_MATERIALS);
export const listClosuresFor = (master: BottleMaster) =>
    master.compatibleClosureIds.map((id) => CLOSURES[id]).filter(Boolean);
