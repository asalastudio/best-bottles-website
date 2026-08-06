import "server-only";

import { createClient, type SanityClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const readToken = process.env.SANITY_API_READ_TOKEN;

/**
 * Server-only client for storefront content that is protected by Sanity access
 * controls. The token is never imported into a client component or browser
 * bundle.
 */
export const authenticatedServerClient: SanityClient | null = projectId && readToken
    ? createClient({
          projectId,
          dataset,
          apiVersion: "2024-01-01",
          useCdn: false,
          token: readToken,
          perspective: "published",
      })
    : null;

/**
 * Server-only client for signed/local editorial preview. Draft content is never
 * exposed through the public client and the token remains on the server.
 */
export const previewServerClient: SanityClient | null = projectId && readToken
    ? createClient({
          projectId,
          dataset,
          apiVersion: "2024-01-01",
          useCdn: false,
          token: readToken,
          perspective: "previewDrafts",
      })
    : null;
