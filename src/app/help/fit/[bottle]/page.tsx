import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import HelpShell, { ContactStrip, JsonLd } from "@/components/help/HelpShell";
import { FitGroups, FormulaNote } from "@/components/help/FitParts";
import { FIT_SNAPSHOT, FIT_STATUS_MEANING, allBodies, bodyLabel, fitHref, fitReport, formatMl } from "@/lib/help/fit";
import { catalogHref } from "@/lib/catalogFilters";
import { buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { pageAlternates } from "@/i18n/metadata";
import { neckBuilder, neckBuilderHref } from "@/lib/help/fit-neck";

export const dynamicParams = false;

/** Only bottles that take our shared glass-neck closures get a page; the rest are sold as sets. */
export function generateStaticParams() {
    return allBodies().filter((body) => body.interchangeable).map((body) => ({ bottle: body.id }));
}

function loadReport(id: string) {
    const report = fitReport(decodeURIComponent(id));
    return report?.body.interchangeable ? report : null;
}

export async function generateMetadata({ params }: { params: Promise<{ bottle: string }> }): Promise<Metadata> {
    const { bottle } = await params;
    const report = loadReport(bottle);
    if (!report) return {};
    const label = bodyLabel(report.body);
    const listed = report.counts.listed;
    return {
        title: { absolute: `What Fits the ${label} (${report.body.neck} neck)? | Fit Finder | Best Bottles` },
        description: listed > 0
            ? `${listed} caps, sprayers and roll-ons our catalog lists for the ${label}, with item codes. Same-thread parts that aren't confirmed are shown separately.`
            : `Our catalog lists no closure for the ${label} yet. Same-thread parts that aren't confirmed are shown separately.`,
        alternates: pageAlternates(fitHref(report.body), undefined, { json: `/api/kb/v1/fit/${encodeURIComponent(report.body.id)}` }),
    };
}

function formatDate(iso: string): string {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function FitBottlePage({ params }: { params: Promise<{ bottle: string }> }) {
    const { bottle } = await params;
    const report = loadReport(bottle);
    if (!report) notFound();
    const { body, counts } = report;
    const label = bodyLabel(body);
    const facts = [
        body.neck && `${body.neck} neck`,
        body.glass.length > 0 && `${body.glass.join(", ")} glass`,
        body.heightMm != null && `${body.heightMm} mm tall without closure`,
        body.diameterMm != null && `${body.diameterMm} mm wide`,
    ].filter(Boolean);

    return (
        <HelpShell wide crumbs={[{ name: "Help", href: "/help" }, { name: "Fit finder", href: "/help/fit" }, { name: label }]}>
            <JsonLd data={buildBreadcrumbJsonLd([
                { name: "Help", url: `${SITE_URL}/help` },
                { name: "Fit finder", url: `${SITE_URL}/help/fit` },
                { name: label, url: `${SITE_URL}${fitHref(body)}` },
            ])} />
            <h1 className="font-serif text-4xl sm:text-5xl">What fits the {label}?</h1>
            <p className="mt-3 text-slate">{facts.join(" · ")}</p>
            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <Link href={catalogHref({ families: [body.family], capacities: body.capacityMl != null ? [formatMl(body.capacityMl)] : [] })} className="text-gold-dim underline underline-offset-4">
                    This bottle&apos;s price and stock
                </Link>
                {body.neck && neckBuilder(body.neck)?.bottles.some((b) => b.id === body.id) && (
                    <Link href={`${neckBuilderHref(body.neck)}?bottle=${encodeURIComponent(body.id)}`} className="font-semibold text-gold-dim underline underline-offset-4">Build it: applicator, then closure</Link>
                )}
                <Link href="/help/fit" className="underline underline-offset-4">Choose another bottle</Link>
            </p>

            <section aria-labelledby="listed" className="mt-12">
                <h2 id="listed" className="font-serif text-2xl">Listed fits <span className="text-base text-slate">· {counts.listed}</span></h2>
                <p className="mt-1 max-w-2xl text-sm text-slate">{FIT_STATUS_MEANING.listed}</p>
                {counts.listed > 0
                    ? <FitGroups groups={report.listed} status="listed" />
                    : <p className="mt-4 text-sm">Our catalog lists no closure for this bottle yet. Ask our team before ordering one.</p>}
            </section>

            {counts["not-confirmed"] > 0 && (
                <section aria-labelledby="not-confirmed" className="mt-12">
                    <h2 id="not-confirmed" className="font-serif text-2xl">Same thread, not confirmed <span className="text-base text-slate">· {counts["not-confirmed"]}</span></h2>
                    <p className="mt-1 max-w-2xl text-sm text-slate">{FIT_STATUS_MEANING["not-confirmed"]}</p>
                    <FitGroups groups={report.notConfirmed} status="not-confirmed" />
                    <Link href={`/help/ask?q=${encodeURIComponent(`Will this item fit the ${label} (${body.neck} neck)? Item code: `)}`} className="mt-4 inline-block text-sm underline underline-offset-4">Ask our team to check one</Link>
                </section>
            )}

            {counts.conflicting > 0 && (
                <section aria-labelledby="conflicting" className="mt-12">
                    <h2 id="conflicting" className="font-serif text-2xl">Conflicting records <span className="text-base text-slate">· {counts.conflicting}</span></h2>
                    <p className="mt-1 max-w-2xl text-sm text-slate">{FIT_STATUS_MEANING.conflicting}</p>
                    <FitGroups groups={report.conflicting} status="conflicting" />
                </section>
            )}

            <FormulaNote className="mt-12" graceQuestion={`Which closures are listed for the ${label} with a ${body.neck} neck?`} />

            <p className="mt-6 text-xs text-slate">From our catalog records of {formatDate(FIT_SNAPSHOT.date)}. Prices and stock change; the catalog links show them live.</p>

            <ContactStrip />
        </HelpShell>
    );
}
