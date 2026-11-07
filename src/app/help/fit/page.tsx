import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import HelpShell, { ContactStrip } from "@/components/help/HelpShell";
import { FitLegend, FormulaNote } from "@/components/help/FitParts";
import { bodiesByFamily, bodyById, bodyVariant, fitHref, formatMl, type FitBody } from "@/lib/help/fit";
import { pageAlternates } from "@/i18n/metadata";

export const metadata: Metadata = {
    title: { absolute: "Fit Finder: Which Caps, Sprayers and Roll-Ons Fit My Bottle? | Best Bottles" },
    description: "Pick your bottle to see the caps, sprayers, roll-ons and droppers our catalog lists for its neck, with item codes to order by.",
    alternates: pageAlternates("/help/fit", undefined, { json: "/api/kb/v1/fit" }),
};

function sizeLabel(body: FitBody): string {
    const variant = bodyVariant(body);
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
