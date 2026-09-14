import "server-only";

import { auth } from "@clerk/nextjs/server";
import { api } from "../../../convex/_generated/api";
import { CLERK_ENABLED } from "@/lib/clerk";
import { getPortalConvex } from "@/lib/portal/convexClient";
import { isSanityConfigured } from "@/sanity/lib/client";
import { editorialImageUrl } from "@/sanity/lib/image";
import { sanityFetch } from "@/sanity/lib/live";

/**
 * Everything the workspace rail needs, resolved on the server.
 *
 * Two reasons this is not a client query:
 *
 *  1. Family thumbnails come from the DESIGNED family cards in Sanity — the
 *     approved bone-ground artwork the homepage and catalog already use. The
 *     rail used to read `productGroups.heroImageUrl`, which points at Shopify
 *     files that have since 404'd, so every tile rendered broken.
 *  2. Session history is a transcript. Resolving the Clerk identity here means
 *     a browser cannot ask for another account's conversations by passing a
 *     different id.
 */

const FAMILY_LIMIT = 10;
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
        const [families, artwork] = await Promise.all([
            getPortalConvex().query(api.products.getPopularFamilies, { limit: FAMILY_LIMIT }),
            getFamilyArtwork(),
        ]);
        return families.map((f) => ({
            family: f.family,
            variantCount: f.variantCount,
            imageUrl: artwork.get(f.family) ?? null,
        }));
    } catch {
        return [];
    }
}

export async function getWorkspaceRailData(): Promise<WorkspaceRailData> {
    const [families, sessions] = await Promise.all([getFamilies(), getRecentSessions()]);
    return { families, sessions };
}
