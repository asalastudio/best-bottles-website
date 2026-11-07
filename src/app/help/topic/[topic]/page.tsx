import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import HelpShell, { ContactStrip, JsonLd } from "@/components/help/HelpShell";
import HelpAskBox from "@/components/help/HelpAskBox";
import { KB_TOPICS, entriesForTopic, entryHref, topicById } from "@/lib/help/kb";
import { buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { pageAlternates } from "@/i18n/metadata";

export const dynamicParams = false;

export function generateStaticParams() {
    return KB_TOPICS.filter((topic) => topic.id !== "products").map((topic) => ({ topic: topic.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
    const { topic: id } = await params;
    const topic = topicById(id);
    if (!topic) return {};
    return {
        title: { absolute: `${topic.title} | Help Center | Best Bottles` },
        description: topic.summary,
        alternates: pageAlternates(`/help/topic/${topic.id}`),
    };
}

export default async function HelpTopicPage({ params }: { params: Promise<{ topic: string }> }) {
    const { topic: id } = await params;
    const topic = topicById(id);
    if (!topic) notFound();
    const entries = entriesForTopic(topic.id);

    const faqJsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: entries.map((entry) => ({
            "@type": "Question",
            name: entry.title,
            url: `${SITE_URL}${entryHref(entry)}`,
            acceptedAnswer: { "@type": "Answer", text: entry.body },
        })),
    };

    return (
        <HelpShell crumbs={[{ name: "Help", href: "/help" }, { name: topic.title }]}>
            <JsonLd data={faqJsonLd} />
            <JsonLd data={buildBreadcrumbJsonLd([
                { name: "Help", url: `${SITE_URL}/help` },
                { name: topic.title, url: `${SITE_URL}/help/topic/${topic.id}` },
            ])} />
            <h1 className="font-serif text-4xl sm:text-5xl">{topic.title}</h1>
            <p className="mt-3 text-slate">{topic.summary}</p>

            <div className="mt-8">
                <HelpAskBox compact />
            </div>

            <ul className="mt-10 divide-y divide-champagne/70 border-y border-champagne/70">
                {entries.map((entry) => (
                    <li key={entry.id}>
                        <Link href={entryHref(entry)} className="group block py-5">
                            <span className="block font-serif text-xl group-hover:text-gold-dim">{entry.title}</span>
                            <span className="mt-1 block text-sm leading-relaxed text-slate">{entry.shortAnswer}</span>
                            {entry.openQuestions.length > 0 && (
                                <span className="mt-2 inline-block rounded-full bg-[#F6EBD3] px-2.5 py-0.5 text-xs text-[#7A5410]">Our FAQ gives two figures, see the answer</span>
                            )}
                        </Link>
                    </li>
                ))}
            </ul>

            <nav aria-label="Other topics" className="mt-12">
                <h2 className="text-sm font-semibold">Other topics</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                    {KB_TOPICS.filter((other) => other.id !== topic.id).map((other) => (
                        <li key={other.id}>
                            <Link href={other.id === "products" ? "/help/fit" : `/help/topic/${other.id}`} className="inline-flex min-h-10 items-center rounded-full border border-champagne px-4 text-sm hover:border-gold-dim">
                                {other.title}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            <ContactStrip />
        </HelpShell>
    );
}
