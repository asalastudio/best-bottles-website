import type { Metadata } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MatrixClient from "@/components/matrix/MatrixClient";
import BottleBaseClient from "@/components/matrix/BottleBaseClient";
import { SITE_URL, buildBreadcrumbJsonLd } from "@/lib/seo";

/** The sentinel for "no family chosen" — also the default. */
const ALL = "__all__";

/** Convex-backed, and the catalog moves — never statically cached. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
    // the root layout applies a "%s | Best Bottles" template, so absolute
    title: { absolute: "Order Matrix | Best Bottles" },
    description:
        "Configure bottles and compatible components quickly. Everyone pays the same "
        + "price; businesses with an approved resale certificate are not charged tax.",
    alternates: { canonical: `${SITE_URL}/matrix` },
};

/**
 * /matrix — the Order Matrix.
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
    searchParams: Promise<{ family?: string; view?: string }>;
}) {
    const { family: familyParam, view } = await searchParams;
    /* ?view=bottles renders the BottleBase configurator over the same rows —
       one row per bottle instead of one per SKU. Flagged so both models can
       be compared against the same data before either is committed to. */
    const bottleView = view === "bottles";
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    const families = await convex.query(api.matrix.listFamilies, {});

    /* ALL FAMILIES IS THE DEFAULT. Jordan: "We do want an option to search all
       families as well, since the colors would be a little unclear or they may
       overlook it... it starts by default on all families." Landing inside one
       family silently hides 2,000 products from a buyer who does not yet know
       which family their bottle belongs to — and family is our vocabulary,
       not theirs. */
    const openFamily = familyParam && families.some((f) => f.family === familyParam)
        ? familyParam
        : ALL;

    const loadFamily = (family: string) =>
        convex.query(api.matrix.getFamilyRows, { family });

    type Rows = Awaited<ReturnType<typeof loadFamily>>;
    type Row = Rows["rows"][number] & { componentCounts?: Record<string, number> };
    let initialRows: (Omit<Rows, "rows"> & { rows: Row[] }) | null = null;

    if (openFamily === ALL) {
        /* NO COMPONENT LISTS IN THIS MODE. Measured 2026-09-01: all 2,471 rows
           serialize to 24.59 MB with their components attached and 2.08 MB
           without — the component arrays are 92% of it, and only the one row
           whose picker is open needs them. They are fetched per row, on open,
           through matrix.getRowComponents.

           Fanned out per family rather than read in one query because 2,471
           products exceeds Convex's 16 MB read limit in a single function —
           the same wall getAllForAudit hit. 37 parallel queries land in
           ~550 ms. */
        const all = await Promise.all(families.map((f) => loadFamily(f.family)));
        const rows = all.flatMap((r) =>
            r.rows.map(({ components, ...rest }) => ({
                ...rest,
                components: {} as typeof components,
                componentCounts: Object.fromEntries(
                    Object.entries(components).map(([k, xs]) => [k, xs.length]),
                ) as Record<string, number>,
            })),
        );
        initialRows = {
            family: ALL,
            rowCount: rows.length,
            truncated: all.some((r) => r.truncated),
            rows,
        };
    } else {
        initialRows = await loadFamily(openFamily);
    }

    const breadcrumb = buildBreadcrumbJsonLd([
        { name: "Home", url: SITE_URL },
        { name: "Order Matrix", url: `${SITE_URL}/matrix` },
    ]);

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
            />
            <Navbar />
            <main className="min-h-screen bg-bone pt-[104px] sm:pt-[120px]">
                {bottleView ? (
                    <BottleBaseClient
                        families={families}
                        openFamily={openFamily === ALL ? null : openFamily}
                        rows={initialRows?.rows ?? []}
                    />
                ) : (
                    <MatrixClient
                        families={families}
                        openFamily={openFamily}
                        initialRows={initialRows}
                    />
                )}
            </main>
            <Footer />
        </>
    );
}
