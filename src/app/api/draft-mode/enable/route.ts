import { createClient } from "@sanity/client";
import { validatePreviewUrl } from "@sanity/preview-url-secret";
import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2025-02-19",
    useCdn: false,
    token: process.env.SANITY_API_TOKEN,
});

export async function GET(request: Request) {
    const { isValid, redirectTo = "/" } = await validatePreviewUrl(
        client,
        request.url,
    );

    if (!isValid) {
        return new Response("Invalid secret", { status: 401 });
    }

    (await draftMode()).enable();
    redirect(redirectTo);
}
