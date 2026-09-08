"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import {
    ArrowRight,
    ChatCircle,
    EnvelopeSimple,
    FacebookLogo,
    InstagramLogo,
    LinkedinLogo,
    ShieldCheck,
    Truck,
} from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";

const FOOTER_GROUPS = [
    {
        title: "Shop",
        links: [
            ["All Bottles", "/catalog?category=Glass+Bottle"],
            ["Bottle Families", "/catalog?sort=featured"],
            ["Cylinder", "/catalog/cylinder"],
            ["Closures & Applicators", "/catalog?category=Component"],
            ["Request a Quote", "/request-quote"],
        ],
    },
    {
        title: "Resources",
        links: [
            ["Fitment Guide", "/resources"],
            ["Build Your Bottle", "/matrix"],
            ["Packaging Insights", "/blog"],
            ["Shipping & Returns", "/shipping-returns"],
            ["Help Me Choose", "/#find-your-bottle"],
            ["Talk with Grace", "/#find-your-bottle"],
        ],
    },
    {
        title: "Company",
        links: [
            ["Our Story", "/about"],
            ["Nemat International", "https://www.nematinternational.com"],
            ["Contact", "/contact"],
            ["Wholesale Inquiry", "/request-quote"],
        ],
    },
] as const;

const SERVICE_ITEMS = [
    { title: "Free Shipping Over $99", detail: "Across eligible U.S. orders", icon: Truck },
    { title: "Fitment Verified", detail: "Compatibility checked", icon: ShieldCheck },
    { title: "Packaging Guidance", detail: "Ask Grace without leaving the page", icon: ChatCircle },
] as const;

export default function Footer() {
    const submitForm = useMutation(api.forms.submit);
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

    const handleSubscribe = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!email.trim() || status === "submitting") return;
        setStatus("submitting");
        try {
            await submitForm({
                formType: "newsletter",
                email: email.trim(),
                source: "Global Footer Newsletter",
            });
            setEmail("");
            setStatus("success");
        } catch {
            setStatus("error");
        }
    }, [email, status, submitForm]);

    const socialLinks = [
        { label: "Instagram", href: "https://www.instagram.com/nematinternational/", icon: InstagramLogo },
        { label: "Facebook", href: "https://www.facebook.com/NematInternational", icon: FacebookLogo },
        { label: "LinkedIn", href: "https://www.linkedin.com/company/nematinternational/", icon: LinkedinLogo },
    ] as const;

    return (
        <footer className="bg-obsidian text-bone/68 pb-[calc(2rem+var(--mobile-tab-bar-clearance))] xl:pb-8">
            <div className="border-b border-white/12">
                <div className="mx-auto grid max-w-[1440px] md:grid-cols-3">
                    {SERVICE_ITEMS.map((item) => (
                        <div key={item.title} className="flex items-center gap-4 border-b border-white/12 px-5 py-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 lg:px-10">
                            <item.icon size={21} weight="light" className="shrink-0 text-muted-gold" />
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white">{item.title}</p>
                                <p className="mt-1 text-[10px] text-white/48">{item.detail}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-6 lg:px-10 lg:py-16">
                <div className="grid gap-12 border-b border-white/12 pb-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-8 lg:pb-16">
                    <div className="lg:col-span-3">
                        <Link href="/" className="font-cormorant text-[28px] font-semibold tracking-tight text-white transition-colors hover:text-muted-gold">
                            BEST BOTTLES
                        </Link>
                        <p className="mt-4 max-w-[260px] text-xs leading-relaxed text-white/58">
                            Premium glass bottles and closures for beauty, fragrance, and wellness brands.
                        </p>
                        <p className="mt-5 font-display text-lg text-muted-gold">Beautifully Contained.</p>
                        <div className="mt-7 flex gap-2">
                            {socialLinks.map((social) => (
                                <a
                                    key={social.label}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={social.label}
                                    className="flex h-9 w-9 items-center justify-center border border-white/18 text-white/70 transition-colors hover:border-muted-gold hover:text-muted-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold"
                                >
                                    <social.icon size={15} weight="regular" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {FOOTER_GROUPS.map((group) => (
                        <div key={group.title} className="lg:col-span-2">
                            <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white">{group.title}</h2>
                            <ul className="mt-5 space-y-3.5">
                                {group.links.map(([label, href]) => (
                                    <li key={label}>
                                        <Link href={href} className="text-xs text-white/58 transition-colors hover:text-muted-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold">
                                            {label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    <div className="md:col-span-2 lg:col-span-3">
                        <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white">Contact & Notes</h2>
                        <div className="mt-5 space-y-2 text-xs">
                            <a href="tel:+18009363628" className="block text-white/70 transition-colors hover:text-muted-gold">1-800-936-3628</a>
                            <a href="mailto:sales@nematinternational.com" className="block text-white/70 transition-colors hover:text-muted-gold">sales@nematinternational.com</a>
                            <p className="text-white/42">Mon–Fri, 8am–5pm PT</p>
                        </div>

                        <form onSubmit={handleSubscribe} className="mt-8">
                            <label htmlFor="footer-newsletter-email" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                                Packaging notes by email
                            </label>
                            <div className="mt-3 flex border border-white/22 focus-within:border-muted-gold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-muted-gold/40">
                                <span className="flex w-10 items-center justify-center text-white/45" aria-hidden>
                                    <EnvelopeSimple size={15} />
                                </span>
                                <input
                                    id="footer-newsletter-email"
                                    name="email"
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    spellCheck={false}
                                    required
                                    aria-label="Email address"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="name@company.com…"
                                    className="min-w-0 flex-1 bg-transparent px-1 py-3 text-xs text-white placeholder:text-white/32 focus:outline-none"
                                />
                                <button
                                    type="submit"
                                    disabled={status === "submitting"}
                                    aria-label="Subscribe to packaging notes"
                                    className="flex w-11 items-center justify-center text-muted-gold transition-colors hover:bg-white/6 hover:text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold"
                                >
                                    <ArrowRight size={15} />
                                </button>
                            </div>
                            <div className="mt-2 min-h-4 text-[10px] text-white/46" role="status" aria-live="polite">
                                {status === "success" && "You’re on the list."}
                                {status === "error" && "We couldn’t subscribe you. Please try again."}
                            </div>
                        </form>
                    </div>
                </div>

                <div className="flex flex-col gap-5 pt-7 text-[10px] text-white/36 md:flex-row md:items-center md:justify-between">
                    <p>© 2026 Best Bottles, a division of Nemat International.</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-3">
                        <Link href="/terms" className="transition-colors hover:text-muted-gold">Terms</Link>
                        <Link href="/privacy" className="transition-colors hover:text-muted-gold">Privacy</Link>
                        <Link href="/sitemap.xml" className="transition-colors hover:text-muted-gold">Sitemap</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
