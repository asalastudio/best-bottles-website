import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { getHomepageData } from "@/sanity/lib/queries";
import HomePage from "@/components/HomePage";
import { getHomepageBrowse } from "@/lib/homepageBrowse.server";
import { buildHreflangAlternates } from "@/i18n/metadata";

export const revalidate = 60;

const getCachedHomepageContent = unstable_cache(
    () => getHomepageData(),
    ["homepage-sanity-v1"],
    { revalidate: 60 },
);

// Self-referential canonical for the homepage. Kept here (not on the root
// layout) so interior pages inherit no canonical — each public page sets its
// own, and internal/noindex pages emit none instead of the homepage URL.
// English alternates only: the locale header would make this route dynamic.
export function generateMetadata(): Metadata {
    return {
        alternates: buildHreflangAlternates("/"),
    };
}

export default async function Page() {
    const browsePromise = getHomepageBrowse().catch(() => null);
    const homepageData = await getCachedHomepageContent().catch(() => null);

    return (
        <HomePage homepageData={homepageData} browseData={await browsePromise} />
    );
}
