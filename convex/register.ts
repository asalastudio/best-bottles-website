import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { verifyWriteToken } from "./writeToken";
import {
    REGISTER_ROW_LIMIT,
    anchorStatusV,
    assemblyRegisterFields,
    assemblyRowV,
    bodyPlateFields,
    bodyRegisterFields,
    bodyRowV,
    componentLayerV,
    componentRegisterFields,
    componentRowV,
    storageProviderV,
} from "./registerValidators";

/**
 * Component register: bodies, components and assemblies loaded from
 * data/register/ (docs/COMPONENT_REGISTER_PHASE_2_SCHEMA.md).
 *
 * Writes are additive upserts gated by the shared write token. A push rewrites
 * only the fields the register owns; component layers and body plates belong to
 * the Phase 3 anchor tooling and survive every push. Nothing is ever deleted
 * here: a row the register drops is reported as stale by the loader.
 */

const outcomeV = v.object({
    key: v.string(),
    outcome: v.union(v.literal("inserted"), v.literal("updated"), v.literal("unchanged"), v.literal("error")),
    error: v.optional(v.string()),
});
type Outcome = { key: string; outcome: "inserted" | "updated" | "unchanged" | "error"; error?: string };

const bodyDocV = v.object({
    _id: v.id("registerBodies"), _creationTime: v.number(),
    ...bodyRegisterFields, revision: v.number(), loadedAt: v.number(),
});
const bodyPlateDocV = v.object({ _id: v.id("registerBodyPlates"), _creationTime: v.number(), ...bodyPlateFields });
const componentDocV = v.object({
    _id: v.id("registerComponents"), _creationTime: v.number(),
    ...componentRegisterFields,
    layers: v.array(componentLayerV), layersStatus: anchorStatusV, storageProvider: storageProviderV,
    revision: v.number(), loadedAt: v.number(),
});
const assemblyDocV = v.object({
    _id: v.id("registerAssemblies"), _creationTime: v.number(),
    ...assemblyRegisterFields, revision: v.number(), loadedAt: v.number(),
});

/** Key-order-independent JSON, so a stored document and a fresh row compare equal. */
export function stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
    if (value && typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, item]) => item !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
    }
    return JSON.stringify(value);
}

/** The register-owned slice of a stored document. */
function registerSlice(doc: Record<string, unknown>, fields: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.keys(fields).map(key => [key, doc[key]]));
}

function checkBatch(writeToken: string, rows: unknown[]) {
    verifyWriteToken(writeToken);
    if (rows.length > REGISTER_ROW_LIMIT) throw new Error(`register upserts accept at most ${REGISTER_ROW_LIMIT} rows per call`);
}

export const upsertBodies = mutation({
    args: { writeToken: v.string(), rows: v.array(bodyRowV) },
    returns: v.array(outcomeV),
    handler: async (ctx, args) => {
        checkBatch(args.writeToken, args.rows);
        const now = Date.now();
        const results: Outcome[] = [];
        for (const row of args.rows) {
            const existing = await ctx.db.query("registerBodies").withIndex("by_bodyId", q => q.eq("bodyId", row.bodyId)).collect();
            if (existing.length > 1) { results.push({ key: row.bodyId, outcome: "error", error: "duplicate_index_rows" }); continue; }
            if (existing.length === 0) {
                await ctx.db.insert("registerBodies", { ...row, revision: 1, loadedAt: now });
                results.push({ key: row.bodyId, outcome: "inserted" });
                continue;
            }
            const current = existing[0];
            if (stableJson(registerSlice(current, bodyRegisterFields)) === stableJson(row)) {
                results.push({ key: row.bodyId, outcome: "unchanged" });
                continue;
            }
            await ctx.db.patch(current._id, { ...row, revision: current.revision + 1, loadedAt: now });
            results.push({ key: row.bodyId, outcome: "updated" });
        }
        return results;
    },
});

export const upsertComponents = mutation({
    args: { writeToken: v.string(), rows: v.array(componentRowV) },
    returns: v.array(outcomeV),
    handler: async (ctx, args) => {
        checkBatch(args.writeToken, args.rows);
        const now = Date.now();
        const results: Outcome[] = [];
        for (const row of args.rows) {
            const existing = await ctx.db.query("registerComponents").withIndex("by_componentId", q => q.eq("componentId", row.componentId)).collect();
            if (existing.length > 1) { results.push({ key: row.componentId, outcome: "error", error: "duplicate_index_rows" }); continue; }
            if (existing.length === 0) {
                await ctx.db.insert("registerComponents", {
                    ...row, layers: [], layersStatus: "unmeasured", storageProvider: "vercel-blob", revision: 1, loadedAt: now,
                });
                results.push({ key: row.componentId, outcome: "inserted" });
                continue;
            }
            const current = existing[0];
            if (stableJson(registerSlice(current, componentRegisterFields)) === stableJson(row)) {
                results.push({ key: row.componentId, outcome: "unchanged" });
                continue;
            }
            // Register-owned fields only: layers, layersStatus and storageProvider stay as the tooling left them.
            await ctx.db.patch(current._id, { ...row, revision: current.revision + 1, loadedAt: now });
            results.push({ key: row.componentId, outcome: "updated" });
        }
        return results;
    },
});

export const upsertAssemblies = mutation({
    args: { writeToken: v.string(), rows: v.array(assemblyRowV) },
    returns: v.array(outcomeV),
    handler: async (ctx, args) => {
        checkBatch(args.writeToken, args.rows);
        const now = Date.now();
        const results: Outcome[] = [];
        for (const row of args.rows) {
            const existing = await ctx.db.query("registerAssemblies").withIndex("by_graceSku", q => q.eq("graceSku", row.graceSku)).collect();
            if (existing.length > 1) { results.push({ key: row.graceSku, outcome: "error", error: "duplicate_index_rows" }); continue; }
            if (existing.length === 0) {
                await ctx.db.insert("registerAssemblies", { ...row, revision: 1, loadedAt: now });
                results.push({ key: row.graceSku, outcome: "inserted" });
                continue;
            }
            const current = existing[0];
            if (stableJson(registerSlice(current, assemblyRegisterFields)) === stableJson(row)) {
                results.push({ key: row.graceSku, outcome: "unchanged" });
                continue;
            }
            await ctx.db.patch(current._id, { ...row, revision: current.revision + 1, loadedAt: now });
            results.push({ key: row.graceSku, outcome: "updated" });
        }
        return results;
    },
});

const tableV = v.union(v.literal("bodies"), v.literal("components"), v.literal("assemblies"));

/** The loader's diff source: register-owned fields of every stored row, a page at a time. */
export const listPage = query({
    args: { writeToken: v.string(), table: tableV, cursor: v.union(v.string(), v.null()), numItems: v.optional(v.number()) },
    returns: v.object({ page: v.array(v.any()), isDone: v.boolean(), continueCursor: v.string() }),
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const pagination = { cursor: args.cursor, numItems: Math.min(Math.max(args.numItems ?? 250, 1), 500) };
        if (args.table === "bodies") {
            const result = await ctx.db.query("registerBodies").paginate(pagination);
            return { page: result.page.map(doc => registerSlice(doc, bodyRegisterFields)), isDone: result.isDone, continueCursor: result.continueCursor };
        }
        if (args.table === "components") {
            const result = await ctx.db.query("registerComponents").paginate(pagination);
            return { page: result.page.map(doc => registerSlice(doc, componentRegisterFields)), isDone: result.isDone, continueCursor: result.continueCursor };
        }
        const result = await ctx.db.query("registerAssemblies").paginate(pagination);
        return { page: result.page.map(doc => registerSlice(doc, assemblyRegisterFields)), isDone: result.isDone, continueCursor: result.continueCursor };
    },
});

function tally(values: string[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const value of values) out[value] = (out[value] ?? 0) + 1;
    return out;
}

export const counts = query({
    args: {},
    returns: v.object({
        bodies: v.record(v.string(), v.number()),
        bodyPlates: v.record(v.string(), v.number()),
        components: v.record(v.string(), v.number()),
        componentLayers: v.record(v.string(), v.number()),
        assemblies: v.record(v.string(), v.number()),
        builds: v.record(v.string(), v.number()),
    }),
    handler: async (ctx) => {
        const bodies = await ctx.db.query("registerBodies").collect();
        const plates = await ctx.db.query("registerBodyPlates").collect();
        const components = await ctx.db.query("registerComponents").collect();
        const assemblies = await ctx.db.query("registerAssemblies").collect();
        return {
            bodies: tally(bodies.map(b => b.status)),
            bodyPlates: tally(plates.map(p => p.anchorStatus)),
            components: tally(components.map(c => c.status)),
            componentLayers: tally(components.map(c => c.layersStatus)),
            assemblies: tally(assemblies.map(a => a.status)),
            builds: tally(assemblies.map(a => a.build.status)),
        };
    },
});

export const body = query({
    args: { bodyId: v.string() },
    returns: v.union(v.null(), v.object({ body: bodyDocV, plates: v.array(bodyPlateDocV) })),
    handler: async (ctx, args) => {
        const row = await ctx.db.query("registerBodies").withIndex("by_bodyId", q => q.eq("bodyId", args.bodyId)).first();
        if (!row) return null;
        const plates = await ctx.db.query("registerBodyPlates").withIndex("by_bodyId", q => q.eq("bodyId", args.bodyId)).collect();
        return { body: row, plates };
    },
});

export const componentsForNeck = query({
    args: { neck: v.string() },
    returns: v.array(componentDocV),
    handler: async (ctx, args) =>
        await ctx.db.query("registerComponents").withIndex("by_neck", q => q.eq("neck", args.neck)).collect(),
});

export const assembliesForBody = query({
    args: { bodyId: v.string() },
    returns: v.array(assemblyDocV),
    handler: async (ctx, args) =>
        await ctx.db.query("registerAssemblies").withIndex("by_bodyId", q => q.eq("bodyId", args.bodyId)).collect(),
});

/** Everything the Phase 4 renderer needs for one sellable SKU: its body plate and its own parts. */
export const composition = query({
    args: { graceSku: v.string() },
    returns: v.union(v.null(), v.object({
        assembly: assemblyDocV,
        plate: v.union(bodyPlateDocV, v.null()),
        parts: v.array(v.object({ role: v.string(), componentId: v.string(), component: v.union(componentDocV, v.null()) })),
    })),
    handler: async (ctx, args) => {
        const assembly = await ctx.db.query("registerAssemblies").withIndex("by_graceSku", q => q.eq("graceSku", args.graceSku)).first();
        if (!assembly) return null;
        const plate = await ctx.db.query("registerBodyPlates").withIndex("by_plateKey", q => q.eq("plateKey", assembly.plateKey)).first();
        const parts = [];
        for (const part of assembly.build.parts) {
            const component = await ctx.db.query("registerComponents").withIndex("by_componentId", q => q.eq("componentId", part.componentId)).first();
            parts.push({ role: part.role, componentId: part.componentId, component });
        }
        return { assembly, plate, parts };
    },
});
