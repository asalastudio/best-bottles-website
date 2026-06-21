import { HOMEPAGE_QUERY, type HomepageData } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/live";
import { isSanityConfigured } from "@/sanity/lib/client";
import HomePage from "@/components/HomePage";
import SanityLiveVisualEditing from "@/components/SanityLiveVisualEditing";

export default async function Page() {
    // Live, draft-aware fetch: published content for visitors, draft content with
    // click-to-edit overlays inside the Studio's Presentation tool.
    let homepageData: HomepageData | null = null;
    if (isSanityConfigured) {
        try {
            const { data } = await sanityFetch({ query: HOMEPAGE_QUERY });
            homepageData = (data as HomepageData) ?? null;
        } catch {
            homepageData = null;
        }
    }

    return (
        <>
            <HomePage homepageData={homepageData} />
            <SanityLiveVisualEditing />
        </>
    );
}
