/**
 * Material recipes — per-finish MeshPhysicalMaterial tunables for the single
 * hybrid studio environment (StudioEnvironment.tsx).
 *
 * THE ARCHITECTURE THESE SERVE
 * One environment lights the whole scene; per-finish variation lives in
 * these recipes (envMapIntensity, roughness, attenuation…), never in
 * swapping environments or per-material envMap overrides. Recipes are
 * stored in Convex (`materialRecipes` table) so the founder can tune a
 * finish without a deploy; this module is the SEED — the same six rows the
 * Convex `seedPilotFinishes` mutation writes and the /dev/lighting-test
 * scene falls back to when the table is empty or unreachable.
 *
 * SCALE — this scene is METRES AT REAL PRODUCT SCALE (a 9 ml cylinder is
 * 0.070 m tall, 0.020 m across). Two seed values are scale-dependent and
 * were translated from the handoff's unit-scale figures:
 *   - `thickness`: bodies render FRONT-FACES-ONLY as one solid piece of
 *     glass (rendering the hollow shell's inner wall reads as a bottle
 *     inside the bottle — Jordan), so thickness is the full body diameter
 *     (0.02 m), not the 2 mm wall.
 *   - `attenuationDistance`: the handoff's "start ~0.5 world units"
 *     assumed a ~unit-height bottle; over a 20 mm solid path the approved
 *     colourway identities sit at amber 0.015 / cobalt 0.013 (the lane's
 *     locked absorption values), which we adopt as seeds.
 */

export type MaterialRecipe = {
    /** stable key, e.g. "amber-glass" — unique per finish */
    finishKey: string;
    label: string;
    kind: "glass" | "metal";
    /** base colour (metals: reflectance tint; glass: leave white, tint via attenuation) */
    color: string;
    metalness: number;
    roughness: number;
    ior?: number;
    transmission?: number;
    /** metres of glass a refracted ray crosses — the solid-body diameter */
    thickness?: number;
    /** physically-based colour depth: thicker glass = deeper colour */
    attenuationColor?: string;
    attenuationDistance?: number;
    /** how strongly this finish samples the ONE shared environment (default 1.0) */
    envMapIntensity: number;
};

const CLEAR: MaterialRecipe = {
    finishKey: "clear-glass",
    label: "Clear glass",
    kind: "glass",
    color: "#ffffff",
    metalness: 0,
    roughness: 0.05,
    ior: 1.5,
    transmission: 1,
    thickness: 0.02,
    envMapIntensity: 1.0,
};

export const RECIPE_SEEDS: MaterialRecipe[] = [
    CLEAR,
    {
        ...CLEAR,
        finishKey: "frosted-glass",
        label: "Frosted glass",
        roughness: 0.35,
        envMapIntensity: 1.1,
    },
    {
        ...CLEAR,
        finishKey: "amber-glass",
        label: "Amber glass",
        attenuationColor: "#7a3b06",
        attenuationDistance: 0.015,
        envMapIntensity: 1.2,
    },
    {
        ...CLEAR,
        finishKey: "cobalt-glass",
        label: "Cobalt glass",
        attenuationColor: "#0a2f9c",
        attenuationDistance: 0.013,
        envMapIntensity: 1.2,
    },
    {
        finishKey: "gold-cap",
        label: "Gold cap",
        kind: "metal",
        color: "#d8a94e",
        metalness: 1,
        roughness: 0.18,
        envMapIntensity: 1.0,
    },
    {
        finishKey: "silver-cap",
        label: "Silver cap",
        kind: "metal",
        color: "#e6e6e6",
        metalness: 1,
        roughness: 0.15,
        envMapIntensity: 1.0,
    },
];

export const RECIPE_SEEDS_BY_KEY: Record<string, MaterialRecipe> =
    Object.fromEntries(RECIPE_SEEDS.map((r) => [r.finishKey, r]));
