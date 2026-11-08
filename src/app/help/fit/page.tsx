import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import HelpShell, { ContactStrip } from "@/components/help/HelpShell";
import { FormulaNote } from "@/components/help/FitParts";
import { bodiesByFamily, bodyById, bodyVariant, fitHref, formatMl, type FitBody } from "@/lib/help/fit";
import { pageAlternates } from "@/i18n/metadata";
import { neckBuilder, neckBuilderHref, neckBuilderNecks, neckMatrixDownloads } from "@/lib/help/fit-neck";

export const metadata: Metadata = {
    title: { absolute: "Fit Finder: Which Caps, Sprayers and Roll-Ons Fit My Bottle? | Best Bottles" },
    description: "Pick your bottle to see the caps, sprayers, roll-ons and droppers our catalog lists for its neck, with item codes to order by.",
    alternates: pageAlternates("/help/fit", undefined, { json: "/api/kb/v1/fit" }),
};

function sizeLabel(body: FitBody): string {
    const variant = body.name ?? bodyVariant(body);
    const size = `${variant ? `${variant} ` : ""}${body.capacityMl != null ? formatMl(body.capacityMl) : body.shape}`;
    return body.neck ? `${size} · ${body.neck}` : size;
}

export default async function FitFinderPage({ searchParams }: { searchParams: Promise<{ bottle?: string | string[] }> }) {
    // Older links used ?bottle=<id>; each bottle now has its own page.
    const params = await searchParams;
    const legacy = Array.isArray(params.bottle) ? params.bottle[0] : params.bottle;
    const legacyBody = legacy ? bodyById(legacy) : null;
    if (legacyBody?.interchangeable) redirect(fitHref(legacyBody));

    const families = bodiesByFamily();
    const fitted = families
        .map(({ family, bodies }) => ({ family, bodies: bodies.filter((body) => body.interchangeable) }))
        .filter(({ bodies }) => bodies.length > 0);
    const ownClosure = families
        .filter(({ bodies }) => bodies.every((body) => !body.interchangeable))
        .map(({ family }) => family);

    // A bottle on a neck finish with a builder goes straight into it (step 2, the applicator);
    // other bottles keep their fit page.
    const built = new Set(neckBuilderNecks());
    const bottleHref = (body: FitBody) => body.neck && built.has(body.neck) && neckBuilder(body.neck)?.bottles.some((b) => b.id === body.id)
        ? `${neckBuilderHref(body.neck)}?bottle=${encodeURIComponent(body.id)}`
        : fitHref(body);
    const downloads = neckBuilderNecks().flatMap((neck) => neckMatrixDownloads(neck).map((d) => ({ ...d, neck })));

    return (
        <HelpShell wide crumbs={[{ name: "Help", href: "/help" }, { name: "Fit finder" }]}>
            <h1 className="page-heading font-semibold uppercase leading-none tracking-[0.1em] text-[#1c1c1e] text-[22px] lg:text-[28px]">Which closures fit my bottle?</h1>
            <p className="mt-3 max-w-2xl text-[13px] text-slate">Pick your bottle. You&apos;ll choose the applicator, then the closure, with the item codes to order by.</p>

            <section aria-labelledby="bottles" className="mt-6">
                <h2 id="bottles" className="sr-only">Bottles</h2>
                <dl className="divide-y divide-[#d9cdb9] border-y border-[#d9cdb9]">
                    {fitted.map(({ family, bodies }) => (
                        <div key={family} className="grid gap-2 py-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                            <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-dim">{family}</dt>
                            <dd>
                                <ul className="flex flex-wrap gap-2">
                                    {bodies.map((body) => (
                                        <li key={body.id}>
                                            <Link href={bottleHref(body)} className="inline-flex min-h-10 items-center rounded-full border border-[#d9cdb9] bg-white px-4 text-[13px] text-[#1c1c1e] hover:border-[#1c1c1e]">
                                                {sizeLabel(body)}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </dd>
                        </div>
                    ))}
                </dl>
                {ownClosure.length > 0 && (
                    <p className="mt-3 max-w-3xl text-[12px] text-slate">
                        Sold with their own closure, so not listed here: {ownClosure.join(", ")}.
                    </p>
                )}
            </section>

            {downloads.length > 0 && (
                <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate">Printable matrices</span>
                    {downloads.map((d) => <a key={d.href} href={d.href} download className="text-gold-dim underline underline-offset-4">{d.neck}, {d.label.split(",")[0]} ({d.sizeMb} MB)</a>)}
                </p>
            )}

            <FormulaNote className="mt-10" />

            <ContactStrip />
        </HelpShell>
    );
}
