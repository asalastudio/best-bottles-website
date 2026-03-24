import { createClient, type SanityClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

export const isSanityConfigured = Boolean(projectId && projectId.length > 0);

export const client: SanityClient = isSanityConfigured
    ? createClient({
          projectId: projectId!,
          dataset,
          apiVersion: "2025-02-19",
          useCdn: true,
      })
    : (null as unknown as SanityClient);
