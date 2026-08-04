import "server-only";

import { createClient, type SanityClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const token = process.env.SANITY_API_READ_TOKEN;

/**
 * Private, read-only client for explicitly authorized draft previews.
 * The token never crosses the React Server Component boundary.
 */
export const previewServerClient: SanityClient | null = projectId && token
    ? createClient({
          projectId,
          dataset,
          apiVersion: "2024-11-01",
          useCdn: false,
          token,
          perspective: "previewDrafts",
      })
    : null;
