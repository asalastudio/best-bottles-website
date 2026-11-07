import type { Metadata } from "next";
import Link from "next/link";
import HelpShell, { ContactStrip } from "@/components/help/HelpShell";
import HelpGraceButton from "@/components/help/HelpGraceButton";
import {
    FIT_SNAPSHOT, FIT_STATUS_LABEL, FIT_STATUS_MEANING, bodiesByFamily, bodyLabel, fitReport, formatMl,
    type FitGroup, type FitStatus,
} from "@/lib/help/fit";
import { catalogHref } from "@/lib/catalogFilters";
import { pageAlternates } from "@/i18n/metadata";

export const metadata: Metadata = {
    title: { absolute: "Fit Finder — Which Closures Fit My Bottle? | Best Bottles" },
    description: "Pick a bottle to see the caps, sprayers, roll-ons and droppers our catalog lists for it, with what each label means and where it comes from.",
    alternates: pageAlternates("/help/fit"),
};

const STATUS_STYLE: Record<FitStatus, { dot: string; text: string; box: string }> = {
    listed: { dot: "bg-[#2F6B45]", text: "text-[#2F6B45]", box: "border-champagne/70 bg-warm-white" },
    "not-confirmed": { dot: "bg-[#B07A1F]", text: "text-[#7A5410]", box: "border-[#E8D6B0] bg-[#FBF5E8]" },
    conflicting: { dot: "bg-[#A23B2A]", text: "text-[#8A2E20]", box: "border-[#E5C4BC] bg-[#FBF0EE]" },
};

function formatDate(iso: string): string {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function Groups({ groups, status }: { groups: FitGroup[]; status: FitStatus }) {
    const style = STATUS_STYLE[status];
    return (
        <div className="mt-4 space-y-6">
            {groups.map((group) => (
                <div key={group.type}>
                    <h4 className="text-sm font-semibold">{group.label} <span className="font-normal text-slate">· {group.rows.length}</span></h4>
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                        {group.rows.map((row) => (
                            <li key={row.componentId} className={`rounded-sm border p-3 text-sm ${style.box}`}>
                                <span className="block">{row.name}</span>
                                <span className={`mt-1 flex items-center gap-1.5 text-xs ${style.text}`}>
                                    <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${style.dot}`} />
                                    {FIT_STATUS_LABEL[status]}
                                    <span className="text-slate">· {row.componentId}</span>
                                </span>
                                {row.reason && <span className="mt-1 block text-xs text-slate">{row.reason}</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}

export default async function FitFinderPage({ searchParams }: { searchParams: Promise<{ bottle?: string | string[] }> }) {
    const params = await searchParams;
    const bottleId = (Array.isArray(params.bottle) ? params.bottle[0] : params.bottle) ?? "";
    const report = bottleId ? fitReport(bottleId) : null;
    const families = bodiesByFamily();

    return (
        <HelpShell wide crumbs={[{ name: "Help", href: "/help" }, { name: "Fit finder" }]}>
            <h1 className="font-serif text-4xl sm:text-5xl">Which closures fit my bottle?</h1>
            <p className="mt-3 max-w-2xl text-slate">
                Choose a bottle. You&apos;ll see the closures our catalog lists for it, kept apart from parts that only share its thread.
            </p>

            <form action="/help/fit" method="get" className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex flex-1 flex-col gap-1.5">
                    <label htmlFor="bottle" className="text-xs text-slate">Your bottle</label>
                    <select id="bottle" name="bottle" defaultValue={bottleId} className="h-12 rounded-md border border-champagne bg-white px-3 text-base">
                        <option value="">Choose a bottle…</option>
                        {families.map(({ family, bodies }) => (
                            <optgroup key={family} label={family}>
                                {bodies.map((body) => (
                                    <option key={body.id} value={body.id}>
                                        {bodyLabel(body)}{body.neck ? ` · ${body.neck}` : ""}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>
                <button type="submit" className="h-12 rounded-md bg-obsidian px-6 text-sm font-medium text-warm-white hover:bg-obsidian/90">Show closures</button>
            </form>

            <section aria-labelledby="legend" className="mt-8 grid gap-3 sm:grid-cols-3">
                <h2 id="legend" className="sr-only">What the labels mean</h2>
                {(Object.keys(FIT_STATUS_LABEL) as FitStatus[]).map((status) => (
                    <div key={status} className={`rounded-sm border p-4 ${STATUS_STYLE[status].box}`}>
                        <p className={`flex items-center gap-2 text-sm font-semibold ${STATUS_STYLE[status].text}`}>
                            <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${STATUS_STYLE[status].dot}`} />{FIT_STATUS_LABEL[status]}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate">{FIT_STATUS_MEANING[status]}</p>
                    </div>
                ))}
            </section>

            {bottleId && !report && (
                <p className="mt-10 rounded-sm border border-champagne/70 bg-warm-white p-5 text-sm">We couldn&apos;t find that bottle. Choose one from the list above.</p>
            )}

            {report && (
                <div className="mt-12 grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <aside className="h-fit rounded-sm border border-champagne/70 bg-warm-white p-5 lg:sticky lg:top-40">
                        <h2 className="font-serif text-3xl">{bodyLabel(report.body)}</h2>
                        <dl className="mt-4 space-y-2 text-sm">
                            <div className="flex justify-between gap-4"><dt className="text-slate">Neck finish</dt><dd className="font-medium">{report.body.neck ?? "None"}</dd></div>
                            {report.body.capacityMl != null && <div className="flex justify-between gap-4"><dt className="text-slate">Capacity</dt><dd>{formatMl(report.body.capacityMl)}</dd></div>}
                            {report.body.heightMm != null && <div className="flex justify-between gap-4"><dt className="text-slate">Height without closure</dt><dd>{report.body.heightMm} mm</dd></div>}
                            {report.body.diameterMm != null && <div className="flex justify-between gap-4"><dt className="text-slate">Width</dt><dd>{report.body.diameterMm} mm</dd></div>}
                            {report.body.glass.length > 0 && <div className="flex justify-between gap-4"><dt className="text-slate">Glass</dt><dd className="text-right">{report.body.glass.join(", ")}</dd></div>}
                        </dl>
                        <p className="mt-4 border-t border-champagne/70 pt-3 text-xs text-slate">
                            From our catalog records of {formatDate(FIT_SNAPSHOT.date)}.{report.body.dimsSource ? ` Measurements: ${report.body.dimsSource}.` : ""}
                        </p>
                        <Link href={catalogHref({ families: [report.body.family], capacities: report.body.capacityMl != null ? [formatMl(report.body.capacityMl)] : [] })} className="mt-4 inline-block text-sm text-gold-dim underline underline-offset-4">
                            See price and stock
                        </Link>
                    </aside>

                    <div>
                        {!report.body.interchangeable ? (
                            <section className="rounded-sm border border-champagne/70 bg-warm-white p-6">
                                <h3 className="font-serif text-2xl">Sold as a set</h3>
                                <p className="mt-2 text-sm leading-relaxed text-slate">
                                    This {report.body.category.toLowerCase()} is its own compatibility class: a matching neck size does not make our glass-bottle closures fit it. Use the closure it is sold with.
                                </p>
                            </section>
                        ) : (
                            <>
                                <section aria-labelledby="listed">
                                    <h3 id="listed" className="font-serif text-2xl">Listed fits <span className="text-base text-slate">· {report.counts.listed}</span></h3>
                                    {report.counts.listed > 0
                                        ? <Groups groups={report.listed} status="listed" />
                                        : <p className="mt-2 text-sm text-slate">No closure is listed for this bottle in our catalog records.</p>}
                                </section>

                                {report.counts["not-confirmed"] > 0 && (
                                    <section aria-labelledby="not-confirmed" className="mt-12">
                                        <h3 id="not-confirmed" className="font-serif text-2xl">Same thread, not confirmed <span className="text-base text-slate">· {report.counts["not-confirmed"]}</span></h3>
                                        <p className="mt-1 max-w-2xl text-sm text-slate">{FIT_STATUS_MEANING["not-confirmed"]}</p>
                                        <Groups groups={report.notConfirmed} status="not-confirmed" />
                                        <Link href={`/help/ask?q=${encodeURIComponent(`Does a same-thread closure fit the ${bodyLabel(report.body)}?`)}`} className="mt-4 inline-block text-sm underline underline-offset-4">Ask our team to check one</Link>
                                    </section>
                                )}

                                {report.counts.conflicting > 0 && (
                                    <section aria-labelledby="conflicting" className="mt-12">
                                        <h3 id="conflicting" className="font-serif text-2xl">Conflicting records <span className="text-base text-slate">· {report.counts.conflicting}</span></h3>
                                        <Groups groups={report.conflicting} status="conflicting" />
                                    </section>
                                )}
                            </>
                        )}

                        <section aria-labelledby="formula" className="mt-12 rounded-sm border border-champagne/70 bg-linen p-6">
                            <h3 id="formula" className="text-base font-semibold">Will it work with my formula?</h3>
                            <p className="mt-2 text-sm leading-relaxed text-slate">
                                This page shows physical fit only. We don&apos;t hold test data on how glass, caps, roller balls or seals react to specific oils, alcohols or actives, so suitability is unknown. Test samples with your formula first.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-3">
                                <Link href="/request-sample" className="inline-flex h-11 items-center rounded-md border border-champagne bg-warm-white px-5 text-sm hover:border-gold-dim">Request samples</Link>
                                <HelpGraceButton question={`Which closures are listed for the ${bodyLabel(report.body)} with a ${report.body.neck} neck?`} label="Ask Grace about this bottle" tone="light" />
                            </div>
                        </section>
                    </div>
                </div>
            )}

            <ContactStrip />
        </HelpShell>
    );
}
