import "server-only";

import { createClient, type SanityClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const readToken = process.env.SANITY_API_READ_TOKEN;

function createServerClient(perspective: "published" | "previewDrafts"): SanityClient | null {
    if (!projectId || !readToken) return null;
    return createClient({
        projectId,
        dataset,
        apiVersion: "2024-11-01",
        useCdn: false,
        token: readToken,
        perspective,
    });
}

/** Private published-content reader used by release-gated storefront features. */
export const authenticatedServerClient = createServerClient("published");

/** Private draft reader used only after the server authorizes an explicit preview. */
export const previewServerClient = createServerClient("previewDrafts");
