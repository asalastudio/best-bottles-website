"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowsClockwise, Ruler, Tag } from "@/components/icons";

/**
 * Shared frame for /sign-in and /sign-up.
 *
 * Clerk's <SignIn />/<SignUp /> used to float as a bare default card on an
 * empty page — no navigation, no footer, no brand context, which read as a
 * third-party modal. This puts the form inside the site chrome and pairs it
 * with a brand panel, while the Clerk widget itself is themed globally by
 * `clerkAppearance`.
 */

const ASSURANCES = [
    {
        Icon: Tag,
        title: "Your pricing, in one place",
        body: "Account pricing, quote history, and past orders stay together.",
    },
    {
        Icon: Ruler,
        title: "Your specs, on file",
        body: "Neck sizes, fitments, and the formats you reorder — saved between visits.",
    },
    {
        Icon: ArrowsClockwise,
        title: "Faster reorders",
        body: "Re-run a previous order or turn a saved cart into a quote in a click.",
    },
];

export default function AuthShell({
    context,
    title,
    subtitle,
    children,
}: {
    /** e.g. "Client Portal" / "Team Hub" — where the visitor was heading. */
    context: string;
    title: string;
    subtitle: string;
    children: React.ReactNode;
}) {
    return (
        <main className="min-h-screen bg-bone">
            <Navbar hideMobileSearch />

            <section className="mx-auto max-w-[1180px] px-4 pb-20 pt-[116px] sm:px-6 sm:pt-[160px] lg:pt-[136px]">
                <div className="grid gap-10 lg:grid-cols-[1fr_460px] lg:gap-16">
                    {/* ── Brand panel ─────────────────────────────────────── */}
                    <aside className="hidden lg:flex lg:flex-col lg:justify-center">
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-muted-gold">
                            A Division of Nemat International
                        </p>
                        <h2 className="font-serif text-[42px] font-medium leading-[1.08] tracking-[0.01em] text-obsidian">
                            Beautifully
                            <br />
                            contained.
                        </h2>
                        <p className="mt-5 max-w-md text-sm leading-relaxed text-slate">
                            2,300+ premium glass bottles, sprayers, and packaging components —
                            with fitment guidance from Grace, our AI bottling specialist.
                        </p>

                        <ul className="mt-10 space-y-6 border-t border-champagne/50 pt-8">
                            {ASSURANCES.map(({ Icon, title: t, body }) => (
                                <li key={t} className="flex gap-4">
                                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-champagne/60 bg-white text-muted-gold">
                                        <Icon size={16} />
                                    </span>
                                    <div>
                                        <p className="text-sm font-semibold text-obsidian">{t}</p>
                                        <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate">
                                            {body}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </aside>

                    {/* ── Auth card ───────────────────────────────────────── */}
                    <div className="w-full">
                        <div className="rounded-sm border border-champagne/50 bg-linen px-5 py-8 sm:px-8 sm:py-10">
                            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-gold">
                                {context}
                            </p>
                            <h1 className="mt-2 font-serif text-3xl font-medium leading-snug text-obsidian">
                                {title}
                            </h1>
                            <p className="mt-2 text-sm leading-relaxed text-slate">{subtitle}</p>

                            <div className="auth-clerk-embed mt-7 w-full min-w-0 border-t border-champagne/50 pt-7">
                                {children}
                            </div>
                        </div>

                        <p className="mt-5 text-center text-xs leading-relaxed text-slate">
                            Need help?{" "}
                            <Link
                                href="/contact"
                                className="font-semibold text-obsidian underline underline-offset-4 hover:text-muted-gold"
                            >
                                Contact the team
                            </Link>{" "}
                            or{" "}
                            <Link
                                href="/request-quote"
                                className="font-semibold text-obsidian underline underline-offset-4 hover:text-muted-gold"
                            >
                                request a quote
                            </Link>{" "}
                            without an account.
                        </p>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
