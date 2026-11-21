import type { Metadata } from "next";
import HelpShell, { ContactStrip } from "@/components/help/HelpShell";
import HelpQuestionForm from "@/components/help/HelpQuestionForm";
import { pageAlternates } from "@/i18n/metadata";

export const metadata: Metadata = {
    title: { absolute: "Ask Our Team | Help Center | Best Bottles" },
    description: "Send a question the help center couldn't answer. Our team reviews every question.",
    alternates: pageAlternates("/help/ask"),
};

export default async function HelpAskPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
    const params = await searchParams;
    const q = (Array.isArray(params.q) ? params.q[0] : params.q) ?? "";
    return (
        <HelpShell crumbs={[{ name: "Help", href: "/help" }, { name: "Ask our team" }]}>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                    <h1 className="font-serif text-4xl sm:text-5xl">Ask our team</h1>
                    <p className="mt-3 max-w-xl text-slate">
                        If the help center or Grace couldn&apos;t answer, send us the question. Common questions become new answers once our team has approved them.
                    </p>
                    <div className="mt-8">
                        <HelpQuestionForm defaultQuestion={q} />
                    </div>
                </div>
                <aside className="h-fit rounded-sm bg-obsidian p-6 text-warm-white">
                    <h2 className="font-serif text-2xl">About an existing order?</h2>
                    <p className="mt-2 text-sm leading-relaxed text-warm-white/75">
                        For your privacy, don&apos;t send order details here. Email or call us with your order number.
                    </p>
                    <a href="mailto:sales@nematinternational.com" className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-muted-gold px-4 text-sm font-semibold text-obsidian hover:bg-champagne">
                        Email the team
                    </a>
                    <a href="tel:+18009363628" className="mt-2 block text-center text-sm text-warm-white/85">1-800-936-3628</a>
                </aside>
            </div>
            <ContactStrip />
        </HelpShell>
    );
}
