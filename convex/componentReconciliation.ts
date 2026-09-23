import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { verifyWriteToken } from "./writeToken";
import { componentFindings, auditCheckedAt, validateReview, type SavedReview } from "./componentReconciliationData";
import { inferComponentType, applyApplicatorCompatibilityRules } from "./componentUtils";
import { componentMechanismKey } from "./componentVocabulary";

export const choices = query({
    args: { writeToken: v.string(), caseId: v.string() },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const finding = componentFindings.find(f => f.id === args.caseId);
        if (!finding) throw new Error("Unknown review item");
        const bottles = await ctx.db.query("products").withIndex("by_websiteSku", q => q.eq("websiteSku", finding.bottleSku)).take(2);
        if (bottles.length !== 1 || !bottles[0].neckThreadSize) throw new Error("Bottle identity or neck needs clarification");
        const bottle = bottles[0];
        const parts = await ctx.db.query("products").withIndex("by_neckThreadSize", q => q.eq("neckThreadSize", bottle.neckThreadSize)).take(1201);
        if (parts.length > 1200) throw new Error("Component choices exceed query limit");
        return { catalogVersion: bottle.componentReviewVersion ?? 0,
            appliedSku: bottle.reviewedComponentCorrections?.find(c => c.reviewCaseId === finding.id)?.componentSku ?? null,
            candidates: parts.filter(p => p.category === "Component" && p.websiteSku && !/__RETIRED__/i.test(p.websiteSku))
                .map(p => ({ sku: p.websiteSku, name: p.itemName, neck: p.neckThreadSize!, kind: inferComponentType(p.graceSku, p.itemName) }))
                .sort((a, b) => a.kind.localeCompare(b.kind) || a.sku.localeCompare(b.sku)) };
    },
});

export const list = query({
    args: { writeToken: v.string() },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const rows = await Promise.all(componentFindings.map(async finding => {
            const saved = await ctx.db.query("componentReconciliationReviews")
                .withIndex("by_case_evidence", q => q.eq("caseId", finding.id).eq("evidenceSha", finding.evidenceSha)).unique();
            return { ...finding, review: saved as SavedReview | null };
        }));
        return { checkedAt: auditCheckedAt, rows };
    },
});

export const history = query({
    args: { writeToken: v.string(), caseId: v.string() },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        if (!componentFindings.some(f => f.id === args.caseId)) throw new Error("Unknown review item");
        return await ctx.db.query("componentReconciliationHistory")
            .withIndex("by_case", q => q.eq("caseId", args.caseId)).order("desc").take(50);
    },
});

export const save = mutation({
    args: { writeToken: v.string(), caseId: v.string(), evidenceSha: v.string(), expectedRevision: v.number(),
        actor: v.object({ id: v.string(), email: v.union(v.string(), v.null()) }),
        draft: v.object({ decision: v.union(v.literal("pending"), v.literal("needs_information"), v.literal("confirmed"), v.literal("correction_proposed")),
            correctComponentSku: v.string(), notes: v.string(), sourceUrl: v.string() }),
    },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const finding = componentFindings.find(f => f.id === args.caseId);
        if (!finding || finding.evidenceSha !== args.evidenceSha) return { ok: false as const, error: "The audit evidence changed. Refresh and review the current finding." };
        const draft = { ...args.draft, notes: args.draft.notes.trim(), correctComponentSku: args.draft.correctComponentSku.trim(), sourceUrl: args.draft.sourceUrl.trim() };
        const error = validateReview(draft);
        if (error) return { ok: false as const, error };
        const existing = await ctx.db.query("componentReconciliationReviews")
            .withIndex("by_case_evidence", q => q.eq("caseId", args.caseId).eq("evidenceSha", args.evidenceSha)).unique();
        if ((existing?.revision ?? 0) !== args.expectedRevision) return { ok: false as const, error: "Another reviewer changed this item. Refresh before saving." };
        const review = { ...draft, caseId: args.caseId, evidenceSha: args.evidenceSha,
            revision: (existing?.revision ?? 0) + 1, actorId: args.actor.id, actorEmail: args.actor.email, updatedAt: Date.now() };
        if (existing) await ctx.db.patch(existing._id, review);
        else await ctx.db.insert("componentReconciliationReviews", review);
        await ctx.db.insert("componentReconciliationHistory", review);
        return { ok: true as const, review };
    },
});

/** Explicit staff submission; no model can invoke or approve this correction. */
export const apply = mutation({
    args: { writeToken: v.string(), caseId: v.string(), evidenceSha: v.string(), expectedReviewRevision: v.number(), expectedCatalogVersion: v.number(),
        actor: v.object({ id: v.string(), email: v.union(v.string(), v.null()) }) },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const finding = componentFindings.find(f => f.id === args.caseId);
        if (!finding || finding.evidenceSha !== args.evidenceSha) return { ok: false as const, error: "The audit evidence changed. Refresh first." };
        const review = await ctx.db.query("componentReconciliationReviews").withIndex("by_case_evidence", q => q.eq("caseId", args.caseId).eq("evidenceSha", args.evidenceSha)).unique();
        if (!review || review.revision !== args.expectedReviewRevision || review.decision !== "correction_proposed") return { ok: false as const, error: "Save the proposed correction, then submit its current revision." };
        const bottles = await ctx.db.query("products").withIndex("by_websiteSku", q => q.eq("websiteSku", finding.bottleSku)).take(2);
        const parts = await ctx.db.query("products").withIndex("by_websiteSku", q => q.eq("websiteSku", review.correctComponentSku)).take(2);
        const previous = await ctx.db.query("products").withIndex("by_websiteSku", q => q.eq("websiteSku", finding.componentSku)).take(2);
        if (bottles.length !== 1 || parts.length !== 1 || previous.length !== 1) return { ok: false as const, error: "An exact SKU is missing or ambiguous. Clarify the catalog identity first." };
        const bottle = bottles[0], part = parts[0], old = previous[0];
        if (old.category !== "Component") return { ok: false as const, error: "This finding describes a complete assembly, not a loose part. Clarify its included hardware before creating an association." };
        if ((bottle.componentReviewVersion ?? 0) !== args.expectedCatalogVersion) return { ok: false as const, error: "This bottle's component list changed. Reload component choices before submitting." };
        if (bottle.family !== finding.family || bottle.capacityMl !== finding.capacityMl || bottle.color !== finding.glass || bottle.neckThreadSize !== finding.neck
            || bottle.category !== "Glass Bottle" || /__RETIRED__/i.test(bottle.websiteSku)) return { ok: false as const, error: "Bottle identity changed since the audit. Re-audit before applying." };
        if (part.category !== "Component" || /__RETIRED__/i.test(part.websiteSku) || !part.neckThreadSize || part.neckThreadSize !== bottle.neckThreadSize) return { ok: false as const, error: "Choose an active component with the bottle's exact neck specification." };
        const kind = inferComponentType(part.graceSku, part.itemName);
        if (componentMechanismKey(kind, part.itemName, part.websiteSku) !== componentMechanismKey(inferComponentType(old.graceSku, old.itemName), old.itemName, old.websiteSku)) return { ok: false as const, error: "This changes the hardware type. Record the proposal for catalog review instead of replacing a different mechanism." };
        const normalized = { graceSku: part.graceSku, itemName: part.itemName, imageUrl: null, webPrice1pc: null, webPrice12pc: null, capColor: null, stockStatus: null };
        if (!applyApplicatorCompatibilityRules({ [kind]: [normalized] }, { [kind]: [normalized] }, bottle)[kind]?.length) return { ok: false as const, error: "This component conflicts with the bottle's assembled fitment." };
        const before = bottle.reviewedComponentCorrections ?? [];
        const existing = before.find(c => c.reviewCaseId === finding.id);
        if ((existing?.componentSku ?? finding.componentSku) === part.websiteSku) return { ok: false as const, error: "This association already uses that component. Confirm the association instead." };
        // Preserve unrelated corrections. Changing a previously applied decision replaces
        // that same original link rather than building a chain of guessed replacements.
        const correction = { replaceGraceSku: existing?.replaceGraceSku ?? old.graceSku, componentGraceSku: part.graceSku,
            componentSku: part.websiteSku, componentType: kind, itemName: part.itemName, sourceUrl: review.sourceUrl, reviewCaseId: finding.id };
        const after = [...before.filter(c => c.reviewCaseId !== finding.id), correction];
        await ctx.db.patch(bottle._id, { reviewedComponentCorrections: after, componentReviewVersion: (bottle.componentReviewVersion ?? 0) + 1 });
        await ctx.db.insert("catalogChangeLog", { targetType: "product", targetId: bottle._id, label: bottle.websiteSku,
            field: "reviewedComponentCorrections", before: JSON.stringify(before), after: JSON.stringify(after),
            actorId: args.actor.id, actorEmail: args.actor.email, at: Date.now(), source: "component-review" });
        return { ok: true as const, appliedSku: part.websiteSku, catalogVersion: (bottle.componentReviewVersion ?? 0) + 1 };
    },
});
