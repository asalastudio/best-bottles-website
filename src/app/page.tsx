import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { HOMEPAGE_QUERY, type HomepageData } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/live";
import { isSanityConfigured } from "@/sanity/lib/client";
import HomePage from "@/components/HomePage";
import { getHomepageBrowse } from "@/lib/homepageBrowse.server";
import SanityLiveVisualEditing from "@/components/SanityLiveVisualEditing";
import { defaultLocale, isLocale, type AppLocale } from "@/i18n/config";
import { buildHreflangAlternates } from "@/i18n/metadata";

// Self-referential canonical for the homepage. Kept here (not on the root
// layout) so interior pages inherit no canonical — each public page sets its
// own, and internal/noindex pages emit none instead of the homepage URL.
export async function generateMetadata(): Promise<Metadata> {
    const localeValue = await getLocale();
    const locale: AppLocale = isLocale(localeValue) ? localeValue : defaultLocale;
    const path = locale === "es" ? "/es" : "/";
    return {
        alternates: buildHreflangAlternates(path),
    };
}

export default async function Page() {
    // Live, draft-aware fetch: published content for visitors, draft content with
    // click-to-edit overlays inside the Studio's Presentation tool.
    const browsePromise = getHomepageBrowse().catch(() => null);
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
            <HomePage homepageData={homepageData} browseData={await browsePromise} />
            <SanityLiveVisualEditing />
        </>
    );
}
