import type { Metadata } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MatrixClient from "@/components/matrix/MatrixClient";
import { SITE_URL, buildBreadcrumbJsonLd } from "@/lib/seo";

/** Convex-backed, and the catalog moves — never statically cached. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
    // the root layout applies a "%s | Best Bottles" template, so absolute
    title: { absolute: "Build a Bottle — Product Compatibility Matrix | Best Bottles" },
    description:
        "Product Compatibility Matrix for comparing bottles and compatible components. Everyone pays the same "
        + "price; businesses with an approved resale certificate are not charged tax.",
    alternates: { canonical: `${SITE_URL}/matrix` },
};

/**
 * /matrix — Build a Bottle, the Product Compatibility Matrix.
 *
 * NOT "Wholesale". Jordan: "it's not really called wholesale Matrix because
 * they sell for the same price... it's just that for business owners, they
 * will remove the tax." Calling it wholesale promises a trade price that does
 * not exist, on the most commercially loaded page on the site. Everyone pays
 * the same; the only difference an account makes is whether tax is charged.
 *
 * PUBLIC ON PURPOSE, and that follows from the same fact. Since the price is
 * identical for everybody, nothing about browsing, configuring or pricing
 * needs an account — so the highest-value page does not sit behind a login.
 * The tax status is the one account-specific thing, and it surfaces in the
 * order bar.
 *
 * Data is loaded here and handed down as plain props, which is this app's
 * pattern: no client-side useQuery for a page payload.
 */
export default async function MatrixPage({
    searchParams,
}: {
    searchParams: Promise<{ family?: string }>;
}) {
    const { family: familyParam } = await searchParams;
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    const families = await convex.query(api.matrix.listFamilies, {});
    // `listFamilies` returns only customer families with products, so the
    // requested family is verified and the default cannot open an empty drawer.
    const openFamily = familyParam && families.some((f) => f.family === familyParam)
        ? familyParam
        : families[0]?.family ?? null;

    const initialRows = openFamily
        ? await convex.query(api.matrix.getFamilyRows, { family: openFamily })
        : null;

    const breadcrumb = buildBreadcrumbJsonLd([
        { name: "Home", url: SITE_URL },
        { name: "Build a Bottle", url: `${SITE_URL}/matrix` },
    ]);

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
            />
            <Navbar />
            <main className="min-h-screen bg-bone pt-[104px] sm:pt-[120px]">
                <MatrixClient
                    key={openFamily ?? "no-family"}
                    families={families}
                    openFamily={openFamily}
                    initialRows={initialRows}
                />
            </main>
            <Footer />
        </>
    );
}
