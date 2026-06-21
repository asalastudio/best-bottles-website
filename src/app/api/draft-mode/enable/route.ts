import { defineEnableDraftMode } from "next-sanity/draft-mode";
import { createClient } from "@sanity/client";

// Validates the Sanity preview URL signature, then turns on Next.js Draft Mode
// so subsequent fetches return draft content with stega (click-to-edit) overlays.
const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-11-01",
    useCdn: false,
    token: process.env.SANITY_API_READ_TOKEN,
});

export const { GET } = defineEnableDraftMode({ client });
