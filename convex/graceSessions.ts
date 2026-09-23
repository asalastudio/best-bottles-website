/**
 * Grace sessions — transcripts recorded for signed-in customers.
 *
 * Anonymous visitors are never written here; the storefront only posts a
 * session once Clerk knows who the person is. Rows are written by the
 * Next.js server (holding the write token) after it resolves the Clerk
 * identity itself, so a browser can neither forge another customer's
 * identity nor file a session under another organization.
 *
 * One row per client session id, replaced on every sync — the client is the
 * source of truth for the transcript while the session is live.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { verifyWriteToken } from "./portalAuth";

const MESSAGE_CAP = 200;
const TEXT_MAX = 4000;
const TITLE_MAX = 120;
const PREVIEW_MAX = 160;
const SESSION_ID_MAX = 80;
const SESSIONS_PER_ORG = 50;

const roleValidator = v.union(v.literal("user"), v.literal("grace"));
const messageValidator = v.object({ role: roleValidator, text: v.string() });

function clip(value: string, max: number): string {
    const trimmed = value.trim();
    return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function deriveTitle(messages: Array<{ role: "user" | "grace"; text: string }>): string {
    const firstUser = messages.find((m) => m.role === "user");
    return firstUser ? clip(firstUser.text, TITLE_MAX) : "Grace session";
}

function derivePreview(messages: Array<{ role: "user" | "grace"; text: string }>): string | null {
    const lastGrace = [...messages].reverse().find((m) => m.role === "grace");
    return lastGrace ? clip(lastGrace.text, PREVIEW_MAX) : null;
}

export const upsert = mutation({
    args: {
        writeToken: v.string(),
        clerkUserId: v.string(),
        clerkOrgId: v.optional(v.string()),
        ownerKey: v.string(),
        sessionId: v.string(),
        surface: v.string(),
        companionMode: v.string(),
        startedAt: v.number(),
        lastPageUrl: v.optional(v.string()),
        messages: v.array(messageValidator),
        ended: v.optional(v.boolean()),
    },
    returns: v.id("graceSessions"),
    handler: async (ctx, args) => {
        verifyWriteToken(args.writeToken);

        const sessionId = clip(args.sessionId, SESSION_ID_MAX);
        if (!sessionId) throw new Error("session_id_required");
        if (!args.clerkUserId.trim()) throw new Error("clerk_user_id_required");

        const messages = args.messages
            .slice(-MESSAGE_CAP)
            .map((m) => ({ role: m.role, text: clip(m.text, TEXT_MAX) }))
            .filter((m) => m.text.length > 0);
        if (!messages.some((m) => m.role === "user")) {
            throw new Error("session_has_no_user_message");
        }

        const now = Date.now();
        const existing = await ctx.db
            .query("graceSessions")
            .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
            .first();

        if (existing) {
            // A session id is minted client-side; refuse to let one customer
            // overwrite a transcript another customer already owns.
            if (existing.clerkUserId !== args.clerkUserId) {
                throw new Error("session_owned_by_other_user");
            }
            await ctx.db.patch(existing._id, {
                clerkOrgId: args.clerkOrgId ?? existing.clerkOrgId,
                messages,
                messageCount: messages.length,
                title: deriveTitle(messages),
                lastMessageAt: now,
                lastPageUrl: args.lastPageUrl ? clip(args.lastPageUrl, 400) : existing.lastPageUrl,
                companionMode: clip(args.companionMode, 32),
                endedAt: args.ended ? now : existing.endedAt,
            });
            return existing._id;
        }

        return await ctx.db.insert("graceSessions", {
            clerkUserId: args.clerkUserId,
            clerkOrgId: args.clerkOrgId,
            ownerKey: clip(args.ownerKey, 128),
            sessionId,
            surface: clip(args.surface, 32),
            companionMode: clip(args.companionMode, 32),
            title: deriveTitle(messages),
            startedAt: args.startedAt,
            lastMessageAt: now,
            endedAt: args.ended ? now : undefined,
            lastPageUrl: args.lastPageUrl ? clip(args.lastPageUrl, 400) : undefined,
            messageCount: messages.length,
            messages,
        });
    },
});

function summarize(row: Doc<"graceSessions">) {
    return {
        _id: row._id,
        sessionId: row.sessionId,
        title: row.title,
        surface: row.surface,
        companionMode: row.companionMode,
        startedAt: row.startedAt,
        lastMessageAt: row.lastMessageAt,
        endedAt: row.endedAt ?? null,
        messageCount: row.messageCount,
        clerkUserId: row.clerkUserId,
        preview: derivePreview(row.messages),
    };
}

/**
 * What the portal shows one viewer: the organization's sessions, plus any of
 * this person's own sessions recorded before an organization was active.
 *
 * Without the second half those early conversations are orphaned — recorded,
 * owned by nobody the portal queries, and invisible forever.
 */
export const listForViewer = query({
    args: { clerkOrgId: v.optional(v.string()), clerkUserId: v.string() },
    handler: async (ctx, args) => {
        const byOrg = args.clerkOrgId
            ? await ctx.db
                .query("graceSessions")
                .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
                .order("desc")
                .take(SESSIONS_PER_ORG)
            : [];

        const byUser = await ctx.db
            .query("graceSessions")
            .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
            .order("desc")
            .take(SESSIONS_PER_ORG);

        const merged = new Map<string, Doc<"graceSessions">>();
        for (const row of [...byOrg, ...byUser]) merged.set(row._id, row);

        return [...merged.values()]
            .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
            .slice(0, SESSIONS_PER_ORG)
            .map(summarize);
    },
});

/** Newest first. Summaries only — the transcript comes from `getForViewer`. */
export const listByOrg = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        const rows = await ctx.db
            .query("graceSessions")
            .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .order("desc")
            .take(SESSIONS_PER_ORG);

        return rows.map((row) => ({
            _id: row._id,
            sessionId: row.sessionId,
            title: row.title,
            surface: row.surface,
            companionMode: row.companionMode,
            startedAt: row.startedAt,
            lastMessageAt: row.lastMessageAt,
            endedAt: row.endedAt ?? null,
            messageCount: row.messageCount,
            clerkUserId: row.clerkUserId,
            preview: derivePreview(row.messages),
        }));
    },
});

/**
 * Full transcript, or null when the viewer may not read it.
 *
 * A viewer may read a session their organization owns, or one they recorded
 * themselves before an organization was active. Anything else is not found —
 * the same answer a missing row gives, so this cannot be used to probe which
 * session ids exist.
 */
export const getForViewer = query({
    args: {
        clerkOrgId: v.string(),
        clerkUserId: v.string(),
        sessionId: v.id("graceSessions"),
    },
    handler: async (ctx, args) => {
        const row = await ctx.db.get(args.sessionId);
        if (!row) return null;
        const ownedByOrg = row.clerkOrgId === args.clerkOrgId;
        const ownedByViewer = row.clerkUserId === args.clerkUserId && !row.clerkOrgId;
        if (!ownedByOrg && !ownedByViewer) return null;
        return row;
    },
});
