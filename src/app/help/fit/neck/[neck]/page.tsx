import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import HelpShell, { ContactStrip, JsonLd } from "@/components/help/HelpShell";
import NeckBuilder from "@/components/help/NeckBuilder";
import { neckBuilder, neckBuilderHref, neckBuilderNecks, type ApplicatorKey } from "@/lib/help/fit-neck";
import { FIT_SNAPSHOT } from "@/lib/help/fit";
import { buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { pageAlternates } from "@/i18n/metadata";

export const dynamicParams = false;

export function generateStaticParams() {
    return neckBuilderNecks().map((neck) => ({ neck }));
}

export async function generateMetadata({ params }: { params: Promise<{ neck: string }> }): Promise<Metadata> {
    const { neck } = await params;
    const view = neckBuilder(neck);
    if (!view) return {};
    return {
        title: { absolute: `Build a ${neck} Bottle: Bottle, Applicator, Closure | Best Bottles` },
        description: `Choose one of ${view.bottles.length} ${neck} bottles, then a roll-on, sprayer or pour, then the cap. Every ${neck} part fits every ${neck} bottle. Item codes included.`,
        alternates: pageAlternates(neckBuilderHref(neck), undefined, { json: `/api/kb/v1/fit/neck/${encodeURIComponent(neck)}` }),
    };
}

type Search = { bottle?: string; applicator?: string; sprayer?: string; closure?: string };

export default async function NeckBuilderPage({ params, searchParams }: { params: Promise<{ neck: string }>; searchParams: Promise<Search> }) {
    const { neck } = await params;
    const view = neckBuilder(neck);
    if (!view) notFound();
    const query = await searchParams;
    // Links carry item codes, the codes customers know; the builder works in register ids.
    const byCode = (code?: string) => (code ? Object.values(view.parts).find((part) => part.itemCode === code)?.id ?? null : null);
    const initial = {
        bottle: query.bottle ? (view.bottles.find((b) => b.id === query.bottle || b.id === `${query.bottle}-${neck}`)?.id ?? null) : null,
        applicator: (query.applicator as ApplicatorKey | undefined) ?? null,
        sprayer: byCode(query.sprayer),
        closure: byCode(query.closure),
    };
    return (
        <HelpShell wide crumbs={[{ name: "Help", href: "/help" }, { name: "Fit finder", href: "/help/fit" }, { name: neck }]}>
            <JsonLd data={buildBreadcrumbJsonLd([
                { name: "Help", url: `${SITE_URL}/help` },
                { name: "Fit finder", url: `${SITE_URL}/help/fit` },
                { name: neck, url: `${SITE_URL}${neckBuilderHref(neck)}` },
            ])} />
            <header className="grid gap-4 border-b border-[#1c1c1e] pb-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div>
                    <h1 className="page-heading font-semibold uppercase leading-none tracking-[0.1em] text-[#1c1c1e] text-[22px] lg:text-[28px]">
                        Build a {neck} bottle
                    </h1>
                    <p className="mt-3 max-w-xl text-[13px] text-slate">
                        {view.ruling ? `Every part on this page fits every bottle on this page. ` : ""}Choose a bottle, then an applicator, then the closure.
                    </p>
                </div>
                <div className="flex max-w-sm items-center gap-3 border border-[#d9cdb9] bg-warm-white px-4 py-3">
                    <span className="whitespace-nowrap text-xl font-semibold tracking-[0.04em] text-[#1c1c1e]">{neck.split("-")[0]}<span className="text-gold-dim">-</span>{neck.split("-")[1]}</span>
                    <p className="text-xs text-slate"><b className="text-obsidian">{neck.split("-")[0]}</b> is the neck&apos;s outside diameter in mm. <b className="text-obsidian">{neck.split("-")[1]}</b> is the thread style. Parts fit when both numbers match.</p>
                </div>
            </header>
            <div className="mt-6">
                <NeckBuilder view={view} initial={initial} />
            </div>
            <p className="mt-6 text-xs text-slate">
                Fits from our catalog records of {FIT_SNAPSHOT.date}{view.ruling ? ` and our team's ${neck} ruling of ${view.ruling.date}` : ""}. Images are our approved master bottles and closures.{" "}
                <Link href="/help/fit" className="underline underline-offset-4">Find fits by bottle</Link>
            </p>
            <p className="mt-2 text-xs text-slate">For agents: the same build as JSON at <code className="font-mono">/api/kb/v1/fit/neck/{neck}</code>.</p>
            <ContactStrip />
        </HelpShell>
    );
}
