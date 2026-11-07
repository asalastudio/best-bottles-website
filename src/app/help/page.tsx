import type { Metadata } from "next";
import Link from "next/link";
import HelpShell, { ContactStrip } from "@/components/help/HelpShell";
import HelpAskBox from "@/components/help/HelpAskBox";
import { KB_TOPICS, entriesForTopic, entryHref, publicEntryById } from "@/lib/help/kb";
import { pageAlternates } from "@/i18n/metadata";

export const metadata: Metadata = {
    title: { absolute: "Help Center | Best Bottles" },
    description: "Answers on orders, shipping, returns and which closures are listed for each bottle, with the source shown for every answer. No account needed.",
    alternates: pageAlternates("/help"),
};

/** Four facts people ask first. Each links to its approved entry; the figures are the FAQ's own. */
const ESSENTIALS: Array<{ entryId: string; figure: string; label: string }> = [
    { entryId: "policy.minimum-order", figure: "$50", label: "Order minimum, excluding shipping" },
    { entryId: "policy.lead-times", figure: "2–3 days", label: "Domestic processing, in business days" },
    { entryId: "policy.returns", figure: "15 days", label: "To return eligible products, with a 15% restocking fee" },
    { entryId: "policy.same-day", figure: "11:00am PST", label: "Same-day shipping cutoff, by phone, $15 fee" },
];

const POPULAR = ["policy.lead-times", "policy.returns", "policy.samples", "policy.missing-items", "policy.international-shipping", "policy.shipping-options"];

export default function HelpHomePage() {
    return (
        <HelpShell>
            <header className="text-center">
                <h1 className="font-serif text-4xl leading-tight sm:text-5xl">How can we help?</h1>
                <p className="mt-3 text-base text-slate">Answers for your bottle, your closure and your order. No account needed.</p>
            </header>

            <div className="mt-10">
                <HelpAskBox />
            </div>

            <section aria-labelledby="essentials" className="mt-16">
                <h2 id="essentials" className="sr-only">Essentials</h2>
                <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-champagne/70 bg-champagne/70 lg:grid-cols-4">
                    {ESSENTIALS.map((item) => {
                        const entry = publicEntryById(item.entryId);
                        if (!entry) return null;
                        return (
                            <li key={item.entryId} className="bg-warm-white">
                                <Link href={entryHref(entry)} className="block h-full p-5 transition-colors hover:bg-linen">
                                    <span className="block font-serif text-2xl sm:text-3xl">{item.figure}</span>
                                    <span className="mt-1 block text-xs leading-relaxed text-slate">{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </section>

            <section aria-labelledby="topics" className="mt-16">
                <div className="flex items-end justify-between gap-4">
                    <h2 id="topics" className="font-serif text-3xl">Or find it yourself</h2>
                </div>
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {KB_TOPICS.map((topic) => {
                        const count = topic.id === "products" ? null : entriesForTopic(topic.id).length;
                        const href = topic.id === "products" ? "/help/fit" : `/help/topic/${topic.id}`;
                        return (
                            <li key={topic.id}>
                                <Link href={href} className="group flex h-full flex-col rounded-sm border border-champagne/70 bg-warm-white p-6 transition-colors hover:border-gold-dim">
                                    <span className="font-serif text-xl">{topic.title}</span>
                                    <span className="mt-2 flex-1 text-sm leading-relaxed text-slate">{topic.summary}</span>
                                    <span className="mt-4 text-sm text-gold-dim group-hover:underline underline-offset-4">
                                        {count === null ? "Open the fit finder" : `${count} ${count === 1 ? "answer" : "answers"}`} →
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </section>

            <section aria-labelledby="finder-teaser" className="mt-16 grid gap-6 rounded-sm bg-obsidian p-6 text-warm-white sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-gold">Fit finder</p>
                    <h2 id="finder-teaser" className="mt-2 font-serif text-3xl">Which cap, sprayer or roll-on goes with my bottle?</h2>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-warm-white/75">
                        Pick a bottle to see the closures our catalog lists for it, the same-thread parts that are not confirmed, and anything our records disagree on.
                    </p>
                </div>
                <Link href="/help/fit" className="inline-flex h-12 items-center justify-center rounded-md bg-muted-gold px-6 text-sm font-semibold text-obsidian transition-colors hover:bg-champagne">
                    Open the fit finder
                </Link>
            </section>

            <section aria-labelledby="popular" className="mt-16">
                <h2 id="popular" className="font-serif text-3xl">Popular answers</h2>
                <ul className="mt-6 divide-y divide-champagne/70 border-y border-champagne/70">
                    {POPULAR.map((id) => publicEntryById(id)).filter((entry) => entry !== null).map((entry) => (
                        <li key={entry.id}>
                            <Link href={entryHref(entry)} className="group flex items-center justify-between gap-6 py-4">
                                <span>
                                    <span className="block text-base text-obsidian group-hover:text-gold-dim">{entry.title}</span>
                                    <span className="mt-1 block text-sm text-slate line-clamp-1">{entry.shortAnswer}</span>
                                </span>
                                <span aria-hidden="true" className="text-gold-dim">→</span>
                            </Link>
                        </li>
                    ))}
                </ul>
                <p className="mt-4 text-sm">
                    <Link href="/help/ask" className="text-gold-dim underline underline-offset-4">Can&apos;t find it? Send us your question</Link>
                </p>
            </section>

            <ContactStrip />
        </HelpShell>
    );
}
