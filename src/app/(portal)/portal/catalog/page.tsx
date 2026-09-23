export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/portal/ui";
import CatalogLineItems from "@/components/portal/CatalogLineItems";
import { searchCatalogServer } from "@/lib/catalogServer";
import { buildCatalogLineItems } from "@/lib/products/catalog-line-items";
import { addToOrderAction } from "../actions";

// One Convex execution reads whole product documents per group, so a larger
// page hits the 16 MB read budget rather than simply being slower.
const PAGE_SIZE = 48;

export default async function PortalCatalog({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const rawQuery = params.q;
    const search = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim() ?? "";

    // The same server search the storefront runs, so the portal cannot show a
    // different catalogue — or a different price — from the shop.
    const result = await searchCatalogServer({
        filters: { search },
        sort: search ? "featured" : "featured",
        view: "line",
        limit: PAGE_SIZE,
        cursor: null,
    });

    const items = buildCatalogLineItems(result);

    return (
        <div className="mx-auto max-w-[1400px] px-4 py-4 lg:px-6 lg:py-6">
            <PageHeader
                eyebrow="Catalogue"
                title="Products"
                subtitle="Search the full catalogue and add what you need straight to your order. Prices shown are your account's tier pricing."
            />

            <CatalogLineItems
                items={items}
                totalCount={result.totalCount}
                initialSearch={search}
                addToOrder={addToOrderAction}
            />
        </div>
    );
}
