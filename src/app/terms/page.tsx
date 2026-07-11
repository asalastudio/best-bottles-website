import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
    title: { absolute: "Terms of Service | Best Bottles" },
    description: "The terms that govern your use of the Best Bottles website and purchases.",
    alternates: { canonical: `${SITE_URL}/terms` },
};

const UPDATED = "July 2026";

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-bone">
            <Navbar />
            <main className="pt-32 pb-20 px-6">
                <div className="max-w-[760px] mx-auto">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-gold font-bold mb-4">Legal</p>
                    <h1 className="font-serif text-4xl lg:text-5xl text-obsidian leading-tight mb-3">Terms of Service</h1>
                    <p className="text-sm text-slate mb-12">Last updated: {UPDATED}</p>

                    <div className="space-y-8 text-slate leading-relaxed">
                        <p>
                            These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the Best Bottles website,
                            operated by Nemat International, Inc. (&ldquo;Best Bottles,&rdquo; &ldquo;we,&rdquo;
                            &ldquo;us&rdquo;). By using this site or placing an order, you agree to these Terms.
                        </p>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">Products & catalog</h2>
                            <p>
                                We are a supplier of glass bottles, closures, and applicators. We make reasonable efforts
                                to display products, specifications, and compatibility accurately, but descriptions,
                                dimensions, and imagery are provided for reference and may vary. Availability is subject
                                to change without notice.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">Orders, quotes & pricing</h2>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Orders are subject to a site-wide minimum purchase. Per-SKU case quantities and tiered wholesale pricing are shown on each product page.</li>
                                <li>Prices shown on the site are for reference. The final price, taxes, and shipping are confirmed at checkout, which is processed through Shopify.</li>
                                <li>Quote and sample requests are not binding offers; we will follow up to confirm details, availability, and pricing.</li>
                                <li>We reserve the right to refuse or cancel any order, and to correct pricing or product errors.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">Acceptable use</h2>
                            <p>
                                You agree not to misuse the site, interfere with its operation, attempt unauthorized
                                access, or use its content for unlawful purposes.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">Intellectual property</h2>
                            <p>
                                The site and its content — including text, imagery, and the Best Bottles and Nemat
                                International names and marks — are owned by Nemat International, Inc. or its licensors and
                                may not be used without permission.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">Disclaimers & limitation of liability</h2>
                            <p>
                                The site and products are provided &ldquo;as is&rdquo; to the fullest extent permitted by
                                law. Customers are responsible for confirming that a product is suitable for their intended
                                use, including material compatibility. To the extent permitted by law, our liability is
                                limited to the amount paid for the applicable product.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">Governing law</h2>
                            <p>
                                These Terms are governed by the laws of the State of California, USA, without regard to its
                                conflict-of-laws rules.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">Contact</h2>
                            <p>
                                Nemat International, Inc. — Union City, California, USA<br />
                                <a href="mailto:sales@nematinternational.com" className="text-muted-gold hover:underline">sales@nematinternational.com</a> · <a href="tel:+18009363628" className="text-muted-gold hover:underline">1-800-936-3628</a>
                            </p>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
