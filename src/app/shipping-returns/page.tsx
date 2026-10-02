import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FAQ_POLICY_ENTRIES, FAQ_POLICY_SOURCE } from "@/lib/faqPolicy";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
    title: { absolute: "Shipping & Returns | Best Bottles" },
    description: "Shipping timelines, carriers, and the return policy for Best Bottles wholesale glass packaging.",
    alternates: { canonical: `${SITE_URL}/shipping-returns` },
};

const SHIPPING_POLICY_IDS = new Set([
    "lead-times", "shipping-options", "same-day", "pickup", "international-shipping", "canada",
    "delivery-address", "signature", "returns", "refund-timing", "damaged-defective", "missing-items", "order-changes", "samples", "contact",
]);
const SHIPPING_POLICIES = FAQ_POLICY_ENTRIES.filter((entry) => SHIPPING_POLICY_IDS.has(entry.id));

export default function ShippingReturnsPage() {
    return (
        <div className="min-h-screen bg-bone">
            <Navbar />
            <main className="pt-32 pb-20 px-6">
                <div className="max-w-[760px] mx-auto">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-gold font-bold mb-4">Support</p>
                    <h1 className="font-serif text-4xl lg:text-5xl text-obsidian leading-tight mb-3">Shipping &amp; Returns</h1>
                    <p className="text-sm text-slate mb-12">FAQ source verified: {FAQ_POLICY_SOURCE.verifiedOn}</p>

                    <div className="space-y-8 text-slate leading-relaxed">
                        <p>These answers follow our <a href={FAQ_POLICY_SOURCE.url} className="text-muted-gold underline">approved FAQ</a>.</p>
                        {SHIPPING_POLICIES.map((entry) => (
                            <section key={entry.id} id={entry.id}>
                                <h2 className="font-serif text-2xl text-obsidian mb-3">{entry.q}</h2>
                                <p>{entry.a}</p>
                            </section>
                        ))}
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
