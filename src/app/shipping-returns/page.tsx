import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
    title: { absolute: "Shipping & Returns | Best Bottles" },
    description: "Shipping timelines, carriers, and the return policy for Best Bottles wholesale glass packaging.",
    alternates: { canonical: `${SITE_URL}/shipping-returns` },
};

const UPDATED = "July 2026";

export default function ShippingReturnsPage() {
    return (
        <div className="min-h-screen bg-bone">
            <Navbar />
            <main className="pt-32 pb-20 px-6">
                <div className="max-w-[760px] mx-auto">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-gold font-bold mb-4">Support</p>
                    <h1 className="font-serif text-4xl lg:text-5xl text-obsidian leading-tight mb-3">Shipping &amp; Returns</h1>
                    <p className="text-sm text-slate mb-12">Last updated: {UPDATED}</p>

                    <div className="space-y-8 text-slate leading-relaxed">
                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">Shipping</h2>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Orders ship from our Union City, California warehouse. In-stock items typically ship within 1&ndash;3 business days.</li>
                                <li>We ship via major carriers. Available shipping options, rates, and any free-shipping thresholds are shown at checkout based on your order and destination.</li>
                                <li>Domestic and international shipping are available; international transit times and any duties or taxes vary by destination and are the recipient&apos;s responsibility.</li>
                                <li>Because glass is fragile, orders are packed to protect against transit damage. Please inspect your shipment on arrival.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">Damaged or incorrect items</h2>
                            <p>
                                If your order arrives damaged, or if you receive the wrong item, contact us within 7 days
                                of delivery with your order number and photos of the packaging and product. We will
                                arrange a replacement or credit for verified damage or fulfillment errors.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">Returns</h2>
                            <p>
                                To request a return of unused, undamaged product in its original packaging, contact us
                                within 30 days of delivery for a return authorization. Return shipping and any applicable
                                restocking fee are the customer&apos;s responsibility unless the return is due to our error.
                                Custom, decorated, and clearance items are not returnable.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">Samples</h2>
                            <p>
                                We encourage ordering samples before a full wholesale order. Request samples through our{" "}
                                <a href="/request-sample" className="text-muted-gold hover:underline">sample request form</a>.
                            </p>
                        </section>

                        <section>
                            <h2 className="font-serif text-2xl text-obsidian mb-3">Questions</h2>
                            <p>
                                Contact our team at{" "}
                                <a href="mailto:sales@nematinternational.com" className="text-muted-gold hover:underline">sales@nematinternational.com</a>{" "}
                                or <a href="tel:+18009363628" className="text-muted-gold hover:underline">1-800-936-3628</a>.
                            </p>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
