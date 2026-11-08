import { internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Help center questions. Public submit, internal-only reads: a question can
 * carry an email address, so nothing here is readable from the public client.
 * Staff review every question; none is published automatically.
 */

export const HELP_QUESTION_MAX_LENGTH = 1000;
export const HELP_CONSENT_TEXT = "Best Bottles may use my email to answer this question only. It won't be added to marketing lists.";
/** A coarse ceiling on top of the per-visitor limit in the Next route, for direct calls to this mutation. */
const GLOBAL_LIMIT_PER_MINUTE = 30;

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

export const submit = mutation({
    args: {
        question: v.string(),
        wantsReply: v.boolean(),
        email: v.optional(v.string()),
        consent: v.boolean(),
        pagePath: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const question = args.question.trim().replace(/\s+/g, " ");
        if (question.length < 3) throw new Error("Please write a question.");
        if (question.length > HELP_QUESTION_MAX_LENGTH) throw new Error("Please keep the question under 1,000 characters.");

        let email: string | undefined;
        if (args.wantsReply) {
            email = args.email?.trim().toLowerCase();
            if (!email || !EMAIL.test(email)) throw new Error("Please give an email address for the reply.");
            if (!args.consent) throw new Error("Please agree to us using your email for the reply.");
        }

        const now = Date.now();
        const recent = await ctx.db
            .query("helpQuestions")
            .withIndex("by_submittedAt", (q) => q.gt("submittedAt", now - 60_000))
            .take(GLOBAL_LIMIT_PER_MINUTE);
        if (recent.length >= GLOBAL_LIMIT_PER_MINUTE) throw new Error("We're receiving a lot of questions. Please try again in a minute.");

        const pagePath = args.pagePath?.startsWith("/") ? args.pagePath.slice(0, 200) : undefined;
        await ctx.db.insert("helpQuestions", {
            question,
            wantsReply: args.wantsReply,
            ...(email ? { email, consentText: HELP_CONSENT_TEXT, consentAt: now } : {}),
            ...(pagePath ? { pagePath } : {}),
            status: "new",
            submittedAt: now,
        });
        return { ok: true as const };
    },
});

export const listByStatus = internalQuery({
    args: { status: v.union(v.literal("new"), v.literal("reviewing"), v.literal("answered"), v.literal("dismissed")) },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("helpQuestions")
            .withIndex("by_status", (q) => q.eq("status", args.status))
            .order("desc")
            .take(100);
    },
});
