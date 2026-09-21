import type { Metadata } from "next";
import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import TeamProductSheet from "@/components/team/TeamProductSheet";
import { searchCatalogServer } from "@/lib/catalogServer";
import { buildCatalogLineItems } from "@/lib/products/catalog-line-items";
import { pricePushEnabled } from "@/lib/team/shopifyPricePush";
import { getUserEmailAddresses, hasTeamHubAccess } from "@/lib/teamAccess";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Products | Team Hub" }, robots: { index: false, follow: false } };

const PAGE_SIZE = 60;

function isLocalPreview(searchParams: Record<string, string | string[] | undefined> | undefined) {
    if (process.env.NODE_ENV === "production") return false;
    const preview = searchParams?.preview;
    return (Array.isArray(preview) ? preview : [preview]).some(value => value === "1" || value === "true");
}

/**
 * The catalogue's line-item sheet, for staff, with Edit where the portal has Add to order.
 * The rows come from the same search and the same row builder as the storefront's Line Items view
 * and the customer portal (src/lib/products/catalog-line-items.ts), so a product cannot carry one
 * name here and another there. Neither of those pages is touched by this one.
 */
export default async function TeamProductsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const params = searchParams ? await searchParams : undefined;
    const previewMode = isLocalPreview(params);
    if (!previewMode) {
        const { userId, redirectToSignIn } = await auth();
        if (!userId) return redirectToSignIn({ returnBackUrl: "/team/products" });
        const user = await currentUser();
        if (!hasTeamHubAccess(user?.publicMetadata, { emailAddresses: getUserEmailAddresses(user) })) {
            return (
                <main className="min-h-screen bg-bone px-6 py-20">
                    <div className="mx-auto max-w-xl border border-champagne/60 bg-linen p-8">
                        <h1 className="font-serif text-4xl text-obsidian">Team Hub access pending</h1>
                        <p className="mt-4 text-slate">Editing products is limited to Best Bottles staff.</p>
                    </div>
                </main>
            );
        }
    }

    const rawQuery = params?.q;
    const search = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim() ?? "";
    const result = await searchCatalogServer({ filters: { search }, sort: "featured", view: "line", limit: PAGE_SIZE, cursor: null });
    const items = buildCatalogLineItems(result);

    return (
        <main data-team-hub className="min-h-screen bg-bone px-5 py-8 sm:px-8 sm:py-10">
            <div className="mx-auto max-w-[1400px]">
                <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                    <div className="max-w-2xl">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-gold"><Link href="/team" className="hover:underline">Team Hub</Link></p>
                        <h1 className="font-serif text-4xl leading-tight text-obsidian sm:text-5xl">Products</h1>
                        <p className="mt-3 text-sm leading-6 text-slate">
                            Find a product, open its SKUs, and change what customers see: descriptions, prices and stock, and a custom name where the generated one is wrong. Every change is recorded and can be reverted.
                        </p>
                    </div>
                    <Link href="/team/products/new" className="border border-obsidian px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-obsidian hover:bg-obsidian hover:text-bone">New product</Link>
                </header>
                <TeamProductSheet items={items} totalCount={result.totalCount ?? items.length} search={search} pricePush={pricePushEnabled()} previewMode={previewMode} />
            </div>
        </main>
    );
}
