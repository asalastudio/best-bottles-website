import "server-only";

import { auth } from "@clerk/nextjs/server";
import { api } from "../../../convex/_generated/api";
import { CLERK_ENABLED } from "@/lib/clerk";
import { getPortalConvex, getPortalConvexWriteToken } from "@/lib/portal/convexClient";
import { isSanityConfigured } from "@/sanity/lib/client";
import { editorialImageUrl } from "@/sanity/lib/image";
import { sanityFetch } from "@/sanity/lib/live";
import { getCatalogVisibilitySnapshot } from "@/lib/catalogServer";
import { buildWorkspaceFamilies } from "./workspaceFamilies";

/** Family imagery uses approved editorial art with exact catalog-photo fallbacks.
 * Session history stays server-side, resolved against the authenticated viewer. */

const SESSION_LIMIT = 4;

import type { RailFamily, RailSession } from "./workspaceRailTypes";

export type { RailFamily, RailSession };

export type WorkspaceRailData = {
    families: RailFamily[];
    sessions: RailSession[];
};

type DesignFamilyCard = { family?: string; image?: { asset?: { _ref: string } } };

async function getFamilyArtwork(): Promise<Map<string, string>> {
    if (!isSanityConfigured) return new Map();
    try {
        const { data } = await sanityFetch({
            query: `*[_type == "homepagePage"][0].designFamilyCards[]{ family, image }`,
        });
        const cards = (data as DesignFamilyCard[] | null) ?? [];
        const byFamily = new Map<string, string>();
        for (const card of cards) {
            if (!card?.family) continue;
            // Square crop at 2x the 64px the rail renders, so the thumbnails
            // stay crisp on retina without shipping a full hero image.
            const url = editorialImageUrl(card.image, 128, 128);
            if (url) byFamily.set(card.family, url);
        }
        return byFamily;
    } catch {
        return new Map();
    }
}

async function getRecentSessions(): Promise<RailSession[]> {
    if (!CLERK_ENABLED) return [];
    try {
        const { userId, orgId } = await auth();
        if (!userId) return [];

        const rows = await getPortalConvex().query(api.graceSessions.listForViewer, {
            writeToken: getPortalConvexWriteToken(),
            clerkUserId: userId,
            clerkOrgId: orgId ?? undefined,
        });
        return rows.slice(0, SESSION_LIMIT).map((row) => ({
            id: row._id,
            title: row.title,
            lastMessageAt: row.lastMessageAt,
        }));
    } catch {
        // History is a convenience in the rail; never let it take the page down.
        return [];
    }
}

async function getFamilies(): Promise<RailFamily[]> {
    try {
        const [snapshot, artwork] = await Promise.all([
            getCatalogVisibilitySnapshot(),
            getFamilyArtwork(),
        ]);
        return buildWorkspaceFamilies(snapshot, artwork);
    } catch {
        return [];
    }
}

export async function getWorkspaceRailData(): Promise<WorkspaceRailData> {
    const [families, sessions] = await Promise.all([getFamilies(), getRecentSessions()]);
    return { families, sessions };
}
