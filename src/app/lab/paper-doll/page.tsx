import Link from "next/link";
import PaperDollSwapper from "./PaperDollSwapper";
import { ConvexHttpClient } from "convex/browser";
import { loadPlateFamilies, loadPlateFamily } from "@/lib/paper-doll/plates";

export const metadata = { title: "Paper Doll swapper — Best Bottles lab" };

/**
 * Photographic paper-doll swapper, deliberately separate from the real PDP.
 *
 * Every family here is a published plate family in the Convex index
 * (productPlates / plateFamilies), with its bytes on object storage. Diva
 * 46 ml Clear was the pilot: the one bottle whose PSD master set covers
 * every closure archetype we sell. The 9 mL Cylinder is composited from its
 * 26 layer PNGs into the same shape, so the swapper needs no special case.
 */
export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ family?: string | string[] }>;
}) {
    const { family: requested } = await searchParams;
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) return <main className="p-10 text-sm text-slate">NEXT_PUBLIC_CONVEX_URL is not set.</main>;
    const convex = new ConvexHttpClient(url);
    const families = await loadPlateFamilies(convex);
    const id = (Array.isArray(requested) ? requested[0] : requested) ?? families[0]?.id ?? "";
    const manifest = (id ? await loadPlateFamily(convex, id) : null) ?? (families[0] ? await loadPlateFamily(convex, families[0].id) : null);
    if (!manifest) return <main className="p-10 text-sm text-slate">No plate families are published in the index yet. Publish one with scripts/paperdoll/publish.mjs.</main>;
    return (
        <>
            <nav aria-label="Plate families" className="mx-auto flex max-w-[1440px] flex-wrap gap-2 px-4 pt-6 sm:px-6">
                {families.map((f) => (
                    <Link
                        key={f.id}
                        href={`/lab/paper-doll?family=${f.id}`}
                        aria-current={f.id === manifest.id ? "page" : undefined}
                        className={`min-h-9 border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${f.id === manifest.id ? "border-obsidian bg-obsidian text-white" : "border-champagne text-slate hover:border-obsidian hover:text-obsidian"}`}
                    >
                        {f.name} · {f.variantCount}
                    </Link>
                ))}
            </nav>
            <PaperDollSwapper family={manifest} />
        </>
    );
}
