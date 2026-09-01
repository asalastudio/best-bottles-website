import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { RECIPE_SEEDS } from "../src/lib/materials/materialRecipes";

/**
 * Material recipes — per-finish MeshPhysicalMaterial tunables for the single
 * hybrid studio environment. See src/lib/materials/materialRecipes.ts for
 * the architecture note and the seed values (that module is the one source
 * of truth the seed mutation writes from).
 */

/** A material-recipe document as returned to clients. */
const recipeDoc = v.object({
    _id: v.id("materialRecipes"),
    _creationTime: v.number(),
    finishKey: v.string(),
    label: v.string(),
    kind: v.union(v.literal("glass"), v.literal("metal")),
    color: v.string(),
    metalness: v.number(),
    roughness: v.number(),
    ior: v.optional(v.number()),
    transmission: v.optional(v.number()),
    thickness: v.optional(v.number()),
    attenuationColor: v.optional(v.string()),
    attenuationDistance: v.optional(v.number()),
    envMapIntensity: v.number(),
    updatedAt: v.number(),
});

/** Finite-and-in-range guard for founder-tuned physical values. */
function bounded(name: string, value: number | undefined, min: number, max: number) {
    if (value === undefined) return;
    if (!Number.isFinite(value) || value < min || value > max) {
        throw new Error(`${name} must be a finite number in [${min}, ${max}], got ${value}`);
    }
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function validateRecipeFields(r: {
    color?: string; metalness?: number; roughness?: number; ior?: number;
    transmission?: number; thickness?: number; attenuationColor?: string;
    attenuationDistance?: number; envMapIntensity?: number;
}) {
    bounded("metalness", r.metalness, 0, 1);
    bounded("roughness", r.roughness, 0, 1);
    bounded("transmission", r.transmission, 0, 1);
    bounded("ior", r.ior, 1, 2.5);
    // scene units are metres at real product scale — a wall is ~0.002 m
    bounded("thickness", r.thickness, 0, 0.1);
    bounded("attenuationDistance", r.attenuationDistance, 0.0001, 1);
    bounded("envMapIntensity", r.envMapIntensity, 0, 10);
    for (const [k, c] of [["color", r.color], ["attenuationColor", r.attenuationColor]] as const) {
        if (c !== undefined && !HEX.test(c)) throw new Error(`${k} must be #rrggbb, got ${c}`);
    }
}

/** A handful of finishes exist (six pilots today); 200 bounds the read. */
export const list = query({
    args: {},
    returns: v.array(recipeDoc),
    handler: async (ctx) => {
        return await ctx.db.query("materialRecipes").take(200);
    },
});

export const getByFinishKey = query({
    args: { finishKey: v.string() },
    returns: v.union(recipeDoc, v.null()),
    handler: async (ctx, { finishKey }) => {
        return await ctx.db
            .query("materialRecipes")
            .withIndex("by_finishKey", (q) => q.eq("finishKey", finishKey))
            .unique();
    },
});

/** Tune one finish — the founder's dial. Only provided fields change. */
export const upsertRecipe = mutation({
    args: {
        finishKey: v.string(),
        label: v.optional(v.string()),
        kind: v.optional(v.union(v.literal("glass"), v.literal("metal"))),
        color: v.optional(v.string()),
        metalness: v.optional(v.number()),
        roughness: v.optional(v.number()),
        ior: v.optional(v.number()),
        transmission: v.optional(v.number()),
        thickness: v.optional(v.number()),
        attenuationColor: v.optional(v.string()),
        attenuationDistance: v.optional(v.number()),
        envMapIntensity: v.optional(v.number()),
    },
    returns: v.id("materialRecipes"),
    handler: async (ctx, { finishKey, ...patch }) => {
        validateRecipeFields(patch);
        const defined = Object.fromEntries(
            Object.entries(patch).filter(([, val]) => val !== undefined));
        const existing = await ctx.db
            .query("materialRecipes")
            .withIndex("by_finishKey", (q) => q.eq("finishKey", finishKey))
            .unique();
        if (existing) {
            await ctx.db.patch(existing._id, { ...defined, updatedAt: Date.now() });
            return existing._id;
        }
        const seed = RECIPE_SEEDS.find((r) => r.finishKey === finishKey);
        if (!seed) {
            throw new Error(
                `No recipe or seed for finishKey "${finishKey}" — seed pilot finishes first`);
        }
        return await ctx.db.insert("materialRecipes", {
            ...seed, ...defined, updatedAt: Date.now(),
        });
    },
});

/** Idempotent: writes the six pilot finishes, skipping rows that already
 *  exist (so a re-seed never clobbers founder tuning). `overwrite: true`
 *  resets every seeded finish back to the seed values. */
export const seedPilotFinishes = mutation({
    args: { overwrite: v.optional(v.boolean()) },
    returns: v.object({
        inserted: v.number(), reset: v.number(), skipped: v.number(),
    }),
    handler: async (ctx, { overwrite }) => {
        let inserted = 0, reset = 0, skipped = 0;
        for (const seed of RECIPE_SEEDS) {
            const existing = await ctx.db
                .query("materialRecipes")
                .withIndex("by_finishKey", (q) => q.eq("finishKey", seed.finishKey))
                .unique();
            if (existing && !overwrite) { skipped++; continue; }
            if (existing) {
                await ctx.db.replace(existing._id, { ...seed, updatedAt: Date.now() });
                reset++;
            } else {
                await ctx.db.insert("materialRecipes", { ...seed, updatedAt: Date.now() });
                inserted++;
            }
        }
        return { inserted, reset, skipped };
    },
});
