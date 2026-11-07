import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import HelpShell, { ContactStrip } from "@/components/help/HelpShell";
import { FitLegend, FormulaNote } from "@/components/help/FitParts";
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

    return (
        <HelpShell wide crumbs={[{ name: "Help", href: "/help" }, { name: "Fit finder" }]}>
            <h1 className="font-serif text-4xl sm:text-5xl">Which closures fit my bottle?</h1>
            <p className="mt-3 max-w-2xl text-slate">Pick your bottle and size. You&apos;ll see the closures our catalog lists for it, with item codes.</p>

            {neckBuilderNecks().map((neck) => {
                const view = neckBuilder(neck);
                return view && (
                    <Link key={neck} href={neckBuilderHref(neck)} className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-champagne bg-white p-5 hover:border-gold-dim">
                        <span>
                            <span className="block font-semibold">Build a {neck} bottle</span>
                            <span className="mt-1 block text-sm text-slate">Choose one of {view.bottles.length} bottles, then a roll-on, sprayer or pour, then the cap. Every {neck} part fits every {neck} bottle.</span>
                        </span>
                        <span className="text-sm font-semibold text-gold-dim">Start building →</span>
                    </Link>
                );
            })}

            {neckBuilderNecks().some((neck) => neckMatrixDownloads(neck).length > 0) && (
                <section aria-labelledby="matrices" className="mt-6 border border-champagne bg-white p-5">
                    <h2 id="matrices" className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate">Printable matrices</h2>
                    <ul className="mt-3 space-y-2 text-sm">
                        {neckBuilderNecks().map((neck) => neckMatrixDownloads(neck).length > 0 && (
                            <li key={neck}><span className="font-semibold">{neck}:</span>{" "}
                                {neckMatrixDownloads(neck).map((d, i) => <span key={d.href}>{i > 0 && " · "}<a href={d.href} download className="text-gold-dim underline underline-offset-4">{d.label}</a> <span className="text-slate">({d.sizeMb} MB)</span></span>)}
                            </li>
                        ))}
                    </ul>
                    <p className="mt-2 text-xs text-slate">Every bottle on a neck finish with the applicators and closures that fit it, with item codes. More neck finishes follow.</p>
                </section>
            )}

            <FitLegend className="mt-8" />

            <section aria-labelledby="bottles" className="mt-12">
                <h2 id="bottles" className="font-serif text-2xl">Bottles</h2>
                <dl className="mt-4 divide-y divide-champagne/70 border-y border-champagne/70">
                    {fitted.map(({ family, bodies }) => (
                        <div key={family} className="grid gap-2 py-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-baseline">
                            <dt className="font-medium">{family}</dt>
                            <dd>
                                <ul className="flex flex-wrap gap-2">
                                    {bodies.map((body) => (
                                        <li key={body.id}>
                                            <Link href={fitHref(body)} className="inline-flex min-h-10 items-center rounded-full border border-champagne bg-warm-white px-4 text-sm hover:border-gold-dim">
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
                    <p className="mt-4 max-w-3xl text-sm text-slate">
                        Sold with their own closure, so not listed here: {ownClosure.join(", ")}. Use the closure each is sold with.
                    </p>
                )}
            </section>

            <FormulaNote className="mt-12" />

            <ContactStrip />
        </HelpShell>
    );
}
