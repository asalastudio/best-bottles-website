import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import HelpShell, { ContactStrip, JsonLd } from "@/components/help/HelpShell";
import HelpGraceButton from "@/components/help/HelpGraceButton";
import { entryHref, publicEntries, publicEntryById, publicEntryBySlug, topicById } from "@/lib/help/kb";
import { buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { pageAlternates } from "@/i18n/metadata";

export const dynamicParams = false;

export function generateStaticParams() {
    return publicEntries().map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const entry = publicEntryBySlug(slug);
    if (!entry) return {};
    return {
        title: { absolute: `${entry.title} | Help Center | Best Bottles` },
        description: entry.shortAnswer,
        alternates: pageAlternates(entryHref(entry)),
    };
}

function formatDate(iso: string): string {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function HelpEntryPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const entry = publicEntryBySlug(slug);
    if (!entry) notFound();
    const topic = topicById(entry.topic);
    const related = entry.related.map((id) => publicEntryById(id)).filter((item) => item !== null);
    const topicHref = `/help/topic/${entry.topic}`;

    return (
        <HelpShell crumbs={[{ name: "Help", href: "/help" }, ...(topic ? [{ name: topic.title, href: topicHref }] : []), { name: entry.title }]}>
            <JsonLd data={buildBreadcrumbJsonLd([
                { name: "Help", url: `${SITE_URL}/help` },
                ...(topic ? [{ name: topic.title, url: `${SITE_URL}${topicHref}` }] : []),
                { name: entry.title, url: `${SITE_URL}${entryHref(entry)}` },
            ])} />
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
                <article>
                    <h1 className="font-serif text-4xl leading-tight sm:text-5xl">{entry.title}</h1>

                    <section aria-label="Short answer" className="mt-8 border-l-2 border-muted-gold bg-warm-white px-5 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-dim">Short answer</p>
                        <p className="mt-2 text-lg leading-relaxed">{entry.shortAnswer}</p>
                    </section>

                    <section aria-labelledby="details" className="mt-10">
                        <h2 id="details" className="font-serif text-2xl">The full answer</h2>
                        <p className="mt-3 text-base leading-relaxed text-obsidian/90">{entry.body}</p>
                    </section>

                    {entry.openQuestions.length > 0 && (
                        <section aria-labelledby="clarifying" className="mt-8 rounded-sm border border-[#E8D6B0] bg-[#FBF5E8] p-5">
                            <h2 id="clarifying" className="text-sm font-semibold normal-case tracking-normal text-[#6E4B0E]">Being clarified</h2>
                            {entry.openQuestions.map((question) => (
                                <p key={question} className="mt-2 text-sm leading-relaxed text-[#5C4310]">{question}</p>
                            ))}
                        </section>
                    )}

                    <div className="mt-10 flex flex-wrap gap-3">
                        <HelpGraceButton question={entry.title} />
                        <Link href={`/help/ask?q=${encodeURIComponent(entry.title)}`} className="inline-flex h-11 items-center rounded-md border border-champagne px-5 text-sm hover:border-gold-dim">
                            This didn&apos;t answer my question
                        </Link>
                    </div>

                    {related.length > 0 && (
                        <section aria-labelledby="related" className="mt-14">
                            <h2 id="related" className="font-serif text-2xl">Related answers</h2>
                            <ul className="mt-4 divide-y divide-champagne/70 border-y border-champagne/70">
                                {related.map((item) => (
                                    <li key={item.id}>
                                        <Link href={entryHref(item)} className="flex items-center justify-between gap-4 py-4 hover:text-gold-dim">
                                            {item.title}<span aria-hidden="true" className="text-gold-dim">→</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </article>

                <aside aria-label="Source" className="h-fit rounded-sm border border-champagne/70 bg-warm-white p-5 text-sm lg:sticky lg:top-40">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-dim">Source</h2>
                    <dl className="mt-3 space-y-3">
                        {entry.sources.map((source) => (
                            <div key={source.ref}>
                                <dt className="sr-only">Document</dt>
                                <dd>
                                    {source.url ? <a href={source.url} className="underline underline-offset-4 hover:text-gold-dim" rel="nofollow">{source.label}</a> : source.label}
                                </dd>
                                <dt className="sr-only">Checked</dt>
                                <dd className="text-slate">Checked {formatDate(source.checkedOn)}</dd>
                            </div>
                        ))}
                        <div>
                            <dt className="text-xs text-slate">Answer ID</dt>
                            <dd className="font-mono text-xs">{entry.id} · v{entry.version}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-slate">Status</dt>
                            <dd>Approved policy, published {formatDate(entry.publishedOn)}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-slate">Owner</dt>
                            <dd>{entry.owner ?? "Not yet assigned"}</dd>
                        </div>
                    </dl>
                </aside>
            </div>

            <ContactStrip />
        </HelpShell>
    );
}
