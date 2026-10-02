import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Wrench, ChatCircle, FileText, BookMarked } from "@/components/icons";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FAQ_POLICY_ENTRIES, FAQ_POLICY_SOURCE } from "@/lib/faqPolicy";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
    title: { absolute: "Resources — Guides, FAQs & Compatibility Tools | Best Bottles" },
    description: "Everything you need to choose the right bottles, closures, and packaging for your brand. Compatibility guides, FAQs, and expert insights.",
    alternates: { canonical: `${SITE_URL}/resources` },
};

const RESOURCES = [
    {
        icon: BookMarked,
        title: "Journal",
        description: "Expert guides on glass packaging, fragrance, and brand strategy. From bottle selection to scaling your label — insights from the Best Bottles team.",
        cta: "Read Articles",
        href: "/blog",
    },
    {
        icon: Wrench,
        title: "Compatibility Guides",
        description: "Understand neck finishes, thread sizes, and which closures work with which bottles. Our fitment system makes it foolproof.",
        cta: "Browse Catalog",
        href: "/resources#neck-size-basics",
    },
    {
        icon: BookOpen,
        title: "Frequently Asked Questions",
        description: "Ordering, shipping, payments, and returns from our approved FAQ.",
        cta: "Read FAQ",
        href: "/resources#faq",
    },
    {
        icon: FileText,
        title: "Request a Quote",
        description: "Need volume pricing or custom packaging? Submit a quote request to discuss your project with our team.",
        cta: "Request Quote",
        href: "/request-quote",
    },
    {
        icon: ChatCircle,
        title: "Talk with Grace",
        description: "Our AI Bottling Specialist is available 24/7. Talk with Grace about compatibility, pricing, and product recommendations.",
        cta: "Open Grace",
        href: "/",
    },
];

const FAQ_ITEMS = FAQ_POLICY_ENTRIES;

const PACKAGING_BASICS = [
    {
        id: "neck-size-basics",
        question: "What does neck size mean?",
        answer: "Neck size is the bottle opening and thread finish used to match a bottle with a compatible cap, reducer, sprayer, dropper, or roller. Treat matching neck sizes as the first fitment check, then verify the selected SKU before ordering.",
        href: "/catalog",
        cta: "Browse compatible products",
    },
    {
        id: "roll-on-bottle-selection",
        question: "How should I find a 10 ml roll-on bottle for perfume oil?",
        answer: "Start with the Roll-On applicator filter and small capacities around 6-15 ml, then compare neck size, roller style, cap finish, and case quantity on the product page before adding to cart.",
        href: "/catalog?applicators=rollon&search=10%20ml%20roll-on",
        cta: "See 10 ml roll-ons",
    },
    {
        id: "applicator-compatibility",
        question: "Can I use any applicator with any bottle?",
        answer: "No. Applicators and closures need to be compatible with the bottle neck finish and the selected product configuration. If compatibility is not clearly shown, confirm it with Grace or the Best Bottles team before ordering.",
        href: "/catalog?applicators=rollon,finemist,dropper",
        cta: "Explore applicators",
    },
    {
        id: "case-quantity-basics",
        question: "How many bottles come in a case?",
        answer: "Case quantity can vary by product and selected SKU. Use the product detail page for the specific bottle, color, size, and applicator configuration you plan to order.",
        href: "/catalog",
        cta: "Browse catalog",
    },
] as const;

function buildResourcesFaqJsonLd() {
    const entries = [
        ...FAQ_ITEMS.map((item) => ({ question: item.q, answer: item.a })),
    ];

    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: entries.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
            },
        })),
    };
}

export default function ResourcesPage() {
    return (
        <div className="min-h-screen bg-bone">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(buildResourcesFaqJsonLd()) }}
            />
            <Navbar />
            {/* Hero */}
            <section className="pt-32 pb-16 px-6">
                <div className="max-w-[800px] mx-auto text-center">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-gold font-bold mb-4">Resources</p>
                    <h1 className="font-serif text-5xl lg:text-6xl text-obsidian leading-tight mb-6">
                        Tools & Knowledge
                    </h1>
                    <p className="text-lg text-slate leading-relaxed max-w-[600px] mx-auto">
                        Everything you need to make confident packaging decisions — from compatibility tools to pricing guides.
                    </p>
                </div>
            </section>

            {/* Resource Cards */}
            <section className="py-12 px-6">
                <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                    {RESOURCES.map((r) => (
                        <Link
                            key={r.title}
                            href={r.href}
                            className="group bg-white rounded-xl p-6 border border-champagne/40 hover:border-muted-gold/60 transition-all hover:shadow-lg"
                        >
                            <div className="w-10 h-10 rounded-lg bg-muted-gold/10 flex items-center justify-center mb-4">
                                <r.icon className="w-5 h-5 text-muted-gold" />
                            </div>
                            <h3 className="font-serif text-xl text-obsidian mb-2">{r.title}</h3>
                            <p className="text-sm text-slate leading-relaxed mb-4">{r.description}</p>
                            <span className="text-sm font-semibold text-muted-gold group-hover:underline">{r.cta} →</span>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Packaging Basics */}
            <section className="py-12 px-6">
                <div className="max-w-[1000px] mx-auto">
                    <div className="mb-8">
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-gold font-bold mb-3">Packaging Basics</p>
                        <h2 className="font-serif text-3xl text-obsidian mb-3">Quick answers before you choose</h2>
                        <p className="text-sm text-slate leading-relaxed max-w-[640px]">
                            Short guidance for common bottle, fitment, and case-quantity questions. Use these notes as a starting point, then verify the exact SKU before ordering.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                        {PACKAGING_BASICS.map((item) => (
                            <article key={item.id} id={item.id} className="scroll-mt-32 border-t border-champagne/40 pt-5">
                                <h3 className="font-serif text-xl text-obsidian mb-3">{item.question}</h3>
                                <p className="text-sm text-slate leading-relaxed mb-4">{item.answer}</p>
                                <Link href={item.href} className="text-sm font-semibold text-muted-gold hover:underline">
                                    {item.cta} →
                                </Link>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="py-16 px-6 bg-white/50 border-y border-champagne/30">
                <div className="max-w-[800px] mx-auto">
                    <h2 className="font-serif text-3xl text-obsidian mb-10 text-center">Frequently Asked Questions</h2>
                    <p className="text-sm text-slate mb-8">Answers follow our <a href={FAQ_POLICY_SOURCE.url} className="text-muted-gold underline">approved FAQ</a>, verified {FAQ_POLICY_SOURCE.verifiedOn}.</p>
                    <div className="space-y-6">
                        {FAQ_ITEMS.map((item) => (
                            <div key={item.q} id={item.id} className="scroll-mt-32 border-b border-champagne/30 pb-6">
                                <h3 className="font-serif text-lg text-obsidian mb-2">{item.q}</h3>
                                <p className="text-sm text-slate leading-relaxed">{item.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            <Footer />
        </div>
    );
}
