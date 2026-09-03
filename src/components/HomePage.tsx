"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
    ArrowRight, Lightning, ShoppingBag, MagnifyingGlass, Compass, CaretRight, Check, ShieldCheck, ChatCircle,
    Flower, Drop, SprayBottle, Gift, Flask, Sparkle,
} from "@/components/icons";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useGrace } from "@/components/useGrace";
import { urlFor } from "@/sanity/lib/image";
import type { HomepageData } from "@/sanity/lib/queries";
import { APPLICATOR_NAV, applicatorNavHref } from "@/lib/catalogFilters";
import type { ApplicatorNavValue } from "@/lib/catalogFilters";
import {
    HOME_ACCESSORY_STORY,
    HOME_APPLICATION_LINKS,
    HOME_EDITORIAL_STORIES,
    HOME_FAMILY_MOSAIC,
    HOME_SAMPLE_FEATURE,
    homepageFamilyHref,
} from "@/lib/homepageMerchandising";

const FadeUp = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => (
    <motion.div
        initial={false}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay }}
        className={className}
    >
        {children}
    </motion.div>
);

const DEFAULT_ARTICLES = [
    { title: "Glass vs. Plastic: Why Material Matters for Your Brand", category: "Materials", excerpt: "Compare material choices for fragrance, beauty, and wellness packaging so your bottle supports the product and the brand promise.", img: "/assets/Slim-BB.png", slug: "/blog" },
    { title: "Finding Your Thread: A Complete Neck Size Compatibility Guide", category: "Technical", excerpt: "Understand neck finishes, thread sizes, and fitment language before pairing bottles with caps, droppers, rollers, or sprayers.", img: "/assets/Assorted Closers.png", slug: "/blog" },
    { title: "From Etsy to Retail: Scaling Your Packaging Strategy", category: "Growth", excerpt: "Plan the packaging shift from small-batch sales to retail-ready quantities, consistency, and reorder confidence.", img: "/assets/collection_amber.png", slug: "/blog" },
];

function fallbackArticleExcerpt(title: string, category: string) {
    const match = DEFAULT_ARTICLES.find((article) => article.title === title);
    if (match) return match.excerpt;
    return `${category} guidance for choosing packaging with more confidence.`;
}

const CATEGORY_LABELS: Record<string, string> = {
    "packaging-101": "Packaging 101",
    "fragrance-guides": "Fragrance Guides",
    "brand-stories": "Brand Stories",
    "ingredient-science": "Ingredient Science",
    "how-to": "How-To",
    "industry-news": "Industry News",
};

type HeroSlide = NonNullable<HomepageData["heroSlides"]>[number];

const DEFAULT_HERO_SLIDE: Partial<HeroSlide> & { eyebrow: string; headline: string; subheadline: string; ctaText: string; ctaHref: string } = {
    eyebrow: "A Division of Nemat International",
    headline: "Beautifully Contained",
    subheadline: "Premium glass bottles and packaging for brands ready to scale.",
    ctaText: "Browse Catalog",
    ctaHref: "/catalog",
};

function Hero({ heroSlides, mobileHeroMode }: { heroSlides?: HomepageData["heroSlides"]; mobileHeroMode?: "categories" | "hero" }) {
    // Default to hero on mobile when not explicitly set to "categories"
    const showOnMobile = mobileHeroMode !== "categories";
    const slides: HeroSlide[] = heroSlides?.length ? heroSlides : [{ ...DEFAULT_HERO_SLIDE } as HeroSlide];
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [isMobile, setIsMobile] = React.useState(false);
    const slide = slides[currentIndex];
    const isMultiSlide = slides.length > 1;

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 1023px)");
        const handler = () => setIsMobile(mq.matches);
        handler();
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    React.useEffect(() => {
        if (!isMultiSlide) return;
        const t = setInterval(() => setCurrentIndex((i) => (i + 1) % slides.length), 6000);
        return () => clearInterval(t);
    }, [isMultiSlide, slides.length]);

    const mediaType = slide?.mediaType ?? "image";
    const videoUrl = isMobile && slide?.mobileVideo?.asset?.url
        ? slide.mobileVideo.asset.url
        : slide?.video?.asset?.url;
    const imageUrl = isMobile && slide?.mobileImage
        ? urlFor(slide.mobileImage)
        : slide?.image
            ? urlFor(slide.image)
            : "";
    const posterUrl = isMobile && slide?.mobileVideoPoster
        ? urlFor(slide.mobileVideoPoster)
        : slide?.videoPoster
            ? urlFor(slide.videoPoster)
            : imageUrl || "/assets/Hero-BB.png";
    const showVideo = mediaType === "video" && videoUrl;

    return (
        <section className={`${showOnMobile ? "flex" : "hidden lg:flex"} relative h-[78dvh] min-h-[620px] max-h-[700px] w-full items-end overflow-hidden bg-bone pb-12 pt-[96px] lg:h-[100dvh] lg:min-h-0 lg:max-h-none lg:items-center lg:pb-0 lg:pt-[120px]`}>
            <div className="absolute inset-0 z-0 bg-travertine">
                {isMultiSlide ? (
                    slides.map((s, i) => {
                        const img = isMobile && s?.mobileImage
                            ? urlFor(s.mobileImage)
                            : s?.image
                                ? urlFor(s.image)
                                : "";
                        const vidUrl = isMobile && s?.mobileVideo?.asset?.url
                            ? s.mobileVideo.asset.url
                            : s?.video?.asset?.url;
                        const vidPoster = isMobile && s?.mobileVideoPoster
                            ? urlFor(s.mobileVideoPoster)
                            : s?.videoPoster
                                ? urlFor(s.videoPoster)
                                : img;
                        const isVideo = s?.mediaType === "video" && vidUrl;
                        return (
                            <div
                                key={i}
                                className={`absolute inset-0 transition-opacity duration-700 ${i === currentIndex ? "opacity-100 z-0" : "opacity-0 z-0 pointer-events-none"}`}
                            >
                                {isVideo && vidUrl ? (
                                    <video src={vidUrl} poster={vidPoster || "/assets/Hero-BB.png"} autoPlay muted loop playsInline className="w-full h-full object-cover object-[80%_78%] md:object-[70%_center]" />
                                ) : (
                                    <Image src={img || "/assets/Hero-BB.png"} alt="" fill className="object-cover object-[80%_78%] md:object-[70%_center]" unoptimized={!!img} />
                                )}
                            </div>
                        );
                    })
                ) : (
                    <motion.div initial={{ scale: 1.05 }} animate={{ scale: 1 }} transition={{ duration: 8, ease: "easeOut" }} className="relative w-full h-full">
                        {showVideo ? (
                            <video src={videoUrl} poster={posterUrl || undefined} autoPlay muted loop playsInline className="w-full h-full object-cover object-[80%_78%] md:object-[70%_center]" />
                        ) : (
                            <Image src={imageUrl || "/assets/Hero-BB.png"} alt="Luxury perfume glass atomizer bottle" fill className="object-cover object-[80%_78%] md:object-[70%_center]" priority unoptimized={!!imageUrl} />
                        )}
                    </motion.div>
                )}
                <div className="absolute inset-0 z-[1] bg-gradient-to-r from-obsidian/75 via-obsidian/40 to-transparent md:from-obsidian/55 md:via-obsidian/25" />
            </div>

            {isMultiSlide && (
                <>
                    <button
                        onClick={() => setCurrentIndex((i) => (i - 1 + slides.length) % slides.length)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors"
                        aria-label="Previous slide"
                    >
                        <ArrowRight className="rotate-180" size={20} />
                    </button>
                    <button
                        onClick={() => setCurrentIndex((i) => (i + 1) % slides.length)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors"
                        aria-label="Next slide"
                    >
                        <ArrowRight size={20} />
                    </button>
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                        {slides.map((_, i) => (
                            <button key={i} onClick={() => setCurrentIndex(i)} className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? "bg-white" : "bg-white/50"}`} aria-label={`Go to slide ${i + 1}`} />
                        ))}
                    </div>
                </>
            )}

            <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-16 relative z-10 pt-4 lg:pt-0 pb-0 lg:pb-0 mb-0">
                <div className="max-w-[360px] sm:max-w-[600px]">
                    <FadeUp delay={0.2}>
                        {(() => {
                            const eyebrow = slide?.eyebrow ?? DEFAULT_HERO_SLIDE.eyebrow;
                            const hasOf = eyebrow?.includes(" of ");
                            const parts = hasOf && eyebrow
                                ? [eyebrow.split(" of ")[0]?.trim() ?? "", eyebrow.split(" of ")[1]?.trim() ?? ""]
                                : null;
                            return (
                                <div className="text-[9px] sm:text-xs uppercase tracking-[0.25em] text-white/90 font-bold mb-3 sm:mb-6 drop-shadow-sm space-y-1">
                                    {parts ? (
                                        <>
                                            {parts[0] && <p className="leading-tight">{parts[0]} OF</p>}
                                            {parts[1] && <p className="leading-tight">{parts[1]}</p>}
                                        </>
                                    ) : (
                                        <p className="leading-tight">{eyebrow}</p>
                                    )}
                                </div>
                            );
                        })()}
                    </FadeUp>
                    <FadeUp delay={0.3}>
                        <h1 className="font-display text-[48px] sm:text-[56px] lg:text-[87px] font-medium text-white leading-[0.98] sm:leading-[1.05] mb-5 sm:mb-8 drop-shadow-sm">
                            {(() => {
                                const headline = slide?.headline ?? DEFAULT_HERO_SLIDE.headline;
                                const spaceIdx = headline.indexOf(" ");
                                if (spaceIdx === -1) return headline;
                                return (
                                    <>
                                        <span className="block leading-tight">{headline.slice(0, spaceIdx)}</span>
                                        <span className="block leading-tight">{headline.slice(spaceIdx + 1)}</span>
                                    </>
                                );
                            })()}
                        </h1>
                    </FadeUp>
                    <FadeUp delay={0.4}>
                        {(() => {
                            const sub = slide?.subheadline ?? DEFAULT_HERO_SLIDE.subheadline;
                            const toTitleCase = (s: string) =>
                                s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\b(for|to|and)\b/gi, (m) => m.toLowerCase());
                            const parts = sub?.includes(" and ")
                                ? [sub.split(" and ")[0]?.trim() ?? "", sub.split(" and ")[1]?.trim().replace(/\.$/, "") ?? ""]
                                : null;
                            return (
                                <div className="text-[15px] sm:text-lg lg:text-xl text-white/90 leading-[1.45] sm:leading-[1.6] max-w-[330px] sm:max-w-[480px] mb-7 sm:mb-12 space-y-1">
                                    {parts ? (
                                        <>
                                            {parts[0] && <p className="leading-snug">{toTitleCase(parts[0])}</p>}
                                            {parts[1] && <p className="leading-snug">{toTitleCase(parts[1])}</p>}
                                        </>
                                    ) : (
                                        <p className="leading-snug">{sub}</p>
                                    )}
                                </div>
                            );
                        })()}
                    </FadeUp>
                    <FadeUp delay={0.5} className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-8">
                        <Link href={slide?.ctaHref || DEFAULT_HERO_SLIDE.ctaHref} className="w-[190px] sm:w-auto px-7 sm:px-8 py-3.5 sm:py-4 bg-white/75 sm:bg-white text-obsidian uppercase text-[13px] sm:text-sm font-semibold tracking-wider hover:bg-bone transition-colors duration-300 shadow-md text-center whitespace-nowrap">
                            {(slide?.ctaText === "Explore Collections" ? "Browse Catalog" : slide?.ctaText) || DEFAULT_HERO_SLIDE.ctaText}
                        </Link>
                    </FadeUp>
                </div>
            </div>
        </section>
    );
}

function MobilePostHeroSearch() {
    const router = useRouter();
    const [searchValue, setSearchValue] = useState("");

    const handleSubmit = useCallback((event: React.FormEvent) => {
        event.preventDefault();
        const query = searchValue.trim();
        router.push(query ? `/catalog?search=${encodeURIComponent(query)}` : "/catalog");
    }, [router, searchValue]);

    return (
        <section id="mobile-home-search" className="border-b border-champagne/55 bg-warm-white px-5 py-5 xl:hidden">
            <form onSubmit={handleSubmit} className="mx-auto flex max-w-xl items-center border border-champagne bg-white focus-within:border-muted-gold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-muted-gold/25">
                <MagnifyingGlass className="ml-4 shrink-0 text-slate" size={17} />
                <input
                    type="search"
                    name="search"
                    autoComplete="search"
                    enterKeyHint="search"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Search bottles, closures, families…"
                    aria-label="Search products"
                    className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-sm text-obsidian placeholder:text-slate/55 focus:outline-none"
                />
                <button type="submit" aria-label="Submit product search" className="flex h-12 w-12 shrink-0 items-center justify-center text-muted-gold transition-colors hover:bg-linen hover:text-obsidian focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold">
                    <ArrowRight size={16} />
                </button>
            </form>
        </section>
    );
}

/* ─── Mobile Category Grid: replaces Hero on mobile ─── */

const DEFAULT_MOBILE_CATEGORIES = [
    { label: "Roll-On Bottles", href: applicatorNavHref("rollon"), img: "/assets/vintage-spray.png" },
    { label: "Spray Bottles", href: applicatorNavHref("spray"), img: "/assets/Cylinder-BB.png" },
    { label: "Dropper Bottles", href: applicatorNavHref("dropper"), img: "/assets/collection_amber.png" },
    { label: "Lotion Pumps", href: applicatorNavHref("lotionpump"), img: "/assets/collection_amber.png" },
    { label: "Reducer Bottles", href: applicatorNavHref("reducer"), img: "/references/9ml/clear.jpg" },
    { label: "Shop All 2,300+", href: "/catalog", img: "/assets/Hero-BB.png" },
];

function MobileCategoryGrid({ data }: { data?: HomepageData | null }) {
    // Only show category grid when Sanity explicitly sets "categories"; otherwise hero shows on mobile
    if (data?.mobileHeroMode !== "categories") return null;

    const tagline = data?.mobileTagline ?? "Premium glass packaging for beauty & wellness brands.";
    const sectionLabel = data?.mobileSectionLabel ?? "Shop by Application";

    const cards = data?.mobileCategoryCards?.length
        ? data.mobileCategoryCards.map((c) => ({
            label: c.label,
            href: c.href,
            img: c.image ? urlFor(c.image) : "",
        }))
        : DEFAULT_MOBILE_CATEGORIES;

    return (
        <section className="lg:hidden bg-bone">
            {/* Tagline */}
            <div className="px-5 pt-4 pb-3 text-center">
                <p className="font-serif text-sm text-slate leading-relaxed">{tagline}</p>
            </div>

            {/* Section label */}
            <div className="px-5 pb-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-gold font-bold">{sectionLabel}</p>
            </div>

            {/* 2-column grid */}
            <div className="grid grid-cols-2 gap-3 px-4 pb-5">
                {cards.map((card, i) => {
                    const imgSrc = card.img || DEFAULT_MOBILE_CATEGORIES[i % DEFAULT_MOBILE_CATEGORIES.length]?.img || "/assets/Hero-BB.png";
                    return (
                        <Link key={card.label + i} href={card.href} className="group relative aspect-[4/5] overflow-hidden rounded-sm bg-travertine">
                            <Image
                                src={imgSrc}
                                alt={card.label}
                                fill
                                className="object-cover object-center group-active:scale-105 transition-transform duration-300"
                                unoptimized={imgSrc.startsWith("http")}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-obsidian/60 via-obsidian/15 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-3">
                                <h3 className="font-serif text-[15px] text-white leading-tight">{card.label}</h3>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}

function TrustBar() {
    const stats = useQuery(api.products.getHomepageStats);
    // Use live count when reasonable; cap at 2,300+ to reflect true catalog (2,310 variants)
    const raw = stats?.totalProducts ?? 0;
    const productCount = raw > 0 && raw <= 2500
        ? `${(Math.floor(raw / 100) * 100).toLocaleString()}+`
        : "2,300+";

    const items = [
        { stat: "$50 Order Minimum", statMobile: "$50 Order Min", label: "Order what you need", icon: Lightning },
        { stat: `${productCount} Products`, label: "Premium bottles & closures", icon: ShoppingBag },
        { stat: "Fitment Verified", label: "Guaranteed compatibility", icon: ShieldCheck },
    ];

    return (
        <section className="hidden sm:block bg-linen border-y border-champagne/50 py-6 sm:py-8 relative z-20 min-h-[112px] mt-0 mb-0">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
                <div className="grid grid-cols-3 gap-4 sm:gap-6 divide-x divide-champagne/60">
                    {items.map((item, i) => (
                        <FadeUp key={i} delay={0.2 + i * 0.1} className="flex flex-col sm:flex-row sm:items-center items-center text-center sm:text-left gap-2 sm:gap-4 sm:pl-6 first:sm:pl-0">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-bone flex items-center justify-center shrink-0 border border-champagne/30">
                                <item.icon className="text-muted-gold" size={20} weight="regular" />
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-serif text-sm sm:text-lg text-obsidian font-medium leading-tight">
                                    <span className="sm:hidden">{"statMobile" in item ? item.statMobile : item.stat}</span>
                                    <span className="hidden sm:inline">{item.stat}</span>
                                </h4>
                                <p className="hidden sm:block text-[11px] sm:text-xs text-slate mt-0.5 leading-snug">{item.label}</p>
                            </div>
                        </FadeUp>
                    ))}
                </div>
            </div>
        </section>
    );
}

const APPLICATOR_ICONS: Record<string, React.ReactNode> = {
    rollon: (
        <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="1.5">
            <ellipse cx="20" cy="10" rx="7" ry="4" />
            <rect x="13" y="10" width="14" height="22" rx="2" />
            <ellipse cx="20" cy="32" rx="7" ry="4" />
            <circle cx="20" cy="10" r="3" fill="currentColor" stroke="none" opacity="0.4" />
        </svg>
    ),
    spray: (
        <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="1.5">
            <rect x="11" y="14" width="13" height="20" rx="2" />
            <path d="M24 20h4M28 20l-3-3M28 20l-3 3" />
            <rect x="14" y="8" width="7" height="6" rx="1" />
            <path d="M24 12h3a1 1 0 011 1v7" />
        </svg>
    ),
    reducer: (
        <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="1.5">
            <rect x="11" y="12" width="18" height="22" rx="2" />
            <rect x="14" y="7" width="12" height="5" rx="1" />
            <path d="M18 9h4" strokeWidth="2" />
            <path d="M20 34v3M17 37h6" />
        </svg>
    ),
    lotionpump: (
        <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="1.5">
            <rect x="13" y="16" width="14" height="18" rx="2" />
            <path d="M20 16V8M16 8h8" />
            <path d="M20 8c0 0-4-3-4-5" />
            <rect x="16" y="12" width="8" height="4" rx="1" />
        </svg>
    ),
    dropper: (
        <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="1.5">
            <rect x="14" y="10" width="12" height="20" rx="3" />
            <rect x="16" y="6" width="8" height="4" rx="1" />
            <path d="M20 30v6" />
            <path d="M18 36c0 0 2 2 4 0" />
        </svg>
    ),
};

/* ─── Guided Selector: 3-step funnel (Use Case → Dispenser → Size) ─── */

const USE_CASE_ICONS = { Flower, Drop, SprayBottle, Gift, Flask, Sparkle } as const;

const USE_CASES: Array<{ id: string; label: string; subtitle: string; iconKey: keyof typeof USE_CASE_ICONS; applicators: ApplicatorNavValue[] }> = [
    { id: "fragrance", label: "Fragrance & Perfume", subtitle: "Spray, rollerball, and splash formats", iconKey: "Flower", applicators: ["spray", "rollon", "reducer"] },
    { id: "essentials", label: "Essential Oils", subtitle: "Roll-on and dropper bottles for oils", iconKey: "Drop", applicators: ["rollon", "dropper"] },
    { id: "skincare", label: "Skincare & Serums", subtitle: "Dropper and pump formats", iconKey: "SprayBottle", applicators: ["dropper", "lotionpump"] },
    { id: "gift", label: "Gift & Retail", subtitle: "Presentation-ready packaging", iconKey: "Gift", applicators: ["spray", "rollon", "dropper", "lotionpump", "reducer"] },
    { id: "samples", label: "Samples & Travel", subtitle: "Vials and compact formats", iconKey: "Flask", applicators: ["spray", "rollon", "dropper"] },
    { id: "other", label: "Something Else", subtitle: "Browse the full catalog", iconKey: "Sparkle", applicators: [] },
];

// Derive DISPENSERS from the shared APPLICATOR_NAV config (single source of truth)
const DISPENSERS = APPLICATOR_NAV.map((nav) => ({
    value: nav.value,
    label: nav.label,
    subtitle: nav.subtitle,
}));

const SIZE_RANGES = [
    { label: "Miniature", subtitle: "1–5 ml (0.03–0.17 oz)", params: "capacities=1+ml&capacities=2+ml&capacities=3+ml&capacities=3.7+ml&capacities=4+ml&capacities=5+ml" },
    { label: "Small", subtitle: "6–15 ml (0.20–0.51 oz)", params: "capacities=6+ml&capacities=8+ml&capacities=9+ml&capacities=10+ml&capacities=12+ml&capacities=13+ml&capacities=14+ml&capacities=15+ml" },
    { label: "Medium", subtitle: "20–50 ml (0.68–1.69 oz)", params: "capacities=20+ml&capacities=25+ml&capacities=28+ml&capacities=30+ml&capacities=50+ml" },
    { label: "Large", subtitle: "55–120 ml (1.86–4.06 oz)", params: "capacities=55+ml&capacities=60+ml&capacities=75+ml&capacities=78+ml&capacities=100+ml&capacities=120+ml" },
    { label: "Any Size", subtitle: "Show all", params: "" },
];

function GuidedSelector({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [useCase, setUseCase] = useState<string | null>(null);
    const [applicator, setApplicator] = useState<string | null>(null);

    const selectedUseCase = USE_CASES.find((u) => u.id === useCase);
    const availableDispensers = selectedUseCase?.applicators.length
        ? DISPENSERS.filter((d) => selectedUseCase.applicators.includes(d.value))
        : DISPENSERS;

    const handleUseCaseSelect = useCallback((id: string) => {
        setUseCase(id);
        if (id === "other") {
            router.push("/catalog");
            onClose();
            return;
        }
        setStep(2);
    }, [router, onClose]);

    const handleDispenserSelect = useCallback((value: string) => {
        setApplicator(value);
        setStep(3);
    }, []);

    const handleSizeSelect = useCallback((sizeParams: string) => {
        // Resolve nav-level applicator to actual bucket values via shared config
        const nav = applicator ? APPLICATOR_NAV.find((n) => n.value === applicator) : null;
        const params = new URLSearchParams();
        if (nav) params.set("applicators", nav.buckets.join(","));
        if (sizeParams) params.set("sort", "capacity-asc");
        const url = `/catalog?${params.toString()}${sizeParams ? `&${sizeParams}` : ""}`;
        router.push(url);
        onClose();
    }, [applicator, router, onClose]);

    const stepLabels = ["Use Case", "Dispenser", "Size"];

    return (
        <section className="bg-white border-y border-champagne/40">
            <div className="max-w-[1440px] mx-auto px-6 py-12 lg:py-16">
                {/* Step indicator */}
                <div className="flex items-center justify-center mb-10 gap-2">
                    {stepLabels.map((label, i) => {
                        const stepNum = i + 1;
                        const isActive = step === stepNum;
                        const isDone = step > stepNum;
                        return (
                            <React.Fragment key={label}>
                                {i > 0 && <CaretRight className="w-4 h-4 text-champagne mx-1" size={16} />}
                                <button
                                    onClick={() => { if (isDone) setStep(stepNum); }}
                                    disabled={!isDone}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${isActive ? "bg-obsidian text-white" : isDone ? "bg-muted-gold/10 text-muted-gold cursor-pointer hover:bg-muted-gold/20" : "bg-travertine text-slate/50"
                                        }`}
                                >
                                    {isDone ? <Check size={14} weight="bold" /> : <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-xs">{stepNum}</span>}
                                    {label}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Step 1: Use Case */}
                {step === 1 && (
                    <FadeUp>
                        <div className="text-center mb-8">
                            <h2 className="font-serif text-3xl lg:text-4xl text-obsidian font-medium">What are you packaging?</h2>
                            <p className="text-slate text-sm mt-2">Pick the closest match — we&apos;ll narrow the catalog for you.</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                            {USE_CASES.map((uc) => (
                                <button
                                    key={uc.id}
                                    onClick={() => handleUseCaseSelect(uc.id)}
                                    className="group flex flex-col items-center text-center p-6 bg-bone border border-champagne/50 rounded-sm hover:border-muted-gold hover:shadow-md transition-all duration-300"
                                >
                                    <span className="mb-3 text-muted-gold">
                                        {React.createElement(USE_CASE_ICONS[uc.iconKey], { size: 32, weight: "regular" })}
                                    </span>
                                    <h3 className="font-serif text-lg text-obsidian font-medium mb-1 leading-snug">{uc.label}</h3>
                                    <p className="text-xs text-slate leading-relaxed">{uc.subtitle}</p>
                                </button>
                            ))}
                        </div>
                    </FadeUp>
                )}

                {/* Step 2: Dispenser */}
                {step === 2 && (
                    <FadeUp>
                        <div className="text-center mb-8">
                            <h2 className="font-serif text-3xl lg:text-4xl text-obsidian font-medium">How should it dispense?</h2>
                            <p className="text-slate text-sm mt-2">Choose a dispensing method for your {selectedUseCase?.label.toLowerCase()} products.</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-4xl mx-auto">
                            {availableDispensers.map((d) => (
                                <button
                                    key={d.value}
                                    onClick={() => handleDispenserSelect(d.value)}
                                    className="group flex flex-col h-full bg-bone border border-champagne/50 rounded-sm p-6 hover:border-muted-gold hover:shadow-md transition-all duration-300"
                                >
                                    <div className="text-obsidian/40 group-hover:text-muted-gold transition-colors duration-300 mb-4">
                                        {APPLICATOR_ICONS[d.value]}
                                    </div>
                                    <h3 className="font-serif text-lg text-obsidian font-medium mb-1 leading-snug">{d.label}</h3>
                                    <p className="text-xs text-slate leading-relaxed">{d.subtitle}</p>
                                </button>
                            ))}
                        </div>
                    </FadeUp>
                )}

                {/* Step 3: Size */}
                {step === 3 && (
                    <FadeUp>
                        <div className="text-center mb-8">
                            <h2 className="font-serif text-3xl lg:text-4xl text-obsidian font-medium">What size?</h2>
                            <p className="text-slate text-sm mt-2">Pick a size range — you can always refine in the catalog.</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4 max-w-3xl mx-auto">
                            {SIZE_RANGES.map((s) => (
                                <button
                                    key={s.label}
                                    onClick={() => handleSizeSelect(s.params)}
                                    className="group flex flex-col items-center p-6 bg-bone border border-champagne/50 rounded-sm hover:border-muted-gold hover:shadow-md transition-all duration-300 w-[140px]"
                                >
                                    <h3 className="font-serif text-lg text-obsidian font-medium mb-1">{s.label}</h3>
                                    <p className="text-xs text-slate">{s.subtitle}</p>
                                </button>
                            ))}
                        </div>
                    </FadeUp>
                )}

                {/* Close / Skip */}
                <div className="text-center mt-8">
                    <button onClick={onClose} className="text-xs text-slate hover:text-obsidian transition-colors uppercase tracking-wider">
                        Skip — browse the full catalog
                    </button>
                </div>
            </div>
        </section>
    );
}

/* ─── PathChooser: 3 clear entry paths ─── */

function PathChooser() {
    const { open: openGrace } = useGrace();
    const router = useRouter();
    const [showGuided, setShowGuided] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    const handleSearchSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (searchValue.trim()) {
            router.push(`/catalog?search=${encodeURIComponent(searchValue.trim())}`);
        }
    }, [searchValue, router]);

    if (showGuided) {
        return <GuidedSelector onClose={() => setShowGuided(false)} />;
    }

    return (
        <section id="find-your-bottle" className="bg-linen py-14 lg:py-20">
            <div className="mx-auto max-w-[1440px] px-5 sm:px-6 lg:px-10">
                <FadeUp className="grid border border-champagne/60 bg-warm-white lg:grid-cols-2">
                    <div className="border-b border-champagne/60 p-7 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate">Know What You Need?</p>
                        <h2 className="font-display text-[34px] font-medium leading-none text-obsidian lg:text-[42px]">Search the catalog</h2>
                        <p className="mt-4 max-w-md text-sm leading-relaxed text-slate">Find bottles, closures, and packaging by name, SKU, size, or color.</p>
                        <form onSubmit={handleSearchSubmit} className="mt-8 max-w-lg">
                            <label htmlFor="homepage-catalog-search" className="sr-only">Search the Best Bottles catalog</label>
                            <div className="flex border border-obsidian/20 bg-white focus-within:border-muted-gold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-muted-gold/30">
                                <input
                                    id="homepage-catalog-search"
                                    type="search"
                                    name="search"
                                    autoComplete="off"
                                    value={searchValue}
                                    onChange={(event) => setSearchValue(event.target.value)}
                                    placeholder="e.g. 9 ml clear cylinder…"
                                    className="min-w-0 flex-1 bg-transparent px-4 py-4 text-sm text-obsidian placeholder:text-slate/55 focus:outline-none"
                                />
                                <button type="submit" className="flex w-14 items-center justify-center bg-obsidian text-white transition-colors hover:bg-muted-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold" aria-label="Search products">
                                    <MagnifyingGlass size={18} />
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="grid grid-rows-2">
                        <button
                            type="button"
                            onClick={() => setShowGuided(true)}
                            className="group grid grid-cols-[auto_1fr_auto] items-center gap-5 border-b border-champagne/60 p-7 text-left transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold sm:p-9 lg:p-10"
                        >
                            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-champagne text-slate group-hover:border-muted-gold group-hover:text-obsidian">
                                <Compass size={20} />
                            </span>
                            <span>
                                <span className="block font-display text-2xl text-obsidian">Help me choose</span>
                                <span className="mt-1 block text-xs leading-relaxed text-slate">3 quick questions to narrow the catalog.</span>
                            </span>
                            <ArrowRight size={19} className="text-muted-gold transition-transform group-hover:translate-x-1" />
                        </button>

                        <button
                            type="button"
                            onClick={openGrace}
                            className="group grid grid-cols-[auto_1fr_auto] items-center gap-5 p-7 text-left transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold sm:p-9 lg:p-10"
                        >
                            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-champagne text-slate group-hover:border-muted-gold group-hover:text-obsidian">
                                <ChatCircle size={20} />
                            </span>
                            <span>
                                <span className="block font-display text-2xl text-obsidian">Talk with Grace</span>
                                <span className="mt-1 block text-xs leading-relaxed text-slate">Fitment and product guidance without leaving the page.</span>
                            </span>
                            <ArrowRight size={19} className="text-muted-gold transition-transform group-hover:translate-x-1" />
                        </button>
                    </div>
                </FadeUp>
            </div>
        </section>
    );
}

function DesignFamilies({ designFamilyCards }: { designFamilyCards?: HomepageData["designFamilyCards"] }) {
    const sanityFamilies = new Map(
        designFamilyCards?.map((family) => [family.family, family]) ?? [],
    );
    const families = HOME_FAMILY_MOSAIC.map((family) => {
        const sanity = sanityFamilies.get(family.family);
        return {
            ...family,
            title: sanity?.title || family.title,
            image: sanity?.image ? urlFor(sanity.image) : family.image,
        };
    });

    const layoutClass: Record<(typeof families)[number]["layout"], string> = {
        feature: "col-span-2 lg:col-span-6 lg:row-span-2 min-h-[440px] lg:min-h-0",
        standard: "col-span-1 lg:col-span-3 min-h-[220px] lg:min-h-0",
        wide: "col-span-2 lg:col-span-6 min-h-[230px] lg:min-h-0",
    };

    return (
        <section id="families" className="bg-warm-white py-14 lg:py-20">
            <div className="mx-auto max-w-[1440px] px-5 sm:px-6 lg:px-10">
                <FadeUp className="mb-7 flex items-end justify-between gap-6 lg:mb-9">
                    <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate">Find Your Shape</p>
                        <h2 className="text-balance font-display text-[34px] font-medium leading-none text-obsidian lg:text-[46px]">Shop by bottle family</h2>
                        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate">Start with the silhouette that fits your brand, then choose how it dispenses.</p>
                    </div>
                    <Link href="/catalog?category=Glass+Bottle" className="hidden shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-gold transition-colors hover:text-obsidian sm:inline-flex">
                        View All Families <ArrowRight size={15} />
                    </Link>
                </FadeUp>

                <div className="grid grid-cols-2 gap-2.5 lg:h-[650px] lg:grid-cols-12 lg:grid-rows-2 lg:gap-3">
                    {families.map((family, index) => (
                        <FadeUp key={family.family} delay={index * 0.06} className={layoutClass[family.layout]}>
                            <Link
                                href={homepageFamilyHref(family.family)}
                                className="group relative block h-full overflow-hidden bg-travertine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold"
                            >
                                <Image
                                    src={family.image}
                                    alt={`${family.title} bottle family`}
                                    fill
                                    sizes={family.layout === "feature" ? "(min-width: 1024px) 48vw, 100vw" : "(min-width: 1024px) 24vw, 50vw"}
                                    className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.025]"
                                    unoptimized={family.image.startsWith("http")}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-obsidian/72 via-obsidian/10 to-transparent" />
                                <div className={`absolute inset-x-0 bottom-0 ${family.layout === "feature" ? "p-6 lg:p-8" : "p-4 lg:p-5"}`}>
                                    <h3 className={`font-display font-medium leading-none text-white ${family.layout === "feature" ? "text-4xl lg:text-5xl" : "text-2xl lg:text-3xl"}`}>
                                        {family.title}
                                    </h3>
                                    {family.layout === "feature" && (
                                        <>
                                            <p className="mt-3 max-w-[310px] text-sm leading-relaxed text-white/86">{family.description}</p>
                                            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75">
                                                {family.applications?.join(" · ")}
                                            </p>
                                            <span className="mt-5 inline-flex items-center gap-2 border border-white/65 bg-obsidian px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white transition-colors group-hover:bg-white group-hover:text-obsidian">
                                                Explore Cylinder <ArrowRight size={13} />
                                            </span>
                                        </>
                                    )}
                                </div>
                            </Link>
                        </FadeUp>
                    ))}
                </div>

                <Link href="/catalog?category=Glass+Bottle" className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-gold sm:hidden">
                    View All Families <ArrowRight size={15} />
                </Link>
            </div>
        </section>
    );
}

function ApplicationShowcase() {
    return (
        <section className="border-y border-champagne/45 bg-white py-14 lg:py-18">
            <div className="mx-auto max-w-[1440px] px-5 sm:px-6 lg:px-10">
                <FadeUp className="mb-8">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate">Start With Function</p>
                    <h2 className="text-balance font-display text-[32px] font-medium leading-none text-obsidian lg:text-[42px]">Choose your applicator</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate">Select how your formula should be dispensed, then explore bottles with verified fitment.</p>
                </FadeUp>

                <div className="flex snap-x snap-mandatory gap-px overflow-x-auto border border-champagne/50 bg-champagne/50 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-5">
                    {HOME_APPLICATION_LINKS.map((application, index) => (
                        <FadeUp key={application.key} delay={index * 0.05} className="min-w-[82%] snap-start sm:min-w-0">
                            <Link
                                href={application.href}
                                className="group block h-full bg-warm-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold"
                            >
                                <div className="relative aspect-[4/3] overflow-hidden bg-[#f5efe3] sm:aspect-square">
                                    <Image
                                        src={application.image}
                                        alt={`${application.label} bottle application`}
                                        fill
                                        sizes="(min-width: 1024px) 19vw, (min-width: 640px) 50vw, 100vw"
                                        className="object-contain object-center transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-4 px-5 py-5 lg:min-h-[116px] lg:px-5 lg:py-5">
                                    <span>
                                        <span className="block font-display text-[22px] leading-none text-obsidian lg:text-[21px]">{application.label}</span>
                                        <span className="mt-2 block text-[11px] leading-relaxed text-slate">{application.description}</span>
                                    </span>
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-champagne text-muted-gold transition-colors group-hover:border-muted-gold group-hover:bg-muted-gold group-hover:text-white">
                                        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                                    </span>
                                </div>
                            </Link>
                        </FadeUp>
                    ))}
                </div>
            </div>
        </section>
    );
}

function SampleTestersFeature() {
    return (
        <section className="border-t border-champagne/45 bg-linen py-10 lg:py-14">
            <div className="mx-auto max-w-[1440px] px-5 sm:px-6 lg:px-10">
                <FadeUp>
                    <Link
                        href={HOME_SAMPLE_FEATURE.href}
                        className="group grid overflow-hidden border border-champagne/60 bg-warm-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold md:grid-cols-[0.82fr_1.18fr]"
                    >
                        <div className="flex flex-col justify-center p-7 sm:p-9 lg:p-12">
                            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate">{HOME_SAMPLE_FEATURE.eyebrow}</p>
                            <h2 className="text-balance font-display text-[32px] font-medium leading-none text-obsidian lg:text-[42px]">{HOME_SAMPLE_FEATURE.title}</h2>
                            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate">{HOME_SAMPLE_FEATURE.description}</p>
                            <span className="mt-7 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-gold transition-colors group-hover:text-obsidian">
                                Explore Small Formats <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                            </span>
                        </div>
                        <div className="relative min-h-[270px] overflow-hidden sm:min-h-[330px] md:min-h-[380px]" style={{ backgroundColor: HOME_SAMPLE_FEATURE.matte }}>
                            <Image
                                src={HOME_SAMPLE_FEATURE.image}
                                alt={HOME_SAMPLE_FEATURE.imageAlt}
                                fill
                                sizes="(min-width: 768px) 58vw, 100vw"
                                className="object-contain object-center transition-transform duration-700 ease-out group-hover:scale-[1.01]"
                            />
                        </div>
                    </Link>
                </FadeUp>
            </div>
        </section>
    );
}

function EditorialStories() {
    return (
        <section className="border-b border-champagne/45 bg-warm-white py-14 lg:py-20">
            <div className="mx-auto max-w-[1440px] px-5 sm:px-6 lg:px-10">
                <FadeUp className="mb-9 lg:mb-12">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate">Stories From the Collection</p>
                    <h2 className="text-balance font-display text-[34px] font-medium leading-none text-obsidian lg:text-[46px]">Distinctive objects for the ritual</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate">Beyond everyday formats, discover the small vessels and finishing details that make packaging feel personal.</p>
                </FadeUp>

                <div className="space-y-7 lg:space-y-10">
                    {HOME_EDITORIAL_STORIES.map((story, index) => {
                        const imageOnRight = index % 2 === 1;
                        return (
                            <FadeUp key={story.key} delay={index * 0.06}>
                                <article className="grid overflow-hidden border border-champagne/55 bg-linen lg:grid-cols-12">
                                    <Link
                                        href={story.href}
                                        className={`${imageOnRight ? "lg:order-2" : ""} group relative aspect-[4/3] overflow-hidden sm:aspect-[16/9] lg:col-span-7 lg:aspect-auto lg:min-h-[410px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold`}
                                        style={{ backgroundColor: story.matte }}
                                    >
                                        <Image
                                            src={story.image}
                                            alt={story.imageAlt}
                                            fill
                                            sizes="(min-width: 1024px) 58vw, 100vw"
                                            className="object-contain transition-transform duration-700 ease-out group-hover:scale-[1.01]"
                                            style={{ objectPosition: story.imagePosition }}
                                        />
                                    </Link>
                                    <div className={`${imageOnRight ? "lg:order-1" : ""} flex flex-col justify-center p-7 sm:p-10 lg:col-span-5 lg:p-12 xl:p-14`}>
                                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate">{story.eyebrow}</p>
                                        <h3 className="text-balance font-display text-[34px] font-medium leading-[0.98] text-obsidian lg:text-[44px]">{story.title}</h3>
                                        <p className="mt-5 max-w-md text-sm leading-[1.75] text-slate">{story.description}</p>
                                        <Link href={story.href} className="group mt-7 inline-flex w-fit items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-gold transition-colors hover:text-obsidian focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold">
                                            Explore the Collection <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                                        </Link>
                                    </div>
                                </article>
                            </FadeUp>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

function PackagingAccessoriesStory() {
    return (
        <section className="bg-linen pb-14 lg:pb-20">
            <div className="mx-auto max-w-[1440px] px-5 sm:px-6 lg:px-10">
                <FadeUp className="grid overflow-hidden border border-champagne/60 bg-warm-white md:grid-cols-[1.08fr_0.92fr]">
                    <Link
                        href={HOME_ACCESSORY_STORY.href}
                        className="group relative min-h-[290px] overflow-hidden sm:min-h-[350px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold"
                        style={{ backgroundColor: HOME_ACCESSORY_STORY.matte }}
                    >
                        <Image
                            src={HOME_ACCESSORY_STORY.image}
                            alt={HOME_ACCESSORY_STORY.imageAlt}
                            fill
                            sizes="(min-width: 768px) 54vw, 100vw"
                            className="object-contain object-center transition-transform duration-700 ease-out group-hover:scale-[1.01]"
                        />
                    </Link>
                    <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate">{HOME_ACCESSORY_STORY.eyebrow}</p>
                        <h3 className="text-balance font-display text-[34px] font-medium leading-none text-obsidian lg:text-[42px]">{HOME_ACCESSORY_STORY.title}</h3>
                        <p className="mt-5 max-w-lg text-sm leading-[1.75] text-slate">{HOME_ACCESSORY_STORY.description}</p>
                        <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3">
                            {HOME_ACCESSORY_STORY.links.map((link) => (
                                <Link key={link.label} href={link.href} className="group inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-gold transition-colors hover:text-obsidian focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold">
                                    {link.label} <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                                </Link>
                            ))}
                        </div>
                    </div>
                </FadeUp>
            </div>
        </section>
    );
}

function SocialProof() {
    const testimonials = [
        { quote: "Best Bottles transformed our unboxing experience. The glass quality is impeccable and their volume pricing scales perfectly with our growth.", name: "Sarah L.", brand: "Aura Botanica", segment: "Graduate" },
        { quote: "Grace helped us navigate a complex dropper fitment issue in minutes. It's like having an in-house packaging engineer on staff.", name: "Marcus T.", brand: "Veda Skincare", segment: "Scaler" },
        { quote: "Consistent lead times and zero tariff surprises. They are the only supply chain partner we trust completely.", name: "Elena R.", brand: "Lumiere Fragrance", segment: "Professional" },
    ];

    return (
        <section className="border-b border-champagne/45 bg-warm-white py-14 lg:py-18">
            <div className="mx-auto grid max-w-[1440px] gap-10 px-5 sm:px-6 lg:grid-cols-[0.8fr_2.2fr] lg:px-10">
                <FadeUp>
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate">Who Trusts Best Bottles</p>
                    <h2 className="text-balance font-display text-[34px] font-medium leading-[1.05] text-obsidian lg:text-[42px]">Serving 500+ brands</h2>
                    <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate">From boutique indie perfumers to enterprise retail labels.</p>
                </FadeUp>
                <div className="grid gap-0 border-y border-champagne/55 md:grid-cols-3">
                    {testimonials.map((test, i) => (
                        <FadeUp key={test.name} delay={i * 0.07} className="border-b border-champagne/55 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                            <div className="flex h-full flex-col justify-between px-0 py-7 md:px-7 lg:px-8">
                                <p className="font-display text-[18px] leading-[1.45] text-obsidian">&ldquo;{test.quote}&rdquo;</p>
                                <div>
                                    <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-obsidian">{test.name}</p>
                                    <p className="mt-1 text-[11px] text-slate">{test.brand} · {test.segment}</p>
                                </div>
                            </div>
                        </FadeUp>
                    ))}
                </div>
            </div>
        </section>
    );
}

function EducationPreview({ educationPreview: edu }: { educationPreview?: HomepageData["educationPreview"] }) {
    const articles = edu?.featuredArticles?.length
        ? edu.featuredArticles.map((a) => ({
            title: a.title,
            category: a.category ? (CATEGORY_LABELS[a.category] ?? a.category) : "Insights",
            excerpt: a.excerpt ?? fallbackArticleExcerpt(a.title, a.category ? (CATEGORY_LABELS[a.category] ?? a.category) : "Packaging"),
            img: a.image ? urlFor(a.image) : "/assets/Cylinder-BB.png",
            slug: a.slug ? `/blog/${a.slug}` : "#",
        }))
        : DEFAULT_ARTICLES;

    const sectionTitle = edu?.sectionTitle ?? "Packaging Insights";
    const sectionEyebrow = edu?.sectionEyebrow ?? "From the Lab";
    const viewAllHref = edu?.viewAllHref ?? "/blog";

    return (
        <section className="bg-linen py-14 lg:py-20">
            <div className="mx-auto max-w-[1440px] px-5 sm:px-6 lg:px-10">
                <div className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end">
                    <FadeUp>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate">{sectionEyebrow}</p>
                        <h2 className="font-display text-[34px] font-medium leading-none text-obsidian lg:text-[42px]">{sectionTitle}</h2>
                    </FadeUp>
                    <FadeUp delay={0.12}>
                        <Link href={viewAllHref} className="flex items-center text-xs font-semibold uppercase tracking-[0.16em] text-muted-gold transition-colors hover:text-obsidian">
                            View All Articles <ArrowRight className="ml-2" size={15} />
                        </Link>
                    </FadeUp>
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-5">
                    {articles.map((article, i) => (
                        <FadeUp key={article.title} delay={i * 0.07}>
                            <Link href={article.slug} className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold">
                                <div className="relative mb-4 aspect-[16/10] overflow-hidden bg-travertine">
                                    <Image
                                        src={article.img}
                                        alt={article.title}
                                        fill
                                        className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.025]"
                                        unoptimized={article.img.startsWith("http")}
                                    />
                                </div>
                                <span className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.17em] text-muted-gold">{article.category}</span>
                                <h3 className="text-balance font-display text-[22px] leading-[1.05] text-obsidian transition-colors group-hover:text-muted-gold">{article.title}</h3>
                                <p className="mt-3 text-xs leading-relaxed text-slate">{article.excerpt}</p>
                                <span className="mt-4 flex items-center text-[11px] font-semibold uppercase tracking-[0.13em] text-obsidian transition-colors group-hover:text-muted-gold">
                                    Read More <ArrowRight className="ml-2 transition-transform group-hover:translate-x-1" size={13} />
                                </span>
                            </Link>
                        </FadeUp>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default function HomePage({ homepageData }: { homepageData: HomepageData | null }) {
    return (
        <main className="min-h-screen">
            <Navbar variant="home" hideMobileSearch />
            <Hero heroSlides={homepageData?.heroSlides} mobileHeroMode={homepageData?.mobileHeroMode} />
            <MobileCategoryGrid data={homepageData} />
            <MobilePostHeroSearch />
            <DesignFamilies designFamilyCards={homepageData?.designFamilyCards} />
            <TrustBar />
            <SampleTestersFeature />
            <ApplicationShowcase />
            <EditorialStories />
            <PackagingAccessoriesStory />
            <PathChooser />
            <SocialProof />
            <EducationPreview educationPreview={homepageData?.educationPreview} />
            <Footer />
        </main>
    );
}
