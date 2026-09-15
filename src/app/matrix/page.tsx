import Link from "next/link";
import { getShopCollection, shopCollectionHref } from "@/lib/shopCollections";
import { builderCollectionBodies, BUILDER_COLLECTION_FITMENTS } from "@/lib/bottle-builder/collection-context";
import type { Metadata } from "next";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BuilderLoading from "@/components/bottle-builder/BuilderLoading";
import { loadBuilderEntry } from "@/lib/bottle-builder/entry";
import MatrixClient from "@/components/matrix/MatrixClient";
import { loadBuilderFamilies, loadBuilderFamily } from "@/lib/bottle-builder/server";
import { SITE_URL, buildBreadcrumbJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
    title: { absolute: "Build Your Bottle | Best Bottles" },
    description: "Start with a bottle, choose your glass color, and add a compatible fitment. Preview your bottle as you build and order your exact combination.",
    alternates: { canonical: `${SITE_URL}/matrix` },
};

export default async function MatrixPage({ searchParams }: { searchParams: Promise<{ family?: string; shop?: string }> }) {
    const { family: familyParam, shop } = await searchParams;
    const collection = shop && BUILDER_COLLECTION_FITMENTS[shop] ? getShopCollection(shop) : undefined;
    const breadcrumb = buildBreadcrumbJsonLd([
        { name: "Home", url: SITE_URL },
        { name: "Build Your Bottle", url: `${SITE_URL}/matrix` },
    ]);
    return <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
        <Navbar hideMobileSearch builderMobile />
        <main className="min-h-screen bg-bone pt-[104px] sm:pt-[120px]" data-builder-page>
            {collection && <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-4 text-sm"><span>Building from {collection.title}</span><Link className="underline" href={shopCollectionHref(collection.key)}>Back to collection</Link><Link className="underline" href="/matrix">Explore all fitments</Link></div>}
            <Suspense fallback={<BuilderLoading />}><Builder familyParam={familyParam} collection={collection?.key} /></Suspense>
        </main>
        <Footer />
    </>;
}

async function Builder({ familyParam, collection }: { familyParam?: string; collection?: string }) {
    const entry = await loadBuilderEntry(familyParam, { family: loadBuilderFamily, families: loadBuilderFamilies });
    return <MatrixClient key={`${entry.openFamily}:${collection ?? "all"}`} {...entry} bodies={builderCollectionBodies(entry.bodies, collection)} />;
}
