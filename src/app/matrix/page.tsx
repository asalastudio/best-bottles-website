import type { Metadata } from "next";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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

export default async function MatrixPage({ searchParams }: { searchParams: Promise<{ family?: string }> }) {
    const { family: familyParam } = await searchParams;
    const breadcrumb = buildBreadcrumbJsonLd([
        { name: "Home", url: SITE_URL },
        { name: "Build Your Bottle", url: `${SITE_URL}/matrix` },
    ]);
    return <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
        <Navbar />
        <main className="min-h-screen bg-bone pt-[104px] sm:pt-[120px]" data-builder-page>
            <Suspense fallback={<BuilderLoading />}><Builder familyParam={familyParam} /></Suspense>
        </main>
        <Footer />
    </>;
}

async function Builder({ familyParam }: { familyParam?: string }) {
    const families = await loadBuilderFamilies();
    const openFamily = familyParam && families.some((f) => f.family === familyParam) ? familyParam
        : families.find(f => f.family === "Cylinder")?.family ?? families[0]?.family ?? "Cylinder";
    const bodies = await loadBuilderFamily(openFamily);
    return <MatrixClient key={openFamily} families={families} openFamily={openFamily} bodies={bodies} />;
}

function BuilderLoading() {
    return <div className="mx-auto max-w-[1680px] px-6 py-10" role="status">
        <h1 className="font-serif text-4xl">Build Your Bottle</h1>
        <p className="mt-3 text-sm text-slate">Preparing your bottles and compatible finishes…</p>
        <div className="mt-8 grid min-h-[570px] gap-4 lg:grid-cols-[1fr_1.16fr_.79fr]" aria-hidden="true">
            <div className="rounded-md border border-champagne/40 bg-white" />
            <div className="rounded-md bg-[#eeebe5]" /><div className="rounded-md border border-champagne/40 bg-white" />
        </div>
    </div>;
}
