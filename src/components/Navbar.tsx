"use client";

import { canOptimizeWithNextImage } from "@/lib/products/optimizable-image";
import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
    MagnifyingGlass, User, ShoppingBag, CaretDown, List, X,
    Flask, Diamond, ArrowRight, ArrowLeft, SprayBottle, Wrench, BookOpen, Ruler,
} from "@/components/icons";
import { useCart } from "@/components/CartProvider";
import dynamic from "next/dynamic";
// The cart drawer renders nothing until opened; loading it after idle (or on the first open) keeps it,
// and framer-motion on pages that do not otherwise use it, out of the first-load JavaScript.
const CartDrawer = dynamic(() => import("./CartDrawer"), { ssr: false });
import AnnouncementMarquee from "./AnnouncementMarquee";
import BrandWordmark from "./BrandWordmark";
import RegionSelector from "./RegionSelector";
import LanguageSwitcher from "./LanguageSwitcher";
import LocaleLink from "./LocaleLink";
import { useMegaMenuPanels } from "./SanityMegaMenuProvider";
import { urlFor } from "@/sanity/lib/image";
import { MEGA_MENU_PANELS, type MegaMenuId, type MegaMenuLink, type MegaMenuPanelContent } from "@/lib/megaMenu";
import { localizeHref } from "@/i18n/paths";
import { useAppLocale, useCopy } from "@/i18n/useCopy";
import { useGrace } from "@/components/useGrace";
import FamilyShapeIcon from "@/components/icons/FamilyShapeIcon";
import CollectionIcon from "@/components/icons/CollectionIcon";
import GraceMark from "@/components/icons/GraceMark";
import { NAV_FAMILIES } from "@/lib/navFamilies";
import { familyFinderHref } from "@/lib/products/focused-shopping";
import { SHOP_COLLECTIONS, shopCollectionHref } from "@/lib/shopCollections";
import { localizeCollectionName, localizeCollectionSubtitle, localizeFamilyName } from "@/i18n/catalogCopy";
import menuStyles from "@/components/home/CollectionShopping.module.css";

interface NavbarProps {
    variant?: "home" | "catalog";
    initialSearchValue?: string;
    hideSearch?: boolean;
    hideMobileSearch?: boolean;
    builderMobile?: boolean;
    headerClassName?: string;
    /** @deprecated cart is now managed internally */
    onCartOpen?: () => void;
}

// ─── Mega Menu Data ──────────────────────────────────────────────────────────

type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";

type MegaPanel = MegaMenuPanelContent & {
    featured: MegaMenuPanelContent["featured"] & {
        placeholderIcon: React.ComponentType<{ className?: string; size?: number; weight?: IconWeight }>;
        accentColor: string;
    };
};

const MEGA_PANELS: Record<MegaMenuId, MegaPanel> = {
    bottles: {
        ...MEGA_MENU_PANELS.bottles,
        featured: {
            ...MEGA_MENU_PANELS.bottles.featured,
            placeholderIcon: SprayBottle,
            accentColor: "bg-gradient-to-br from-muted-gold/20 to-champagne/40",
        },
    },
    closures: {
        ...MEGA_MENU_PANELS.closures,
        featured: {
            ...MEGA_MENU_PANELS.closures.featured,
            placeholderIcon: Flask,
            accentColor: "bg-gradient-to-br from-slate/10 to-champagne/30",
        },
    },
    specialty: {
        ...MEGA_MENU_PANELS.specialty,
        featured: {
            ...MEGA_MENU_PANELS.specialty.featured,
            placeholderIcon: Diamond,
            accentColor: "bg-gradient-to-br from-rose-50 to-champagne/40",
        },
    },
};

type NavLinkDef =
    | { label: string; href: string; megaId: MegaMenuId }
    | { label: string; href: string };

const NAV_LINKS: Record<string, NavLinkDef[]> = {
    home: [
        { label: "Bottle Families", href: "/bottle-families" },
        { label: "Closures", href: "/catalog?category=Component", megaId: "closures" as MegaMenuId },
        { label: "Collections", href: "/collections" },
        { label: "Catalog", href: "/catalog" },
        { label: "Build Your Bottle", href: "/matrix" },
        { label: "Journal", href: "/blog" },
        { label: "About", href: "/about" },
    ],
    catalog: [
        { label: "Bottle Families", href: "/bottle-families" },
        { label: "Closures", href: "/catalog?category=Component", megaId: "closures" as MegaMenuId },
        { label: "Collections", href: "/collections" },
        { label: "Catalog", href: "/catalog" },
        { label: "Build Your Bottle", href: "/matrix" },
        { label: "Journal", href: "/blog" },
        { label: "About", href: "/about" },
    ],
};

const SEARCH_SUGGESTIONS = [
    { label: "Dropper", helper: "Applicator", query: "dropper" },
    { label: "30 ml", helper: "Capacity", query: "30 ml" },
    { label: "Amber", helper: "Glass color", query: "amber" },
    { label: "Boston Round", helper: "Design family", query: "Boston Round" },
    { label: "Roll-On", helper: "Applicator", query: "roll-on" },
    { label: "Fine Mist Spray", helper: "Applicator", query: "fine mist spray" },
    { label: "20-400", helper: "Neck thread", query: "20-400" },
    { label: "Cream Jar", helper: "Category", query: "cream jar" },
];

export default function Navbar({ variant = "home", initialSearchValue, hideSearch = false, hideMobileSearch = false, builderMobile = false, headerClassName = "" }: NavbarProps) {
    const router = useRouter();
    // Grace opens from the header on inner pages; the floating launcher is homepage-only (2026-11-04).
    const { open: openGrace } = useGrace();
    const { itemCount, isCartHydrated } = useCart();
    const megaMenuPanels = useMegaMenuPanels();
    const locale = useAppLocale();
    const t = useCopy("nav");
    const navLabel = (label: string) => {
        switch (label) {
            case "Bottle Families": return t("bottleFamilies");
            case "Closures": return t("closures");
            case "Collections": return t("collections");
            case "Catalog": return t("catalog");
            case "Build Your Bottle": return t("buildYourBottleTitle");
            case "Journal": return t("journal");
            case "About": return t("about");
            default: return label;
        }
    };
    const [cartOpen, setCartOpen] = useState(false);
    // The drawer's code arrives after the page is idle; opening earlier mounts it at once.
    const [cartDrawerIdle, setCartDrawerIdle] = useState(false);
    useEffect(() => {
        if (typeof requestIdleCallback === "function") {
            const id = requestIdleCallback(() => setCartDrawerIdle(true), { timeout: 4000 });
            return () => cancelIdleCallback(id);
        }
        const id = window.setTimeout(() => setCartDrawerIdle(true), 1500);
        return () => window.clearTimeout(id);
    }, []);
    const cartDrawerWanted = cartDrawerIdle || cartOpen;
    const [mounted, setMounted] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [isDictating, setIsDictating] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const [micErrorMsg, setMicErrorMsg] = useState("");
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Allow other components to open the cart drawer via custom event
    useEffect(() => {
        const handler = () => setCartOpen(true);
        window.addEventListener("open-cart-drawer", handler);
        return () => window.removeEventListener("open-cart-drawer", handler);
    }, []);

    useEffect(() => {
        if (initialSearchValue !== undefined) {
            setSearchValue(initialSearchValue);
        }
    }, [initialSearchValue]);

    const showMicError = useCallback((message: string) => {
        setMicErrorMsg(message);
        setTimeout(() => setMicErrorMsg(""), 3500);
    }, []);

    const searchPlaceholder = micErrorMsg
        ? micErrorMsg
        : isDictating
            ? "Listening..."
            : isTranscribing
                ? "Transcribing..."
                : "Search bottles, closures, families...";

    const stopDictation = () => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
        setIsDictating(false);
    };

    const startDictation = async () => {
        try {
            setMicErrorMsg("");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/mp4")
                    ? "audio/mp4"
                    : "";
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                const blob = new Blob(audioChunksRef.current, {
                    type: recorder.mimeType || "audio/webm",
                });
                if (blob.size < 500) {
                    showMicError("Recording too short — try again");
                    return;
                }
                setIsTranscribing(true);
                try {
                    const fd = new FormData();
                    fd.append("audio", blob, "recording.webm");
                    const res = await fetch("/api/voice/transcribe", { method: "POST", body: fd });
                    if (!res.ok) {
                        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
                        showMicError(payload?.error || "Voice search failed");
                        return;
                    }
                    const { text } = (await res.json()) as { text: string };
                    if (text?.trim()) {
                        setSearchValue(text.trim());
                    } else {
                        showMicError("Couldn't detect speech — try again");
                    }
                } catch (error) {
                    console.error("[Search STT] Transcription failed:", error);
                    showMicError("Voice search failed");
                } finally {
                    setIsTranscribing(false);
                }
            };

            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsDictating(true);

            try {
                const audioCtx = new AudioContext();
                audioContextRef.current = audioCtx;
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                audioCtx.createMediaStreamSource(stream).connect(analyser);
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                const SILENCE_THRESHOLD = 8;
                const SILENCE_DELAY_MS = 1500;

                const checkSilence = () => {
                    if (mediaRecorderRef.current?.state !== "recording") return;
                    analyser.getByteFrequencyData(dataArray);
                    const rms = Math.sqrt(
                        dataArray.reduce((sum, v) => sum + v * v, 0) / dataArray.length
                    );
                    if (rms < SILENCE_THRESHOLD) {
                        if (!silenceTimerRef.current) {
                            silenceTimerRef.current = setTimeout(() => {
                                silenceTimerRef.current = null;
                                stopDictation();
                            }, SILENCE_DELAY_MS);
                        }
                    } else {
                        if (silenceTimerRef.current) {
                            clearTimeout(silenceTimerRef.current);
                            silenceTimerRef.current = null;
                        }
                    }
                    requestAnimationFrame(checkSilence);
                };
                requestAnimationFrame(checkSilence);
            } catch {
                // AudioContext unavailable
            }
        } catch (err) {
            console.error("[Search STT] Failed to start recording:", err);
            const msg =
                err instanceof Error && err.name === "NotAllowedError"
                    ? "Mic access denied — check browser settings"
                    : "Could not start microphone";
            showMicError(msg);
        }
    };

    const handleSearchSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        const term = searchValue.trim();
        if (term) {
            router.push(localizeHref(locale, `/catalog?search=${encodeURIComponent(term)}`));
        } else {
            router.push(localizeHref(locale, "/catalog"));
        }
    };
    const visibleSearchSuggestions = SEARCH_SUGGESTIONS.filter((suggestion) => {
        const term = searchValue.trim().toLowerCase();
        if (!term) return true;
        return `${suggestion.label} ${suggestion.helper} ${suggestion.query}`.toLowerCase().includes(term);
    }).slice(0, searchValue.trim() ? 5 : 4);
    const showSearchSuggestions = visibleSearchSuggestions.length > 0 && !isDictating && !isTranscribing;
    const handleSearchSuggestion = (query: string) => {
        setSearchValue(query);
        router.push(localizeHref(locale, `/catalog?search=${encodeURIComponent(query)}`));
    };

    const links = NAV_LINKS[variant];
    const [activeMega, setActiveMega] = useState<MegaMenuId | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    // Phone drawer: plain rows; families, collections and closures each open their own panel (2026-11-04).
    const [mobileView, setMobileView] = useState<"root" | "families" | "collections" | MegaMenuId>("root");
    const closeMobileMenu = () => { setMobileMenuOpen(false); setMobileView("root"); };
    const megaRef = useRef<HTMLDivElement>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // The open panel hangs from the header's bottom edge, measured, so no strip of page shows between them
    // (Jordan 2026-11-04: "close the gap between the mega menu and the navigation links").
    const headerRef = useRef<HTMLElement>(null);
    const [megaTop, setMegaTop] = useState<number | null>(null);
    useEffect(() => {
        if (!activeMega) return;
        const measure = () => setMegaTop(headerRef.current ? headerRef.current.getBoundingClientRect().bottom : null);
        measure();
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, { passive: true });
        return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure); };
    }, [activeMega]);

    const openMega = useCallback((id: MegaMenuId) => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
        setActiveMega(id);
    }, []);

    const closeMega = useCallback(() => {
        closeTimerRef.current = setTimeout(() => setActiveMega(null), 180);
    }, []);

    const cancelClose = useCallback(() => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (megaRef.current && !megaRef.current.contains(e.target as Node)) {
                setActiveMega(null);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") setActiveMega(null);
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, []);

    useEffect(() => {
        document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [mobileMenuOpen]);

    return (
        <>
            <header
                ref={headerRef}
                data-site-header=""
                data-builder-header={builderMobile || undefined}
                className={`${headerClassName} fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-bone/95 shadow-sm backdrop-blur-md" : "bg-bone"
                    } ${variant === "catalog" ? "border-b border-champagne" : ""}`}
                style={{ right: "var(--grace-content-inset, 0px)" }}
            >
                <AnnouncementMarquee />

                {builderMobile && <div className="builder-mobile-brand">
                    <LocaleLink href="/catalog" aria-label={t("backToBottles")}><ArrowLeft size={22} /></LocaleLink>
                    <p className="builder-mobile-title">{t("buildYourBottle")}</p>
                    <button aria-label={`Cart${mounted && isCartHydrated ? `, ${itemCount} items` : ""}`} onClick={() => setCartOpen(true)}><ShoppingBag size={24} />{mounted && isCartHydrated && itemCount > 0 && <span>{itemCount > 99 ? "99+" : itemCount}</span>}</button>
                </div>}
                <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
                    {/* Row 1: desktop = [reserved: region/currency] | centred wordmark | search + actions. mobile = hamburger | centred wordmark | spacer */}
                    <div className="relative flex h-[56px] items-center gap-2 sm:gap-4 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:h-[60px] xl:gap-4 2xl:gap-6">
                        <button
                            aria-label={t("openMenu")}
                            className="xl:hidden p-2 -ml-2 text-obsidian hover:text-muted-gold transition-colors shrink-0"
                            onClick={() => setMobileMenuOpen(true)}
                        >
                            <List size={20} weight="regular" />
                        </button>
                        <div className="hidden xl:flex xl:justify-self-start xl:items-center xl:gap-3">
                            <LanguageSwitcher />
                            <RegionSelector />
                        </div>
                        <LocaleLink
                            href="/"
                            aria-label={t("home")}
                            className="flex flex-1 min-h-11 items-center justify-center xl:flex-none xl:justify-self-center"
                        >
                            <BrandWordmark tagline />
                        </LocaleLink>
                        <div className="ml-auto flex min-w-9 shrink-0 items-center justify-end space-x-2 xl:ml-0 xl:min-w-0 xl:justify-self-end">
                        {!hideSearch && (
                            <form
                                onSubmit={handleSearchSubmit}
                                className="group/search relative hidden min-w-0 items-center space-x-2 rounded-xl border border-champagne bg-white/60 px-3 py-2 transition-all duration-200 focus-within:border-muted-gold focus-within:ring-2 focus-within:ring-muted-gold/15 xl:flex xl:w-[240px] 2xl:w-[300px]"
                                suppressHydrationWarning
                            >
                            <MagnifyingGlass className="text-slate shrink-0" size={16} />
                            <input
                                type="search"
                                name="search"
                                autoComplete="search"
                                enterKeyHint="search"
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="bg-transparent text-sm flex-1 min-w-0 placeholder-slate/60 text-obsidian"
                                aria-label={t("searchProducts")}
                                data-testid="navbar-desktop-search-input"
                                suppressHydrationWarning
                            />
                            <button
                                type="submit"
                                aria-label="Submit product search"
                                className="shrink-0 rounded-lg p-1.5 text-slate hover:bg-muted-gold/10 hover:text-muted-gold transition-colors"
                            >
                                <ArrowRight size={14} />
                            </button>
                            {showSearchSuggestions && (
                                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[70] hidden overflow-hidden rounded-xl border border-champagne bg-white shadow-xl group-focus-within/search:block">
                                    <p className="px-3 pt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate/70">Suggested searches</p>
                                    <div className="p-2">
                                        {visibleSearchSuggestions.map((suggestion) => (
                                            <button
                                                key={`${suggestion.helper}-${suggestion.label}`}
                                                type="button"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => handleSearchSuggestion(suggestion.query)}
                                                className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-bone"
                                            >
                                                <span className="text-sm font-medium text-obsidian">{suggestion.label}</span>
                                                <span className="text-[11px] text-slate">{suggestion.helper}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            </form>
                        )}

                            <button
                                type="button"
                                onClick={() => openGrace()}
                                aria-label={t("askGrace")}
                                className="flex items-center gap-2 p-2 text-obsidian hover:text-muted-gold transition-colors"
                            >
                                <GraceMark size={19} />
                                <span className="hidden xl:inline text-[13px]">{t("askGrace")}</span>
                            </button>

                            <LocaleLink href="/sign-in" aria-label="Account" className="flex items-center p-2 hover:text-muted-gold transition-colors">
                                <User className="text-obsidian" size={20} />
                            </LocaleLink>

                            <button
                                aria-label="Cart"
                                onClick={() => setCartOpen(true)}
                                className={`${variant === "catalog" ? "flex" : "hidden xl:flex"} items-center p-2 hover:text-muted-gold transition-colors relative cursor-pointer`}
                            >
                                <ShoppingBag className="text-obsidian" size={20} />
                                {mounted && isCartHydrated && itemCount > 0 && (
                                    <span className="absolute top-0.5 right-0.5 bg-muted-gold text-white text-[10px] w-[16px] h-[16px] flex items-center justify-center rounded-full font-semibold">
                                        {itemCount > 99 ? "99" : itemCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Row 2 (desktop): centred navigation under the wordmark */}
                    <div className="hidden xl:flex h-[40px] items-center justify-center border-t border-champagne/40">
                        <nav
                            className="flex items-center xl:gap-x-8 2xl:gap-x-12 text-[12px] font-normal text-obsidian uppercase tracking-[0.08em] shrink-0"
                            ref={megaRef}
                        >
                            {links.map((link) => {
                                const hasMega = "megaId" in link;
                                const megaId = hasMega ? (link as NavLinkDef & { megaId: MegaMenuId }).megaId : null;
                                const isOpen = megaId !== null && activeMega === megaId;

                                return hasMega && megaId ? (
                                    <div
                                        key={link.label}
                                        className="relative"
                                        onMouseEnter={() => openMega(megaId)}
                                        onMouseLeave={closeMega}
                                    >
                                        <button
                                            onClick={() => setActiveMega(isOpen ? null : megaId)}
                                            className={`flex items-center gap-1 uppercase tracking-[0.08em] font-normal transition-colors ${isOpen ? "text-muted-gold" : "hover:text-muted-gold"
                                                }`}
                                        >
                                            {navLabel(link.label)}
                                            <CaretDown
                                                className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                                                size={14}
                                            />
                                        </button>

                                        {isOpen && (
                                            <div
                                                className={`fixed left-0 right-0 z-50 ${megaTop === null ? "mt-[22px]" : ""}`}
                                                style={{ right: "var(--grace-content-inset, 0px)", ...(megaTop === null ? {} : { top: megaTop }) }}
                                                onMouseEnter={cancelClose}
                                                onMouseLeave={closeMega}
                                            >
                                                <MegaMenuPanel
                                                    panel={MEGA_PANELS[megaId]}
                                                    sanityFeatured={megaMenuPanels?.[megaId]}
                                                    onClose={() => setActiveMega(null)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <LocaleLink
                                        key={link.label}
                                        href={link.href}
                                        className="hover:text-muted-gold transition-colors"
                                        onMouseEnter={() => setActiveMega(null)}
                                    >
                                        {navLabel(link.label)}
                                    </LocaleLink>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Row 3: full-width search bar (mobile only) */}
                    {!hideSearch && !hideMobileSearch && (
                        <div data-mobile-search="" className="flex xl:hidden pb-3 border-t border-champagne/40 pt-2">
                            <form
                            onSubmit={handleSearchSubmit}
                            className="group/search relative flex flex-1 items-center border border-champagne rounded-xl px-3 py-2 bg-white/60 focus-within:border-muted-gold focus-within:ring-2 focus-within:ring-muted-gold/15 transition-all duration-200 space-x-2"
                            suppressHydrationWarning
                        >
                            <MagnifyingGlass className="text-slate shrink-0" size={16} />
                            <input
                                type="search"
                                name="search"
                                autoComplete="search"
                                enterKeyHint="search"
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="bg-transparent text-sm flex-1 min-w-0 placeholder-slate/60 text-obsidian"
                                aria-label={t("searchProducts")}
                                data-testid="navbar-mobile-search-input"
                                suppressHydrationWarning
                            />
                            <button
                                type="submit"
                                aria-label="Submit product search"
                                data-testid="navbar-mobile-search-submit"
                                className="shrink-0 rounded-lg p-1.5 text-slate hover:bg-muted-gold/10 hover:text-muted-gold transition-colors"
                            >
                                <ArrowRight size={14} />
                            </button>
                            {showSearchSuggestions && (
                                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[70] hidden overflow-hidden rounded-xl border border-champagne bg-white shadow-xl group-focus-within/search:block">
                                    <p className="px-3 pt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate/70">Suggested searches</p>
                                    <div className="p-2">
                                        {visibleSearchSuggestions.map((suggestion) => (
                                            <button
                                                key={`${suggestion.helper}-${suggestion.label}`}
                                                type="button"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => handleSearchSuggestion(suggestion.query)}
                                                className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-bone"
                                            >
                                                <span className="text-sm font-medium text-obsidian">{suggestion.label}</span>
                                                <span className="text-[11px] text-slate">{suggestion.helper}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            </form>
                        </div>
                    )}

                </div>
            </header>

            {cartDrawerWanted && <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />}

            {/* Overlay */}
            {activeMega && (
                <div
                    className="fixed inset-0 bg-obsidian/10 z-40 transition-opacity duration-300"
                    onClick={() => setActiveMega(null)}
                />
            )}

            {mobileMenuOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-obsidian/40 z-[60] xl:hidden"
                        onClick={closeMobileMenu}
                    />
                    <div className="fixed top-0 left-0 bottom-0 z-[61] w-[360px] max-w-[88vw] bg-bone border-r border-champagne shadow-2xl xl:hidden flex flex-col">
                        <div className="h-[44px] bg-obsidian" />
                        <div className="h-[72px] px-4 flex items-center justify-between border-b border-champagne">
                            <LocaleLink
                                href="/"
                                onClick={closeMobileMenu}
                                aria-label={t("home")}
                                className="flex min-h-11 items-center"
                                data-testid="mobile-menu-wordmark"
                            >
                                <BrandWordmark />
                            </LocaleLink>
                            <button
                                aria-label={t("closeMenu")}
                                onClick={closeMobileMenu}
                                className="p-2 text-obsidian hover:text-muted-gold transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className={`flex-1 ${menuStyles.menu}`} style={{ maxHeight: "none", borderTop: 0 }}>
                            {mobileView === "root" && <>
                                <div className={menuStyles.menuPrimary}>
                                    <button type="button" onClick={() => setMobileView("families")}>{t("bottleFamilies")}</button>
                                    <button type="button" onClick={() => setMobileView("collections")}>{t("collections")}</button>
                                    <button type="button" onClick={() => setMobileView("closures")}>{navLabel("Closures")}</button>
                                    <LocaleLink href="/catalog" onClick={closeMobileMenu}>{t("fullCatalog")}</LocaleLink>
                                    <LocaleLink href="/matrix" onClick={closeMobileMenu}>{t("buildYourBottle")}</LocaleLink>
                                </div>
                                <div className={menuStyles.menuSecondary}>
                                    <LocaleLink href="/blog" onClick={closeMobileMenu}>{t("journal")}</LocaleLink>
                                    <LocaleLink href="/about" onClick={closeMobileMenu}>{t("about")}</LocaleLink>
                                    <LocaleLink href="/resources" onClick={closeMobileMenu}>{t("guides")}</LocaleLink>
                                    <button type="button" onClick={() => { closeMobileMenu(); openGrace(); }}>{t("askGrace")}</button>
                                </div>
                                <div className={menuStyles.menuUtility}>
                                    <LocaleLink href="/sign-in?redirect_url=%2Fportal" onClick={closeMobileMenu}>{t("clientPortal")}</LocaleLink>
                                    <LanguageSwitcher />
                                    <RegionSelector inline />
                                </div>
                            </>}
                            {mobileView === "families" && <div className={menuStyles.menuPanel}>
                                <button type="button" className={menuStyles.menuBack} onClick={() => setMobileView("root")}>{t("back")}</button>
                                <h2>{t("bottleFamilies")}</h2>
                                <div className={menuStyles.menuShapes}>{NAV_FAMILIES.map(family => <LocaleLink key={family} href={familyFinderHref(family)} onClick={closeMobileMenu}><FamilyShapeIcon family={family} size={36} strokeWidth={1} /><span>{localizeFamilyName(locale, family)}</span></LocaleLink>)}</div>
                                <LocaleLink data-testid="mobile-menu-primary-link" className={menuStyles.menuViewAll} href="/bottle-families" onClick={closeMobileMenu}>{t("viewAll")}</LocaleLink>
                            </div>}
                            {mobileView === "collections" && <div className={menuStyles.menuPanel}>
                                <button type="button" className={menuStyles.menuBack} onClick={() => setMobileView("root")}>{t("back")}</button>
                                <h2>{t("collections")}</h2>
                                <div className={menuStyles.menuCollections}>{SHOP_COLLECTIONS.map(collection => <LocaleLink key={collection.key} href={shopCollectionHref(collection.key)} onClick={closeMobileMenu}><CollectionIcon collection={collection.key} size={26} strokeWidth={1.1} /><span><strong>{localizeCollectionName(locale, collection.key, collection.title)}</strong><small>{localizeCollectionSubtitle(locale, collection.key, collection.subtitle)}</small></span></LocaleLink>)}</div>
                                <LocaleLink data-testid="mobile-menu-primary-link" className={menuStyles.menuViewAll} href="/collections" onClick={closeMobileMenu}>{t("viewAll")}</LocaleLink>
                            </div>}
                            {mobileView === "closures" && <div className={menuStyles.menuPanel}>
                                <button type="button" className={menuStyles.menuBack} onClick={() => setMobileView("root")}>{t("back")}</button>
                                <h2>{navLabel("Closures")}</h2>
                                {MEGA_PANELS.closures.columns.map((col) => (
                                    <div key={col.heading} className={menuStyles.menuSecondary} style={{ borderTop: 0, paddingTop: 4 }}>
                                        <p className="text-[11px] uppercase tracking-[0.12em] text-slate mb-1">{col.heading}</p>
                                        {col.links.map((item) => <LocaleLink key={item.label} href={item.href} onClick={closeMobileMenu} style={{ textTransform: "none", letterSpacing: 0, fontSize: 15, color: "#1c1c1e" }}>{item.label}</LocaleLink>)}
                                    </div>
                                ))}
                                <LocaleLink data-testid="mobile-menu-primary-link" className={menuStyles.menuViewAll} href="/catalog?category=Component" onClick={closeMobileMenu}>{t("viewAll")}</LocaleLink>
                            </div>}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

// ─── Mega Menu Panel Component ───────────────────────────────────────────────

type SanityFeatured = {
    featuredImage?: { asset?: { _ref: string } };
    title?: string;
    subtitle?: string;
    href?: string;
};

function closureMenuIcon(path: string) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={path} />
        </svg>
    );
}

const megaMenuIcons: Record<NonNullable<MegaMenuLink["icon"]>, React.ReactNode> = {
    sprayer: closureMenuIcon("M5 20h12v-8H5z M8 12V6h6v6 M14 7h2 M19 5l2-1 M19 8h3 M19 11l2 1"),
    pump: closureMenuIcon("M5 20h12v-6H5z M9 14V8 M13 14V8 M6 8V4h13l2 4H6"),
    dropper: closureMenuIcon("M8 10V6a4 4 0 0 1 8 0v4 M6 10h12v4H6z M10 14v5l2 3 2-3v-5"),
    "roll-on": closureMenuIcon("M6.5 10V9a5.5 5.5 0 0 1 11 0v1 M4 10h16v4H4z M7 14v6h10v-6"),
    reducer: closureMenuIcon("M3 7h18v4H3z M6 11l3 8h6l3-8 M10 4h4"),
    cap: closureMenuIcon("M4 18V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10z M8 10v4 M12 10v4 M16 10v4"),
    stopper: closureMenuIcon("M12 2l6 4v4l-6 3-6-3V6z M9 12v4h6v-4 M12 16v6"),
    builder: <Wrench size={20} />,
    guide: <BookOpen size={20} />,
    neck: <Ruler size={20} />,
    grace: <GraceMark size={20} />,
};

function MegaMenuPanel({
    panel,
    sanityFeatured,
    onClose,
}: {
    panel: MegaPanel;
    sanityFeatured?: SanityFeatured | null;
    onClose: () => void;
}) {
    const FeaturedIcon = panel.featured.placeholderIcon;
    const title = sanityFeatured?.title ?? panel.featured.title;
    const subtitle = sanityFeatured?.subtitle ?? panel.featured.subtitle;
    const href = sanityFeatured?.href ?? panel.featured.href;
    const featuredImageUrl = sanityFeatured?.featuredImage ? urlFor(sanityFeatured.featuredImage) : "";

    return (
        <div className="bg-white border-t border-b border-champagne shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-w-[1440px] mx-auto px-8 py-8">
                <div className="flex gap-8">
                    {/* Link Columns */}
                    <div className="flex-1 grid grid-cols-3 gap-8">
                        {panel.columns.map((col) => (
                            <div key={col.heading}>
                                <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate font-semibold mb-4 normal-case">
                                    {col.heading}
                                </h3>
                                <ul className="space-y-1">
                                    {col.links.map((item) => (
                                        <li key={item.label}>
                                            <LocaleLink
                                                href={item.href}
                                                onClick={onClose}
                                                className="group flex items-center justify-between py-1.5 px-2 -mx-2 rounded-md hover:bg-linen transition-colors duration-150"
                                            >
                                                <span className="flex items-center gap-2.5 text-[13px] text-obsidian normal-case font-normal group-hover:text-muted-gold transition-colors">
                                                    {item.icon && <span aria-hidden="true" className="shrink-0">{megaMenuIcons[item.icon]}</span>}
                                                    {item.label}
                                                </span>
                                                {item.badge && (
                                                    <span className="text-[10px] text-slate/60 font-medium tabular-nums">
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </LocaleLink>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* Featured Card */}
                    <LocaleLink
                        href={href}
                        onClick={onClose}
                        className={`group w-[280px] shrink-0 rounded-lg p-6 ${panel.featured.accentColor} border border-champagne/30 hover:border-muted-gold/40 transition-all duration-200 flex flex-col justify-between overflow-hidden`}
                    >
                        <div>
                            {featuredImageUrl ? (
                                <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden mb-4 -mx-2 -mt-2">
                                    <Image
                                        src={featuredImageUrl}
                                        alt={title}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                                        sizes="264px"
                                        unoptimized={!canOptimizeWithNextImage(featuredImageUrl)}
                                    />
                                </div>
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-white/70 flex items-center justify-center mb-4 shadow-sm">
                                    <FeaturedIcon className="text-muted-gold" size={20} />
                                </div>
                            )}
                            <h4 className="font-brand-display text-[13px] tracking-[0.06em] text-obsidian mb-2 group-hover:text-muted-gold transition-colors">
                                {title}
                            </h4>
                            <p className="text-[12px] text-slate normal-case leading-relaxed">
                                {subtitle}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-gold">
                            <span className="normal-case">Explore</span>
                            <ArrowRight className="group-hover:translate-x-1 transition-transform" size={14} />
                        </div>
                    </LocaleLink>
                </div>

                {/* Footer Links */}
                <div className="border-t border-champagne/50 mt-6 pt-4 flex items-center justify-between">
                    {panel.footerLinks.map((fl) => (
                        <LocaleLink
                            key={fl.label}
                            href={fl.href}
                            onClick={onClose}
                            className="text-[11px] uppercase tracking-wider text-slate hover:text-muted-gold transition-colors font-semibold normal-case flex items-center gap-1"
                        >
                            {fl.icon && <span aria-hidden="true" className="shrink-0">{megaMenuIcons[fl.icon]}</span>}
                            {fl.label}
                            <ArrowRight size={12} />
                        </LocaleLink>
                    ))}
                </div>
            </div>
        </div>
    );
}
