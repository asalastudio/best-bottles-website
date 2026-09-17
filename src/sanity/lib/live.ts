import { defineLive } from "next-sanity/live";
import { createClient } from "@sanity/client";
import { isSanityConfigured } from "./client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

// Read-only token (Viewer role) used for live preview + draft mode. The browser
// token is only ever sent to the client while Draft Mode is enabled (i.e. inside
// the Presentation tool), never to public visitors.
const token = process.env.SANITY_API_READ_TOKEN;

// `createClient` throws immediately when no projectId is present, so guard the
// Live client the same way ./client.ts guards the read clients. Every
// `sanityFetch` call site already checks `isSanityConfigured` first, so when
// Sanity is not configured (e.g. local dev without editorial credentials) these
// no-ops are never actually invoked — they only keep imports resolvable and stop
// the storefront from crashing at module load.
function defineLiveClients() {
    const liveClient = createClient({
        projectId: projectId!,
        dataset,
        apiVersion: "2024-11-01",
        useCdn: false,
        stega: { studioUrl: "/studio" },
    });

    return defineLive({
        client: liveClient,
        serverToken: token,
        browserToken: token,
    });
}

type LiveExports = ReturnType<typeof defineLive>;

const live: LiveExports = isSanityConfigured
    ? defineLiveClients()
    : {
          sanityFetch: (async () => ({ data: null })) as unknown as LiveExports["sanityFetch"],
          SanityLive: (() => null) as unknown as LiveExports["SanityLive"],
      };

export const { sanityFetch, SanityLive } = live;
