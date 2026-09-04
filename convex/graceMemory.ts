import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const OWNER_MAX = 128;
const PROFILE_MAX = 400;
const CORRECTION_MAX = 400;
const HREF_MAX = 400;
const TITLE_MAX = 120;
const SKU_MAX = 80;

const destinationValidator = v.object({
    href: v.string(),
    title: v.string(),
    sku: v.optional(v.string()),
    at: v.number(),
});

const correctionValidator = v.object({
    text: v.string(),
    at: v.number(),
});

const noteValidator = v.object({
    ownerKey: v.string(),
    profile: v.optional(v.string()),
    lastCorrection: v.optional(correctionValidator),
    lastDestination: v.optional(destinationValidator),
    updatedAt: v.number(),
});

function assertOwnerKey(ownerKey: string): string {
    const trimmed = ownerKey.trim();
    if (!trimmed || trimmed.length > OWNER_MAX) {
        throw new Error("Invalid owner key");
    }
    return trimmed;
}

function clip(value: string, max: number): string {
    const trimmed = value.trim();
    return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

export const getByOwner = query({
    args: { ownerKey: v.string() },
    returns: v.union(noteValidator, v.null()),
    handler: async (ctx, args) => {
        const ownerKey = assertOwnerKey(args.ownerKey);
        const row = await ctx.db
            .query("graceMemoryNotes")
            .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
            .unique();
        return row
            ? {
                ownerKey: row.ownerKey,
                profile: row.profile,
                lastCorrection: row.lastCorrection,
                lastDestination: row.lastDestination,
                updatedAt: row.updatedAt,
            }
            : null;
    },
});

export const upsertNote = mutation({
    args: {
        ownerKey: v.string(),
        kind: v.union(v.literal("profile"), v.literal("correction"), v.literal("destination")),
        text: v.string(),
        href: v.optional(v.string()),
        title: v.optional(v.string()),
        sku: v.optional(v.string()),
    },
    returns: v.id("graceMemoryNotes"),
    handler: async (ctx, args) => {
        const ownerKey = assertOwnerKey(args.ownerKey);
        const now = Date.now();
        const existing = await ctx.db
            .query("graceMemoryNotes")
            .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
            .unique();

        const patch: {
            profile?: string;
            lastCorrection?: { text: string; at: number };
            lastDestination?: { href: string; title: string; sku?: string; at: number };
            updatedAt: number;
        } = { updatedAt: now };

        if (args.kind === "profile") {
            patch.profile = clip(args.text, PROFILE_MAX);
        } else if (args.kind === "correction") {
            patch.lastCorrection = { text: clip(args.text, CORRECTION_MAX), at: now };
        } else {
            const href = clip(args.href ?? args.text, HREF_MAX);
            if (!href.startsWith("/")) {
                throw new Error("Destination must be a site-relative path");
            }
            patch.lastDestination = {
                href,
                title: clip(args.title ?? args.text, TITLE_MAX),
                ...(args.sku?.trim() ? { sku: clip(args.sku, SKU_MAX) } : {}),
                at: now,
            };
        }

        if (existing) {
            await ctx.db.patch(existing._id, patch);
            return existing._id;
        }
        return await ctx.db.insert("graceMemoryNotes", {
            ownerKey,
            ...patch,
        });
    },
});
