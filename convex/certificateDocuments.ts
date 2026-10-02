import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { serverQuery, verifyWriteToken } from "./portalAuth";

export const MAX_CERTIFICATE_BYTES = 15 * 1024 * 1024;
export const issue = mutation({
    args: { writeToken: v.string(), clerkOrgId: v.string(), clerkUserId: v.string(), ticketHash: v.string() },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        if (!/^[a-f0-9]{64}$/.test(args.ticketHash)) throw new Error("invalid_upload_ticket");
        return ctx.db.insert("certificateDocuments", {
            clerkOrgId: args.clerkOrgId, clerkUserId: args.clerkUserId, ticketHash: args.ticketHash,
            expiresAt: Date.now() + 10 * 60_000, status: "issued",
        });
    },
});

// HTTP upload claims the one-use capability before accepting any bytes.
export const claim = internalMutation({
    args: { ticketHash: v.string() },
    handler: async (ctx, args) => {
        const doc = await ctx.db.query("certificateDocuments").withIndex("by_ticket", q => q.eq("ticketHash", args.ticketHash)).unique();
        if (!doc || doc.status !== "issued" || doc.expiresAt <= Date.now()) throw new Error("invalid_upload_ticket");
        await ctx.db.patch(doc._id, { status: "uploading" });
        return doc._id;
    },
});
export const uploaded = internalMutation({
    args: { documentId: v.id("certificateDocuments"), storageId: v.id("_storage") },
    handler: async (ctx, args) => {
        const doc = await ctx.db.get(args.documentId);
        if (!doc || doc.status !== "uploading") throw new Error("invalid_upload_ticket");
        await ctx.db.patch(doc._id, { status: "uploaded", storageId: args.storageId });
    },
});
export const forValidation = serverQuery({
    args: { documentId: v.id("certificateDocuments"), clerkOrgId: v.string(), clerkUserId: v.string() },
    handler: async (ctx, args) => {
        const doc = await ctx.db.get(args.documentId);
        if (!doc || doc.clerkOrgId !== args.clerkOrgId || doc.clerkUserId !== args.clerkUserId || !doc.storageId || doc.status !== "uploaded" || doc.expiresAt <= Date.now()) throw new Error("document_not_available");
        return { ...doc, url: await ctx.storage.getUrl(doc.storageId) };
    },
});
export const markVerified = mutation({
    args: { writeToken: v.string(), documentId: v.id("certificateDocuments"), clerkOrgId: v.string(), clerkUserId: v.string(), contentType: v.string(), size: v.number() },
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);
        const doc = await ctx.db.get(args.documentId);
        if (!doc || doc.clerkOrgId !== args.clerkOrgId || doc.clerkUserId !== args.clerkUserId || doc.status !== "uploaded" || !doc.storageId || doc.expiresAt <= Date.now()) throw new Error("document_not_available");
        const meta = await ctx.db.system.get(doc.storageId);
        if (!meta || meta.size !== args.size || args.size <= 0 || args.size > MAX_CERTIFICATE_BYTES || (meta.contentType !== undefined && meta.contentType !== args.contentType) || !["application/pdf", "image/png", "image/jpeg"].includes(args.contentType)) throw new Error("invalid_certificate_document");
        await ctx.db.patch(doc._id, { status: "verified", verifiedAt: Date.now(), contentType: args.contentType, size: args.size });
        return doc.storageId;
    },
});

export async function requireVerifiedDocument(ctx: QueryCtx | MutationCtx, storageId: Id<"_storage"> | undefined, org: string, user?: string) {
    if (!storageId) throw new Error("supporting_document_required");
    const doc = await ctx.db.query("certificateDocuments").withIndex("by_storage", q => q.eq("storageId", storageId)).unique();
    const meta = await ctx.db.system.get(storageId);
    if (!doc || doc.status !== "verified" || doc.clerkOrgId !== org || (user && doc.clerkUserId !== user) || !meta || meta.size !== doc.size || (meta.contentType !== undefined && meta.contentType !== doc.contentType)) throw new Error("supporting_document_not_verified");
    return doc;
}
