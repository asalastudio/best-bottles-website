import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v, type Infer } from "convex/values";
import schema from "./schema";
import { verifyWriteToken } from "./writeToken";

/**
 * Guarded catalogue corrections for descriptive fields the Team Hub editor does not expose.
 *
 * 2026-09-25: ten clear-glass 9 mL Cylinder rows carried the glass colour "Clear" as their cap
 * colour, and the 17-415 turquoise sprayer carried "Shiny" (see
 * scripts/catalog-corrections/2026-09-25-cyl9-cap-colours.mjs and data/register/report.md).
 * Same day: the Pillar 9 mL spray bottle (GBPillar9SpryBlkMatt) had been hand-seeded as a
 * 17-415 with the 9 mL Cylinder's component list; it is a 13-415 like every other Pillar
 * (see scripts/catalog-corrections/2026-09-25-pillar-spray-neck.mjs).
 *
 * Every write is conditional: a field changes only while it still holds `expect`. A row someone
 * has since edited is reported as `changedSince` and left alone, so a second run is a no-op.
 * Only the fields in `fieldsV` / `groupFieldsV` can be written. `dryRun` defaults to TRUE. Each
 * field written leaves one catalogChangeLog entry; to undo, run again with expect and patch swapped.
 */

const fieldsV = v.object({
    capColor: v.optional(v.union(v.string(), v.null())),
    neckThreadSize: v.optional(v.union(v.string(), v.null())),
    graceDescription: v.optional(v.union(v.string(), v.null())),
    useCaseDescription: v.optional(v.union(v.string(), v.null())),
    heightWithCap: v.optional(v.union(v.string(), v.null())),
    // 2026-09-25: the four 1 ml plug vials carried cap lengths ("Tall", "Applicator") as their
    // cap style, so the catalog swatch read "Tall White"; their closure is a plug.
    capStyle: v.optional(v.union(v.string(), v.null())),
    // 2026-09-25: the ten Minaret dab-on cap SKUs were filed as sprayers or roll-ons; they are caps.
    applicator: v.optional(schema.tables.products.validator.fields.applicator),
    // 2026-09-28: GBCyl5SpryBlkMatt was the one 5 mL clear Cylinder recorded as 5.5 mL; its name, SKU and seven
    // siblings say 5 mL. Capacity is identity the Team Hub editor never writes, so it is corrected here, guarded.
    capacity: v.optional(v.union(v.string(), v.null())),
    capacityMl: v.optional(v.union(v.number(), v.null())),
    // 2026-09-30: the 5 mL Cylinder's sizes came from the legacy site ("53 ±1 mm", "17 ±0.5 mm", five at "60 ±1 mm");
    // Jordan's caliper readings replace them.
    heightWithoutCap: v.optional(v.union(v.string(), v.null())),
    diameter: v.optional(v.union(v.string(), v.null())),
    // 2026-10-01: three plastic flip-top bottles (PbClear4ozFlpWh, PbClear8ozFlpWh, PbNat16ozFlpWh) were filed in the
    // glass Cylinder family; they belong with the other plastic bottles (Jordan, Build Your Bottle checklist 8b).
    family: v.optional(v.union(v.string(), v.null())),
    bottleCollection: v.optional(v.union(v.string(), v.null())),
});
type Fields = Infer<typeof fieldsV>;
/** A corrected field's value as reported: text for most fields, a number for capacityMl. */
const fieldValueV = v.union(v.string(), v.number(), v.null());
type FieldValue = Infer<typeof fieldValueV>;

const groupFieldsV = v.object({
    slug: v.optional(v.string()),
    neckThreadSize: v.optional(v.union(v.string(), v.null())),
    // 2026-10-01: the plastic flip-top groups move to the Plastic Bottle family with their bottles.
    family: v.optional(v.string()),
    bottleCollection: v.optional(v.union(v.string(), v.null())),
});
type GroupFields = { slug?: string; neckThreadSize?: string | null; family?: string; bottleCollection?: string | null };

async function logChange(
    ctx: MutationCtx,
    entry: { targetType: "product" | "group" | "fitment"; targetId: string; label: string; field: string; before: unknown; after: unknown; at: number; reason: string },
) {
    await ctx.db.insert("catalogChangeLog", {
        targetType: entry.targetType, targetId: entry.targetId, label: entry.label, field: entry.field,
        before: JSON.stringify(entry.before ?? null), after: JSON.stringify(entry.after ?? null),
        actorId: "catalog-correction", actorEmail: null, at: entry.at, source: `catalog-correction: ${entry.reason}`,
    });
}

export const correctProductFields = mutation({
    args: {
        writeToken: v.string(),
        dryRun: v.optional(v.boolean()),
        reason: v.string(),
        entries: v.array(v.object({ websiteSku: v.string(), expect: fieldsV, patch: fieldsV })),
    },
    returns: v.object({
        dryRun: v.boolean(),
        written: v.array(v.object({ websiteSku: v.string(), field: v.string(), before: fieldValueV, after: fieldValueV })),
        alreadyCorrect: v.array(v.string()),
        changedSince: v.array(v.object({ websiteSku: v.string(), field: v.string(), now: fieldValueV })),
        notFound: v.array(v.string()),
    }),
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        if (args.entries.length > 50) throw new Error("at most 50 entries per call");
        if (!args.reason.trim()) throw new Error("a reason is required");
        const dryRun = args.dryRun !== false;
        const at = Date.now();
        const out = {
            dryRun,
            written: [] as { websiteSku: string; field: string; before: FieldValue; after: FieldValue }[],
            alreadyCorrect: [] as string[],
            changedSince: [] as { websiteSku: string; field: string; now: FieldValue }[],
            notFound: [] as string[],
        };
        for (const entry of args.entries) {
            const rows = await ctx.db.query("products").withIndex("by_websiteSku", q => q.eq("websiteSku", entry.websiteSku)).take(2);
            if (rows.length !== 1) { out.notFound.push(entry.websiteSku); continue; }
            const row = rows[0];
            const write: Fields = {};
            for (const field of Object.keys(entry.patch) as (keyof Fields)[]) {
                const now = row[field] ?? null;
                const target = entry.patch[field] ?? null;
                if (now === target) { out.alreadyCorrect.push(`${entry.websiteSku}.${field}`); continue; }
                if (!(field in entry.expect) || now !== (entry.expect[field] ?? null)) { out.changedSince.push({ websiteSku: entry.websiteSku, field, now }); continue; }
                Object.assign(write, { [field]: target });
                out.written.push({ websiteSku: entry.websiteSku, field, before: now, after: target });
                if (!dryRun) {
                    await logChange(ctx, { targetType: "product", targetId: String(row._id), label: entry.websiteSku, field, before: now, after: target, at, reason: args.reason });
                }
            }
            if (!dryRun && Object.keys(write).length) await ctx.db.patch(row._id, write);
        }
        return out;
    },
});

/**
 * Same contract for a product group's identity fields. A slug change is refused while another
 * group already owns the target slug (the storefront resolves groups by slug).
 */
export const correctGroupFields = mutation({
    args: {
        writeToken: v.string(),
        dryRun: v.optional(v.boolean()),
        reason: v.string(),
        entries: v.array(v.object({ slug: v.string(), expect: groupFieldsV, patch: groupFieldsV })),
    },
    returns: v.object({
        dryRun: v.boolean(),
        written: v.array(v.object({ slug: v.string(), field: v.string(), before: v.union(v.string(), v.null()), after: v.union(v.string(), v.null()) })),
        alreadyCorrect: v.array(v.string()),
        changedSince: v.array(v.object({ slug: v.string(), field: v.string(), now: v.union(v.string(), v.null()) })),
        notFound: v.array(v.string()),
    }),
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        if (args.entries.length > 50) throw new Error("at most 50 entries per call");
        if (!args.reason.trim()) throw new Error("a reason is required");
        const dryRun = args.dryRun !== false;
        const at = Date.now();
        const out = {
            dryRun,
            written: [] as { slug: string; field: string; before: string | null; after: string | null }[],
            alreadyCorrect: [] as string[],
            changedSince: [] as { slug: string; field: string; now: string | null }[],
            notFound: [] as string[],
        };
        for (const entry of args.entries) {
            const rows = await ctx.db.query("productGroups").withIndex("by_slug", q => q.eq("slug", entry.slug)).take(2);
            if (rows.length !== 1) { out.notFound.push(entry.slug); continue; }
            const row = rows[0];
            const write: GroupFields = {};
            for (const field of Object.keys(entry.patch) as (keyof GroupFields)[]) {
                const now = row[field] ?? null;
                const target = entry.patch[field] ?? null;
                if (now === target) { out.alreadyCorrect.push(`${entry.slug}.${field}`); continue; }
                if (!(field in entry.expect) || now !== (entry.expect[field] ?? null)) { out.changedSince.push({ slug: entry.slug, field, now }); continue; }
                if (field === "slug") {
                    if (typeof target !== "string" || !/^[a-z0-9][a-z0-9.-]*$/.test(target)) throw new Error(`invalid slug "${target}"`);
                    const taken = await ctx.db.query("productGroups").withIndex("by_slug", q => q.eq("slug", target)).first();
                    if (taken) throw new Error(`slug "${target}" already belongs to another group`);
                    write.slug = target;
                } else if (field === "family") {
                    if (typeof target !== "string" || !target.trim()) throw new Error("a group's family must be a name");
                    write.family = target;
                } else {
                    write[field] = target;
                }
                out.written.push({ slug: entry.slug, field, before: now, after: target });
                if (!dryRun) {
                    await logChange(ctx, { targetType: "group", targetId: String(row._id), label: entry.slug, field, before: now, after: target, at, reason: args.reason });
                }
            }
            if (!dryRun && Object.keys(write).length) await ctx.db.patch(row._id, write);
        }
        return out;
    },
});

/** A fitment rule's correctable values: its capacity, and any of its component markers ("✓" fits, "—" does not). */
const fitmentFieldsV = v.object({
    capacityMl: v.optional(v.union(v.number(), v.null())),
    components: v.optional(v.record(v.string(), v.string())),
});
const fitmentValueV = v.union(v.string(), v.number(), v.null());

/**
 * Same contract for the fitments table, which had no write path (Jordan, Build Your Bottle checklist 2026-10-01: the
 * "Sleek 30ml" rule said droppers don't fit although the catalogue sells three Sleek 30 dropper bottles). A rule is
 * named by its bottle name and thread; `components` names only the markers to change, each guarded by its own
 * `expect`, and the rest of the rule's markers are kept. Each value written leaves one catalogChangeLog entry
 * (target "fitment", field "capacityMl" or "components.<marker>").
 */
export const correctFitmentRules = mutation({
    args: {
        writeToken: v.string(),
        dryRun: v.optional(v.boolean()),
        reason: v.string(),
        entries: v.array(v.object({ bottleName: v.string(), threadSize: v.string(), expect: fitmentFieldsV, patch: fitmentFieldsV })),
    },
    returns: v.object({
        dryRun: v.boolean(),
        written: v.array(v.object({ rule: v.string(), field: v.string(), before: fitmentValueV, after: fitmentValueV })),
        alreadyCorrect: v.array(v.string()),
        changedSince: v.array(v.object({ rule: v.string(), field: v.string(), now: fitmentValueV })),
        notFound: v.array(v.string()),
    }),
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        if (args.entries.length > 50) throw new Error("at most 50 entries per call");
        if (!args.reason.trim()) throw new Error("a reason is required");
        const dryRun = args.dryRun !== false;
        const at = Date.now();
        const out = {
            dryRun,
            written: [] as { rule: string; field: string; before: string | number | null; after: string | number | null }[],
            alreadyCorrect: [] as string[],
            changedSince: [] as { rule: string; field: string; now: string | number | null }[],
            notFound: [] as string[],
        };
        for (const entry of args.entries) {
            const label = `${entry.bottleName} ${entry.threadSize}`;
            const rows = (await ctx.db.query("fitments").withIndex("by_bottleName", q => q.eq("bottleName", entry.bottleName)).take(10))
                .filter(row => row.threadSize === entry.threadSize);
            if (rows.length !== 1) { out.notFound.push(label); continue; }
            const row = rows[0];
            const markers = { ...((row.components ?? {}) as Record<string, string>) };
            const write: { capacityMl?: number | null; components?: Record<string, string> } = {};
            const changes: { field: string; before: string | number | null; after: string | number | null }[] = [];
            if ("capacityMl" in entry.patch) {
                const now = row.capacityMl ?? null, target = entry.patch.capacityMl ?? null;
                if (now === target) out.alreadyCorrect.push(`${label}.capacityMl`);
                else if (!("capacityMl" in entry.expect) || now !== (entry.expect.capacityMl ?? null)) out.changedSince.push({ rule: label, field: "capacityMl", now });
                else { write.capacityMl = target; changes.push({ field: "capacityMl", before: now, after: target }); }
            }
            for (const [marker, target] of Object.entries(entry.patch.components ?? {})) {
                const now = markers[marker] ?? null;
                const field = `components.${marker}`;
                if (now === target) { out.alreadyCorrect.push(`${label}.${field}`); continue; }
                const expected = entry.expect.components?.[marker];
                if (expected === undefined || now !== expected) { out.changedSince.push({ rule: label, field, now }); continue; }
                markers[marker] = target;
                write.components = markers;
                changes.push({ field, before: now, after: target });
            }
            for (const change of changes) {
                out.written.push({ rule: label, ...change });
                if (!dryRun) await logChange(ctx, { targetType: "fitment", targetId: String(row._id), label, field: change.field, before: change.before, after: change.after, at, reason: args.reason });
            }
            if (!dryRun && changes.length) await ctx.db.patch(row._id, write);
        }
        return out;
    },
});

const componentSku = (component: unknown): string => {
    if (!component || typeof component !== "object") return "";
    const c = component as { grace_sku?: unknown; graceSku?: unknown };
    return typeof c.grace_sku === "string" ? c.grace_sku : typeof c.graceSku === "string" ? c.graceSku : "";
};

/**
 * Replaces one bottle's compatible-component list with a sibling's (same neck finish), but only
 * while the bottle still lists exactly `expectComponentSkus`. Logged as one change on `components`.
 */
export const correctProductComponents = mutation({
    args: {
        writeToken: v.string(),
        dryRun: v.optional(v.boolean()),
        reason: v.string(),
        websiteSku: v.string(),
        copyFromWebsiteSku: v.string(),
        expectComponentSkus: v.array(v.string()),
    },
    returns: v.object({
        dryRun: v.boolean(),
        websiteSku: v.string(),
        outcome: v.union(v.literal("written"), v.literal("would-write"), v.literal("already-correct"), v.literal("changed-since"), v.literal("not-found")),
        before: v.array(v.string()),
        after: v.array(v.string()),
    }),
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        if (!args.reason.trim()) throw new Error("a reason is required");
        const dryRun = args.dryRun !== false;
        const targets = await ctx.db.query("products").withIndex("by_websiteSku", q => q.eq("websiteSku", args.websiteSku)).take(2);
        const sources = await ctx.db.query("products").withIndex("by_websiteSku", q => q.eq("websiteSku", args.copyFromWebsiteSku)).take(2);
        if (targets.length !== 1 || sources.length !== 1) return { dryRun, websiteSku: args.websiteSku, outcome: "not-found" as const, before: [], after: [] };
        const [target, source] = [targets[0], sources[0]];
        const current = Array.isArray(target.components) ? (target.components as unknown[]) : [];
        const replacement = Array.isArray(source.components) ? (source.components as unknown[]) : [];
        if (replacement.length === 0) throw new Error(`${args.copyFromWebsiteSku} lists no components to copy`);
        const before = current.map(componentSku);
        const after = replacement.map(componentSku);
        if (JSON.stringify(before) === JSON.stringify(after)) return { dryRun, websiteSku: args.websiteSku, outcome: "already-correct" as const, before, after };
        if (JSON.stringify(before) !== JSON.stringify(args.expectComponentSkus)) return { dryRun, websiteSku: args.websiteSku, outcome: "changed-since" as const, before, after };
        if (dryRun) return { dryRun, websiteSku: args.websiteSku, outcome: "would-write" as const, before, after };
        await logChange(ctx, { targetType: "product", targetId: String(target._id), label: args.websiteSku, field: "components", before, after, at: Date.now(), reason: `${args.reason} (copied from ${args.copyFromWebsiteSku})` });
        await ctx.db.patch(target._id, { components: replacement });
        return { dryRun, websiteSku: args.websiteSku, outcome: "written" as const, before, after };
    },
});
