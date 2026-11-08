import Link from "next/link";
import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export type Crumb = { name: string; href?: string };

/** Page frame shared by every /help page: site chrome, breadcrumbs, a calm bone ground. */
export default function HelpShell({ crumbs, children, wide = false }: { crumbs?: Crumb[]; children: ReactNode; wide?: boolean }) {
    return (
        <div className="min-h-screen bg-bone text-obsidian">
            <Navbar />
            <main className="pt-40 pb-24 px-4 sm:px-6">
                <div className={`mx-auto ${wide ? "max-w-[1120px]" : "max-w-[880px]"}`}>
                    {crumbs && crumbs.length > 0 && (
                        <nav aria-label="Breadcrumb" className="mb-8 text-xs text-slate">
                            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                {crumbs.map((crumb, i) => (
                                    <li key={`${crumb.name}-${i}`} className="flex items-center gap-2">
                                        {i > 0 && <span aria-hidden="true">/</span>}
                                        {crumb.href ? (
                                            <Link href={crumb.href} className="hover:text-obsidian underline-offset-4 hover:underline">{crumb.name}</Link>
                                        ) : (
                                            <span aria-current="page" className="text-obsidian">{crumb.name}</span>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </nav>
                    )}
                    {children}
                </div>
            </main>
            <Footer />
        </div>
    );
}

export function JsonLd({ data }: { data: unknown }) {
    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** Contact details from the approved FAQ entry `policy.contact`. */
export function ContactStrip() {
    return (
        <section aria-labelledby="help-contact" className="mt-16 grid gap-6 rounded-sm border border-champagne/70 bg-warm-white p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
            <div>
                <h2 id="help-contact" className="font-serif text-2xl">Talk to our team</h2>
                <p className="mt-1 text-sm text-slate">Monday–Friday, 9:30am–5:30pm PST.</p>
            </div>
            <div className="flex flex-col gap-1 text-sm sm:text-right">
                <a href="mailto:sales@nematinternational.com" className="underline underline-offset-4 hover:text-gold-dim">sales@nematinternational.com</a>
                <a href="tel:+18009363628" className="hover:text-gold-dim">1-800-936-3628</a>
                <span className="text-slate">International: 1-510-445-0300</span>
            </div>
        </section>
    );
}
