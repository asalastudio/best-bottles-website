import { defineLive } from "next-sanity/live";
import { createClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

// Read-only token (Viewer role) used for live preview + draft mode. The browser
// token is only ever sent to the client while Draft Mode is enabled (i.e. inside
// the Presentation tool), never to public visitors.
const token = process.env.SANITY_API_READ_TOKEN;

// Dedicated client for the Live Content API. Uses a recent apiVersion and no CDN
// so draft/live updates are read directly from the API.
const liveClient = createClient({
    projectId: projectId!,
    dataset,
    apiVersion: "2024-11-01",
    useCdn: false,
    stega: { studioUrl: "/studio" },
});

export const { sanityFetch, SanityLive } = defineLive({
    client: liveClient,
    serverToken: token,
    browserToken: token,
});
