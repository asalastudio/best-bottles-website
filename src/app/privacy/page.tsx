import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
    title: { absolute: "Privacy Policy | Best Bottles" },
    description: "How Best Bottles and Nemat International collect, use, and protect your information.",
    alternates: { canonical: `${SITE_URL}/privacy` },
};

const UPDATED = "July 2026";

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-bone">
            <Navbar />
            <main className="pt-32 pb-20 px-6">
                <div className="max-w-[760px] mx-auto">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-gold font-bold mb-4">Legal</p>
                    <h1 className="font-serif text-4xl lg:text-5xl text-obsidian leading-tight mb-3">Privacy Policy</h1>
                    <p className="text-sm text-slate mb-12">Last updated: {UPDATED}</p>

                    <div className="space-y-8 text-slate leading-relaxed">
                        <p>
                            Best Bottles is a division of Nemat International, Inc. (&ldquo;Best Bottles,&rdquo;
                            &ldquo;we,&rdquo; &ldquo;us&rdquo;). This policy explains what information we collect when
                            you use this website, how we use it, and the choices you have.
                        </p>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">Information we collect</h2>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Information you provide.</strong> When you request a sample, request a quote, or contact us, we collect the details you submit — such as your name, email address, company, and the products or quantities you are interested in.</li>
                                <li><strong>Order information.</strong> Purchases are processed through Shopify. Payment, billing, and shipping details are handled by Shopify under its own privacy terms; we do not store full payment card numbers.</li>
                                <li><strong>Usage data.</strong> We use analytics to understand how the site is used (for example, pages viewed and products browsed). This may include device and approximate-location signals collected through cookies or similar technologies.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">How we use information</h2>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>To respond to sample requests, quotes, and support inquiries.</li>
                                <li>To process and fulfill orders placed through checkout.</li>
                                <li>To operate, secure, and improve the website and our catalog.</li>
                                <li>To send transactional communications about your requests or orders.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">How information is shared</h2>
                            <p>
                                We share information only with service providers that help us operate the site and
                                fulfill orders — including Shopify (checkout and payments), our hosting and database
                                providers, and analytics providers — and only as needed to provide those services. We
                                do not sell your personal information. We may disclose information if required by law.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">Cookies</h2>
                            <p>
                                We use cookies and similar technologies for essential site functionality and analytics.
                                You can control cookies through your browser settings; disabling some cookies may affect
                                site functionality.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">Data retention & security</h2>
                            <p>
                                We retain information for as long as needed to fulfill the purposes described here and to
                                meet legal and accounting requirements. We use reasonable technical and organizational
                                measures to protect your information, though no method of transmission or storage is
                                completely secure.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">Your choices</h2>
                            <p>
                                You may request access to, correction of, or deletion of your personal information, and
                                you may opt out of non-transactional communications. To make a request, contact us using
                                the details below. We will respond consistent with applicable law.
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
