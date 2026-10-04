import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { serverQuery, verifyWriteToken } from "./portalAuth";

type Event = Doc<"certificateNotifications">["event"];
export async function enqueueCertificateEvent(ctx: MutationCtx, certificateId: Id<"resaleCertificates">, event: Event) {
    const audiences = event === "sync_failed" ? ["staff"] as const : event === "submitted" ? ["staff", "customer"] as const : ["customer"] as const;
    for (const audience of audiences) {
        const eventKey = `${certificateId}:${event}:${audience}`;
        if (await ctx.db.query("certificateNotifications").withIndex("by_event", q => q.eq("eventKey", eventKey)).unique()) continue;
        await ctx.db.insert("certificateNotifications", { certificateId, eventKey, event, audience, status: "pending", attempts: 0, createdAt: Date.now() });
    }
}
export const list = serverQuery({
    args: { certificateId: v.id("resaleCertificates") },
    handler: (ctx, args) => ctx.db.query("certificateNotifications").withIndex("by_certificate", q => q.eq("certificateId", args.certificateId)).collect(),
});
export const prepare = mutation({
    args: { writeToken: v.string(), notificationId: v.id("certificateNotifications"), attemptId: v.string() },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const event = await ctx.db.get(args.notificationId);
        if (!event || event.status === "sent" || event.status === "sending" || (event.nextAttemptAt && event.nextAttemptAt > Date.now())) return null;
        const certificate = await ctx.db.get(event.certificateId);
        if (!certificate) throw new Error("certificate_not_found");
        const account = await ctx.db.query("portalAccounts").withIndex("by_clerkOrgId", q => q.eq("clerkOrgId", certificate.clerkOrgId)).unique();
        await ctx.db.patch(event._id, { status: "sending", attemptId: args.attemptId, attempts: event.attempts + 1 });
        return { event, certificate, billingEmail: account?.billingEmail ?? null };
    },
});
export const complete = mutation({
    args: { writeToken: v.string(), notificationId: v.id("certificateNotifications"), attemptId: v.string(), status: v.union(v.literal("sent"), v.literal("blocked"), v.literal("failed")), providerMessageId: v.optional(v.string()), failureCode: v.optional(v.string()) },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const event = await ctx.db.get(args.notificationId);
        if (!event || event.status !== "sending" || event.attemptId !== args.attemptId) throw new Error("stale_notification_attempt");
        if (args.status === "sent" && !args.providerMessageId) throw new Error("delivery_receipt_required");
        await ctx.db.patch(event._id, { status: args.status, providerMessageId: args.providerMessageId, failureCode: args.failureCode, sentAt: args.status === "sent" ? Date.now() : undefined, nextAttemptAt: args.status === "failed" ? Date.now() + Math.min(3600_000, 60_000 * 2 ** Math.min(event.attempts, 6)) : undefined });
    },
});
