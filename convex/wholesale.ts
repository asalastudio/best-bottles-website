import { query } from "./_generated/server";
import { v } from "convex/values";
import {
    normalizeComponentsByType,
    selectBestFitmentRule,
    inferComponentType,
} from "./componentUtils";
import {
    resolveCompatibility,
    isPurchasable,
    type BottleFacts,
    type ComponentFacts,
} from "../src/lib/wholesale/compatibility";
import {
    verdictFor,
    summarizeFamily,
    findDuplicateSkus,
    type QaProductRow,
} from "../src/lib/wholesale/catalogQa";

/**
 * Wholesale Matrix query layer (PRD §54 phase 3).
 *
 * Two views, ONE dataset: the customer matrix and Catalog QA read the same
 * canonical productGroups/products rows (PRD §36). There is no
 * matrixProducts table and there must not be one — QA differs only by
 * exposing diagnostics the customer view hides.
 *
 * Compatibility decisions come from src/lib/wholesale/compatibility.ts.
 * This file resolves DATA; it does not re-implement the rules.
 */

const familySummary = v.object({
    family: v.string(),
    groupCount: v.number(),
    variantCount: v.number(),
    capacityMlMin: v.union(v.number(), v.null()),
    capacityMlMax: v.union(v.number(), v.null()),
    finishes: v.array(v.string()),
    threadSizes: v.array(v.string()),
});

/**
 * Families for the accordion, derived from canonical productGroups.
 * Never hard-code this list (PRD §10/§52) — it is catalog truth.
 */
export const getWholesaleFamilies = query({
    args: {},
    returns: v.array(familySummary),
    handler: async (ctx) => {
        const groups = await ctx.db.query("productGroups").take(1000);

        const byFamily = new Map<string, {
            groupCount: number;
            variantCount: number;
            capacities: number[];
            finishes: Set<string>;
            threads: Set<string>;
        }>();

        for (const g of groups) {
            const family = g.family?.trim();
            if (!family) continue;      // an unfamilied group is a QA finding, not a row
            const entry = byFamily.get(family) ?? {
                groupCount: 0, variantCount: 0,
                capacities: [], finishes: new Set<string>(), threads: new Set<string>(),
            };
            entry.groupCount += 1;
            entry.variantCount += g.variantCount ?? 0;
            if (typeof g.capacityMl === "number") entry.capacities.push(g.capacityMl);
            if (g.color) entry.finishes.add(g.color);
            if (g.neckThreadSize) entry.threads.add(g.neckThreadSize);
            byFamily.set(family, entry);
        }

        return [...byFamily.entries()]
            .map(([family, e]) => ({
                family,
                groupCount: e.groupCount,
                variantCount: e.variantCount,
                capacityMlMin: e.capacities.length ? Math.min(...e.capacities) : null,
                capacityMlMax: e.capacities.length ? Math.max(...e.capacities) : null,
                finishes: [...e.finishes].sort(),
                threadSizes: [...e.threads].sort(),
            }))
            .sort((a, b) => b.variantCount - a.variantCount);
    },
});

const matrixRow = v.object({
    groupId: v.id("productGroups"),
    slug: v.string(),
    displayName: v.string(),
    family: v.string(),
    capacity: v.union(v.string(), v.null()),
    capacityMl: v.union(v.number(), v.null()),
    color: v.union(v.string(), v.null()),
    neckThreadSize: v.union(v.string(), v.null()),
    imageUrl: v.union(v.string(), v.null()),
    primaryGraceSku: v.union(v.string(), v.null()),
    variantCount: v.number(),
    priceFrom: v.union(v.number(), v.null()),
});

/**
 * The rows for one expanded family. A row is a configurable bottle record
 * (PRD §13), not a Cartesian permutation — size/finish are resolved per row.
 */
export const getFamilyRows = query({
    args: { family: v.string(), limit: v.optional(v.number()) },
    returns: v.array(matrixRow),
    handler: async (ctx, { family, limit }) => {
        const groups = await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", family))
            .take(Math.min(limit ?? 60, 200));

        return groups.map((g) => ({
            groupId: g._id,
            slug: g.slug,
            displayName: g.displayName,
            family: g.family,
            capacity: g.capacity,
            capacityMl: g.capacityMl,
            color: g.color,
            neckThreadSize: g.neckThreadSize,
            imageUrl: g.heroImageUrl ?? null,
            primaryGraceSku: g.primaryGraceSku ?? null,
            variantCount: g.variantCount ?? 0,
            priceFrom: g.priceRangeMin,
        }));
    },
});

const resolvedVariant = v.object({
    graceSku: v.string(),
    websiteSku: v.string(),
    itemName: v.string(),
    capacity: v.union(v.string(), v.null()),
    capacityMl: v.union(v.number(), v.null()),
    color: v.union(v.string(), v.null()),
    neckThreadSize: v.union(v.string(), v.null()),
    imageUrl: v.union(v.string(), v.null()),
    webPrice1pc: v.union(v.number(), v.null()),
    webPrice10pc: v.union(v.number(), v.null()),
    webPrice12pc: v.union(v.number(), v.null()),
    caseQuantity: v.union(v.number(), v.null()),
    stockStatus: v.union(v.string(), v.null()),
    shopifyVariantId: v.union(v.string(), v.null()),
    shopifySellable: v.union(v.boolean(), v.null()),
    purchasable: v.boolean(),
});

/**
 * Bottle design + capacity + finish -> the real Convex variant.
 * Never fabricate a variant client-side (PRD §14).
 */
export const resolveBottleVariant = query({
    args: {
        groupId: v.id("productGroups"),
        capacityMl: v.optional(v.number()),
        color: v.optional(v.string()),
    },
    returns: v.union(resolvedVariant, v.null()),
    handler: async (ctx, { groupId, capacityMl, color }) => {
        const variants = await ctx.db
            .query("products")
            .withIndex("by_productGroupId", (q) => q.eq("productGroupId", groupId))
            .take(200);
        if (variants.length === 0) return null;

        const wantedColor = color?.trim().toLowerCase() ?? null;
        const match = variants.find((p) => {
            const capOk = capacityMl == null || p.capacityMl === capacityMl;
            const colorOk = wantedColor == null
                || (p.color ?? "").trim().toLowerCase() === wantedColor;
            return capOk && colorOk;
        });
        if (!match) return null;

        return {
            graceSku: match.graceSku,
            websiteSku: match.websiteSku,
            itemName: match.itemName,
            capacity: match.capacity,
            capacityMl: match.capacityMl,
            color: match.color,
            neckThreadSize: match.neckThreadSize,
            imageUrl: match.imageUrl ?? null,
            webPrice1pc: match.webPrice1pc,
            webPrice10pc: match.webPrice10pc,
            webPrice12pc: match.webPrice12pc,
            caseQuantity: match.caseQuantity,
            stockStatus: match.stockStatus,
            shopifyVariantId: match.shopifyVariantId ?? null,
            shopifySellable: match.shopifySellable ?? null,
            purchasable: isPurchasable({
                stockStatus: match.stockStatus,
                shopifySellable: match.shopifySellable ?? null,
            }),
        };
    },
});

const compatibleComponent = v.object({
    graceSku: v.string(),
    itemName: v.string(),
    componentType: v.string(),
    capColor: v.union(v.string(), v.null()),
    imageUrl: v.union(v.string(), v.null()),
    webPrice1pc: v.union(v.number(), v.null()),
    webPrice12pc: v.union(v.number(), v.null()),
    stockStatus: v.union(v.string(), v.null()),
    purchasable: v.boolean(),
    compatibilitySource: v.string(),
});

/**
 * Only components the compatibility engine says fit (PRD §17). The picker
 * shows exactly this list — an incompatible option is never rendered and
 * then rejected later.
 */
export const getCompatibleComponents = query({
    args: { bottleGraceSku: v.string() },
    returns: v.object({
        threadSize: v.union(v.string(), v.null()),
        byType: v.record(v.string(), v.array(compatibleComponent)),
        totalCount: v.number(),
        mappingMissing: v.boolean(),
    }),
    handler: async (ctx, { bottleGraceSku }) => {
        const bottle = await ctx.db
            .query("products")
            .withIndex("by_graceSku", (q) => q.eq("graceSku", bottleGraceSku))
            .unique();
        if (!bottle) {
            return { threadSize: null, byType: {}, totalCount: 0, mappingMissing: true };
        }

        const facts: BottleFacts = {
            graceSku: bottle.graceSku,
            family: bottle.family,
            capacityMl: bottle.capacityMl,
            neckThreadSize: bottle.neckThreadSize,
            itemName: bottle.itemName,
            color: bottle.color,
            stockStatus: bottle.stockStatus,
            shopifySellable: bottle.shopifySellable ?? null,
        };

        // the fitment rules that could apply to this thread
        const rules = bottle.neckThreadSize
            ? await ctx.db
                .query("fitments")
                .withIndex("by_threadSize", (q) =>
                    q.eq("threadSize", bottle.neckThreadSize as string))
                .take(200)
            : [];
        const rule = selectBestFitmentRule(rules, facts);

        // allowed types from the matched rule, when it names any
        let allowedTypes: Set<string> | null = null;
        if (rule?.components && typeof rule.components === "object" && !Array.isArray(rule.components)) {
            const named = Object.keys(rule.components as Record<string, unknown>);
            if (named.length > 0) allowedTypes = new Set(named);
        }

        const grouped = normalizeComponentsByType(bottle.components);
        const byType: Record<string, Array<Record<string, unknown>>> = {};
        let totalCount = 0;

        for (const [type, items] of Object.entries(grouped)) {
            for (const item of items) {
                if (!item.graceSku) continue;
                const component: ComponentFacts = {
                    graceSku: item.graceSku,
                    itemName: item.itemName || null,
                    componentType: type || inferComponentType(item.graceSku, item.itemName),
                    // components inherit the bottle's thread in this dataset;
                    // an explicit per-component thread is not recorded today
                    neckThreadSize: bottle.neckThreadSize,
                    stockStatus: item.stockStatus,
                    shopifySellable: null,
                };
                const verdict = resolveCompatibility(facts, component, { allowedTypes });
                if (!verdict.compatible) continue;

                (byType[component.componentType] ??= []).push({
                    graceSku: component.graceSku,
                    itemName: component.itemName ?? component.graceSku,
                    componentType: component.componentType,
                    capColor: item.capColor,
                    imageUrl: item.imageUrl,
                    webPrice1pc: item.webPrice1pc,
                    webPrice12pc: item.webPrice12pc,
                    stockStatus: item.stockStatus,
                    purchasable: isPurchasable({
                        stockStatus: item.stockStatus,
                        shopifySellable: null,
                    }),
                    compatibilitySource: verdict.source,
                });
                totalCount += 1;
            }
        }

        return {
            threadSize: bottle.neckThreadSize,
            byType: byType as never,
            totalCount,
            mappingMissing: totalCount === 0,
        };
    },
});

/**
 * Server-side validation (PRD §41). The UI must never be the only gate —
 * this is what an order line is checked against before it is created.
 */
export const validateBottleConfiguration = query({
    args: {
        bottleGraceSku: v.string(),
        componentGraceSku: v.optional(v.string()),
        componentMode: v.union(v.literal("with_component"), v.literal("bottle_only")),
        quantity: v.number(),
    },
    returns: v.object({
        valid: v.boolean(),
        errors: v.array(v.object({ code: v.string(), message: v.string() })),
        resolvedFitment: v.union(v.string(), v.null()),
        compatibilitySource: v.union(v.string(), v.null()),
    }),
    handler: async (ctx, args) => {
        const errors: Array<{ code: string; message: string }> = [];

        if (!Number.isInteger(args.quantity) || args.quantity <= 0) {
            errors.push({ code: "invalid_quantity", message: "Enter a quantity of at least 1." });
        }

        const bottle = await ctx.db
            .query("products")
            .withIndex("by_graceSku", (q) => q.eq("graceSku", args.bottleGraceSku))
            .unique();

        if (!bottle) {
            errors.push({
                code: "bottle_not_found",
                message: "This bottle configuration is currently unavailable.",
            });
            return { valid: false, errors, resolvedFitment: null, compatibilitySource: null };
        }

        if (!isPurchasable({
            stockStatus: bottle.stockStatus,
            shopifySellable: bottle.shopifySellable ?? null,
        })) {
            errors.push({
                code: "bottle_unavailable",
                message: "This bottle configuration is currently unavailable.",
            });
        }

        let compatibilitySource: string | null = null;

        if (args.componentMode === "with_component") {
            if (!args.componentGraceSku) {
                // an unset component is NOT bottle-only (PRD §20)
                errors.push({
                    code: "component_required",
                    message: "Choose a component, or select Bottle Only.",
                });
            } else {
                const facts: BottleFacts = {
                    graceSku: bottle.graceSku,
                    family: bottle.family,
                    capacityMl: bottle.capacityMl,
                    neckThreadSize: bottle.neckThreadSize,
                    itemName: bottle.itemName,
                    color: bottle.color,
                    stockStatus: bottle.stockStatus,
                    shopifySellable: bottle.shopifySellable ?? null,
                };
                const grouped = normalizeComponentsByType(bottle.components);
                let found: { type: string; stockStatus: string | null } | null = null;
                for (const [type, items] of Object.entries(grouped)) {
                    const hit = items.find((i) => i.graceSku === args.componentGraceSku);
                    if (hit) { found = { type, stockStatus: hit.stockStatus }; break; }
                }

                if (!found) {
                    errors.push({
                        code: "component_incompatible",
                        message: "This component isn't compatible with the selected bottle.",
                    });
                } else {
                    const verdict = resolveCompatibility(facts, {
                        graceSku: args.componentGraceSku,
                        itemName: null,
                        componentType: found.type,
                        neckThreadSize: bottle.neckThreadSize,
                        stockStatus: found.stockStatus,
                        shopifySellable: null,
                    });
                    compatibilitySource = verdict.source;
                    if (!verdict.compatible) {
                        errors.push({
                            code: "component_incompatible",
                            message: verdict.reason ?? "This component isn't compatible with the selected bottle.",
                        });
                    }
                    if (!isPurchasable({ stockStatus: found.stockStatus, shopifySellable: null })) {
                        errors.push({
                            code: "component_unavailable",
                            message: "This component is currently unavailable. Please choose another option.",
                        });
                    }
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            resolvedFitment: bottle.neckThreadSize,
            compatibilitySource,
        };
    },
});

/* ------------------------------------------------------------------ QA --
 * Catalog QA reads the SAME rows the customer matrix reads (PRD §36) and
 * differs only by exposing diagnostics. Rules live in
 * src/lib/wholesale/catalogQa.ts so this, the QA screen and Grace can never
 * disagree about what "incomplete" means.
 *
 * PAGINATED BY DESIGN: a full products scan exceeds Convex's 16MB
 * per-execution read limit (reproduced against production). Callers walk
 * families, or pass a cursor.
 */

const qaFinding = v.object({
    code: v.string(),
    field: v.string(),
    severity: v.string(),
    message: v.string(),
});

const qaRow = v.object({
    graceSku: v.string(),
    websiteSku: v.string(),
    itemName: v.string(),
    family: v.union(v.string(), v.null()),
    status: v.string(),
    blocking: v.number(),
    degraded: v.number(),
    advisory: v.number(),
    findings: v.array(qaFinding),
});

function toQaRow(p: Record<string, unknown>): QaProductRow {
    return {
        graceSku: (p.graceSku as string) ?? "",
        websiteSku: (p.websiteSku as string) ?? "",
        itemName: (p.itemName as string) ?? "",
        family: (p.family as string | null) ?? null,
        color: (p.color as string | null) ?? null,
        capacity: (p.capacity as string | null) ?? null,
        capacityMl: (p.capacityMl as number | null) ?? null,
        neckThreadSize: (p.neckThreadSize as string | null) ?? null,
        heightWithCap: (p.heightWithCap as string | null) ?? null,
        diameter: (p.diameter as string | null) ?? null,
        caseQuantity: (p.caseQuantity as number | null) ?? null,
        webPrice1pc: (p.webPrice1pc as number | null) ?? null,
        stockStatus: (p.stockStatus as string | null) ?? null,
        imageUrl: (p.imageUrl as string | null) ?? null,
        imageUrlCapOff: (p.imageUrlCapOff as string | null) ?? null,
        components: p.components,
        category: (p.category as string | null) ?? null,
        assemblyType: (p.assemblyType as string | null) ?? null,
        productGroupId: (p.productGroupId as string | null) ?? null,
        shopifySellable: (p.shopifySellable as boolean | null) ?? null,
        shopifyVariantId: (p.shopifyVariantId as string | null) ?? null,
        paperDollBodyUrl: (p.paperDollBodyUrl as string | null) ?? null,
    };
}

/** Per-row QA for one family — what the Catalog QA table renders. */
export const getFamilyQa = query({
    args: { family: v.string(), limit: v.optional(v.number()) },
    returns: v.object({
        family: v.string(),
        total: v.number(),
        complete: v.number(),
        degraded: v.number(),
        incomplete: v.number(),
        completionPct: v.number(),
        topIssues: v.array(v.object({
            code: v.string(), count: v.number(), severity: v.string(),
        })),
        duplicateSkus: v.array(v.string()),
        rows: v.array(qaRow),
    }),
    handler: async (ctx, { family, limit }) => {
        const products = await ctx.db
            .query("products")
            .withIndex("by_family", (q) => q.eq("family", family))
            .take(Math.min(limit ?? 300, 400));

        const verdicts = products.map((p) =>
            verdictFor(toQaRow(p as unknown as Record<string, unknown>)));
        const health = summarizeFamily(family, verdicts);

        return {
            ...health,
            duplicateSkus: findDuplicateSkus(products.map((p) => ({ graceSku: p.graceSku }))),
            rows: verdicts.map((v) => {
                const p = products.find((x) => x.graceSku === v.graceSku);
                return {
                    graceSku: v.graceSku,
                    websiteSku: p?.websiteSku ?? "",
                    itemName: p?.itemName ?? "",
                    family: v.family,
                    status: v.status,
                    blocking: v.blocking,
                    degraded: v.degraded,
                    advisory: v.advisory,
                    findings: v.findings,
                };
            }),
        };
    },
});

/**
 * Catalog health for Grace and the QA header — counts only, no row bodies,
 * so it stays inside the read limit for a whole family.
 */
export const getCatalogHealth = query({
    args: { families: v.optional(v.array(v.string())) },
    returns: v.object({
        scanned: v.number(),
        complete: v.number(),
        degraded: v.number(),
        incomplete: v.number(),
        completionPct: v.number(),
        byFamily: v.array(v.object({
            family: v.string(),
            total: v.number(),
            complete: v.number(),
            completionPct: v.number(),
            blockingIssues: v.number(),
        })),
        topIssues: v.array(v.object({
            code: v.string(), count: v.number(), severity: v.string(),
        })),
    }),
    handler: async (ctx, { families }) => {
        const targets = families?.length
            ? families
            : [...new Set(
                (await ctx.db.query("productGroups").take(400))
                    .map((g) => g.family)
                    .filter((f): f is string => Boolean(f)),
              )].slice(0, 12);

        let scanned = 0, complete = 0, degraded = 0, incomplete = 0;
        const codeCounts = new Map<string, { count: number; severity: string }>();
        const byFamily: Array<{
            family: string; total: number; complete: number;
            completionPct: number; blockingIssues: number;
        }> = [];

        for (const family of targets) {
            const products = await ctx.db
                .query("products")
                .withIndex("by_family", (q) => q.eq("family", family))
                .take(150);
            if (products.length === 0) continue;

            const verdicts = products.map((p) =>
                verdictFor(toQaRow(p as unknown as Record<string, unknown>)));
            const health = summarizeFamily(family, verdicts);

            scanned += health.total;
            complete += health.complete;
            degraded += health.degraded;
            incomplete += health.incomplete;
            for (const issue of health.topIssues) {
                const e = codeCounts.get(issue.code) ?? { count: 0, severity: issue.severity };
                e.count += issue.count;
                codeCounts.set(issue.code, e);
            }
            byFamily.push({
                family,
                total: health.total,
                complete: health.complete,
                completionPct: health.completionPct,
                blockingIssues: verdicts.reduce((n, v) => n + v.blocking, 0),
            });
        }

        return {
            scanned, complete, degraded, incomplete,
            completionPct: scanned ? Math.round((complete / scanned) * 100) : 0,
            byFamily: byFamily.sort((a, b) => a.completionPct - b.completionPct),
            topIssues: [...codeCounts.entries()]
                .map(([code, e]) => ({ code, count: e.count, severity: e.severity }))
                .sort((a, b) => b.count - a.count),
        };
    },
});
