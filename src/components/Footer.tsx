"use client";

import { useCallback, useMemo, useState } from "react";
import BrandWordmark from "./BrandWordmark";
import LocaleLink from "./LocaleLink";
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
import { useCopy } from "@/i18n/useCopy";

const FOOTER_GROUPS = [
    {
        titleKey: "shop",
        links: [
            ["allBottles", "/catalog?category=Glass+Bottle"],
            ["bottleFamilies", "/catalog?sort=featured"],
            ["cylinder", "/catalog/cylinder"],
            ["closuresApplicators", "/catalog?category=Component"],
        ],
    },
    {
        titleKey: "resources",
        links: [
            ["fitmentGuide", "/resources"],
            ["buildYourBottle", "/matrix"],
            ["packagingInsights", "/blog"],
            ["shippingReturns", "/shipping-returns"],
            ["helpMeChoose", "/#find-your-bottle"],
            ["talkWithGrace", "/#find-your-bottle"],
        ],
    },
    {
        titleKey: "company",
        links: [
            ["ourStory", "/about"],
            ["contact", "/contact"],
            ["wholesaleInquiry", "/request-quote"],
        ],
    },
] as const;

const SERVICE_ITEMS = [
    { titleKey: "orderMinimum", detailKey: "orderMinimumDetail", icon: Truck },
    { titleKey: "fitmentVerified", detailKey: "fitmentVerifiedDetail", icon: ShieldCheck },
    { titleKey: "packagingGuidance", detailKey: "packagingGuidanceDetail", icon: ChatCircle },
] as const;

export default function Footer() {
    const submitForm = useMutation(api.forms.submit);
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const t = useCopy("footer");

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

    const socialLinks = useMemo(() => [
        { label: "Instagram", href: "https://www.instagram.com/nematinternational/", icon: InstagramLogo },
        { label: "Facebook", href: "https://www.facebook.com/NematInternational", icon: FacebookLogo },
        { label: "LinkedIn", href: "https://www.linkedin.com/company/nematinternational/", icon: LinkedinLogo },
    ] as const, []);

    return (
        <footer className="bg-[#0f0f10] text-bone/68 pb-[calc(2rem+var(--mobile-tab-bar-clearance))] xl:pb-8">
            <div className="border-b border-white/12">
                <div className="mx-auto grid max-w-[1440px] md:grid-cols-3">
                    {SERVICE_ITEMS.map((item) => (
                        <div key={item.titleKey} className="flex items-center gap-4 border-b border-white/12 px-5 py-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 lg:px-10">
                            <item.icon size={21} weight="light" className="shrink-0 text-muted-gold" />
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white">{t(item.titleKey)}</p>
                                <p className="mt-1 text-[10px] text-white/48">{t(item.detailKey)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-6 lg:px-10 lg:py-16">
                <div className="grid gap-12 border-b border-white/12 pb-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-8 lg:pb-16">
                    <div className="lg:col-span-3">
                        <LocaleLink href="/" aria-label={t("home")} className="inline-block transition-opacity hover:opacity-80">
                            <BrandWordmark tone="light" className="!h-[18px]" />
                        </LocaleLink>
                        <p className="mt-4 max-w-[260px] text-xs leading-relaxed text-white/58">
                            {t("tagline")}
                        </p>
                        <p className="mt-5 font-brand-display text-[11px] tracking-[0.2em] text-muted-gold">{t("beautifullyContained")}</p>
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
                        <div key={group.titleKey} className="lg:col-span-2">
                            <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white">{t(group.titleKey)}</h2>
                            <ul className="mt-5 space-y-3.5">
                                {group.links.map(([labelKey, href]) => (
                                    <li key={labelKey}>
                                        <LocaleLink href={href} className="text-xs text-white/58 transition-colors hover:text-muted-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold">
                                            {t(labelKey)}
                                        </LocaleLink>
                                    </li>
                                ))}
                                {group.titleKey === "company" && (
                                    <li>
                                        <a href="https://www.nematinternational.com" className="text-xs text-white/58 transition-colors hover:text-muted-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold">
                                            Nemat International
                                        </a>
                                    </li>
                                )}
                            </ul>
                        </div>
                    ))}

                    <div className="md:col-span-2 lg:col-span-3">
                        <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white">{t("contactNotes")}</h2>
                        <div className="mt-5 space-y-2 text-xs">
                            <a href="tel:+18009363628" className="block text-white/70 transition-colors hover:text-muted-gold">1-800-936-3628</a>
                            <a href="mailto:sales@nematinternational.com" className="block text-white/70 transition-colors hover:text-muted-gold">sales@nematinternational.com</a>
                            <p className="text-white/42">{t("hours")}</p>
                        </div>

                        <form onSubmit={handleSubscribe} className="mt-8">
                            <label htmlFor="footer-newsletter-email" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                                {t("newsletterLabel")}
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
                                    aria-label={t("emailLabel")}
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="name@company.com…"
                                    className="min-w-0 flex-1 bg-transparent px-1 py-3 text-xs text-white placeholder:text-white/32 focus:outline-none"
                                />
                                <button
                                    type="submit"
                                    disabled={status === "submitting"}
                                    aria-label={t("subscribe")}
                                    className="flex w-11 items-center justify-center text-muted-gold transition-colors hover:bg-white/6 hover:text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold"
                                >
                                    <ArrowRight size={15} />
                                </button>
                            </div>
                            <div className="mt-2 min-h-4 text-[10px] text-white/46" role="status" aria-live="polite">
                                {status === "success" && t("subscribeSuccess")}
                                {status === "error" && t("subscribeError")}
                            </div>
                        </form>
                    </div>
                </div>

                <div className="flex flex-col gap-5 pt-7 text-[10px] text-white/36 md:flex-row md:items-center md:justify-between">
                    <p>{t("copyright")}</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-3">
                        <LocaleLink href="/terms" className="transition-colors hover:text-muted-gold">{t("terms")}</LocaleLink>
                        <LocaleLink href="/privacy" className="transition-colors hover:text-muted-gold">{t("privacy")}</LocaleLink>
                        <LocaleLink href="/sitemap.xml" className="transition-colors hover:text-muted-gold">{t("sitemap")}</LocaleLink>
                    </div>
                </div>
            </div>
        </footer>
    );
}
