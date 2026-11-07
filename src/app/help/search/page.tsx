import type { Metadata } from "next";
import Link from "next/link";
import HelpShell, { ContactStrip } from "@/components/help/HelpShell";
import HelpAskBox from "@/components/help/HelpAskBox";
import HelpGraceButton from "@/components/help/HelpGraceButton";
import { entryHref } from "@/lib/help/kb";
import { bodyLabel, fitHref, fitReport, formatMl, type FitBody } from "@/lib/help/fit";
import { FitGroups } from "@/components/help/FitParts";
import { searchHelp } from "@/lib/help/search";
import { catalogHref } from "@/lib/catalogFilters";

export const metadata: Metadata = {
    title: { absolute: "Search the Help Center | Best Bottles" },
    robots: { index: false, follow: true },
};

function bottleCatalogHref(body: FitBody): string {
    return catalogHref({ families: [body.family], capacities: body.capacityMl != null ? [formatMl(body.capacityMl)] : [] });
}

function SizeCard({ body, note }: { body: FitBody; note?: string }) {
    return (
        <li className="flex flex-col gap-2 rounded-sm border border-champagne/70 bg-warm-white p-5">
            {note && <span className="text-xs text-slate">{note}</span>}
            <span className="font-serif text-xl">{bodyLabel(body)}</span>
            <span className="text-sm text-slate">{body.neck ? `Neck ${body.neck}` : "No thread finish"}{body.glass.length ? ` · ${body.glass.join(", ")} glass` : ""}</span>
            <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <Link href={bottleCatalogHref(body)} className="text-gold-dim underline underline-offset-4">See price and stock</Link>
                {body.interchangeable && <Link href={fitHref(body)} className="underline underline-offset-4">What fits it</Link>}
            </span>
        </li>
    );
}

export default async function HelpSearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
    const params = await searchParams;
    const raw = (Array.isArray(params.q) ? params.q[0] : params.q) ?? "";
    const result = raw.trim() ? searchHelp(raw) : null;
    // One bottle and a fit question: show its listed parts here rather than one click away.
    const fitFor = result && result.bottles.length === 1 && result.bottles[0].interchangeable && (result.fitIntent || result.closure) ? fitReport(result.bottles[0].id) : null;
    const fitGroups = fitFor && result?.closure ? fitFor.listed.filter((group) => result.closure!.partTypes.includes(group.type)) : fitFor?.listed ?? [];
    const nothing = result && !result.size && result.answers.length === 0 && result.bottles.length === 0 && !result.gap;

    return (
        <HelpShell crumbs={[{ name: "Help", href: "/help" }, { name: "Search" }]}>
            <HelpAskBox compact defaultQuery={raw} />

            {!result && <p className="mt-10 text-slate">Type a question above, in your own words.</p>}

            {result && (
                <>
                    <header className="mt-10">
                        <h1 className="font-serif text-3xl sm:text-4xl">“{result.query}”</h1>
                        {result.interpretation.length > 0 && (
                            <p className="mt-2 text-sm text-slate">Read as {result.interpretation.join(" · ")}.</p>
                        )}
                    </header>

                    {result.gap && (
                        <section aria-labelledby="gap" className="mt-8 rounded-sm border border-[#E8D6B0] bg-[#FBF5E8] p-5">
                            <h2 id="gap" className="text-sm font-semibold normal-case tracking-normal text-[#6E4B0E]">No approved answer yet</h2>
                            <p className="mt-2 text-sm leading-relaxed text-[#5C4310]">
                                We don&apos;t have an approved answer on {result.gap} yet, so we won&apos;t guess. Please ask our team, or send the question and we&apos;ll review it.
                            </p>
                            <Link href={`/help/ask?q=${encodeURIComponent(raw)}`} className="mt-3 inline-block text-sm text-[#6E4B0E] underline underline-offset-4">Send this question</Link>
                        </section>
                    )}

                    {result.size?.notOffered && (
                        <section aria-labelledby="not-offered" className="mt-10">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-dim">Not offered</p>
                            <h2 id="not-offered" className="mt-2 font-serif text-3xl">
                                We don&apos;t make a {result.size.requestedLabel}{result.size.family ? ` ${result.size.family}` : ""}{result.size.closure ? ` ${result.size.closure}` : ""} bottle
                            </h2>
                            <p className="mt-2 max-w-2xl text-slate">It isn&apos;t out of stock: there is no such size in our catalog. These are the closest sizes we do make.</p>
                            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                                {result.size.smaller?.bodies.map((body) => (
                                    <SizeCard key={body.id} body={body} note={`${formatMl(Math.round((result.size!.requestedMl - result.size!.smaller!.ml) * 10) / 10)} smaller`} />
                                ))}
                                {result.size.larger?.bodies.map((body) => (
                                    <SizeCard key={body.id} body={body} note={`${formatMl(Math.round((result.size!.larger!.ml - result.size!.requestedMl) * 10) / 10)} larger`} />
                                ))}
                            </ul>
                        </section>
                    )}

                    {result.bottles.length > 0 && (
                        <section aria-labelledby="bottles" className="mt-10">
                            <h2 id="bottles" className="font-serif text-2xl">{result.fitIntent ? "Check the fit" : "Bottles that match"}</h2>
                            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                                {result.bottles.map((body) => <SizeCard key={body.id} body={body} />)}
                            </ul>
                        </section>
                    )}

                    {fitFor && (
                        <section aria-labelledby="parts" className="mt-10">
                            <h2 id="parts" className="font-serif text-2xl">
                                {result.closure ? `Listed ${result.closure.label}s` : "Listed fits"} for the {bodyLabel(fitFor.body)}
                            </h2>
                            {fitGroups.length > 0
                                ? <FitGroups groups={fitGroups} status="listed" />
                                : <p className="mt-2 text-sm">Our catalog lists no {result.closure?.label ?? "closure"} for this bottle.</p>}
                            <Link href={fitHref(fitFor.body)} className="mt-4 inline-block text-sm underline underline-offset-4">Everything that fits it, and what isn&apos;t confirmed</Link>
                        </section>
                    )}

                    {result.answers.length > 0 && (
                        <section aria-labelledby="answers" className="mt-10">
                            <h2 id="answers" className="font-serif text-2xl">Answers</h2>
                            <ul className="mt-4 divide-y divide-champagne/70 border-y border-champagne/70">
                                {result.answers.map(({ entry }) => (
                                    <li key={entry.id}>
                                        <Link href={entryHref(entry)} className="group block py-4">
                                            <span className="block text-base group-hover:text-gold-dim">{entry.title}</span>
                                            <span className="mt-1 block text-sm leading-relaxed text-slate">{entry.shortAnswer}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {result.catalogHref && (
                        <p className="mt-8 text-sm">
                            <Link href={result.catalogHref} className="text-gold-dim underline underline-offset-4">See matching products in the catalog</Link>
                            <span className="text-slate"> for live prices and stock.</span>
                        </p>
                    )}

                    {nothing && (
                        <section className="mt-10 rounded-sm border border-champagne/70 bg-warm-white p-6">
                            <h2 className="font-serif text-2xl">We don&apos;t have an approved answer for that yet</h2>
                            <p className="mt-2 text-sm text-slate">Try different words, ask Grace, or send the question to our team.</p>
                            <div className="mt-4 flex flex-wrap gap-3">
                                <HelpGraceButton question={raw} label="Ask Grace" />
                                <Link href={`/help/ask?q=${encodeURIComponent(raw)}`} className="inline-flex h-11 items-center rounded-md border border-champagne px-5 text-sm hover:border-gold-dim">Send this question</Link>
                            </div>
                        </section>
                    )}

                    {!nothing && (
                        <div className="mt-10 flex flex-wrap items-center gap-3 text-sm">
                            <span className="text-slate">Not quite it?</span>
                            <HelpGraceButton question={raw} label="Ask Grace instead" tone="light" />
                            <Link href={`/help/ask?q=${encodeURIComponent(raw)}`} className="underline underline-offset-4">Send the question to our team</Link>
                        </div>
                    )}
                </>
            )}

            <ContactStrip />
        </HelpShell>
    );
}
