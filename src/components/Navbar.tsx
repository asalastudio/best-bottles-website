"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    MagnifyingGlass, User, ShoppingBag, CaretDown, List, X,
    Flask, Diamond, ArrowRight, SprayBottle,
} from "@/components/icons";
import { useCart } from "@/components/CartProvider";
import CartDrawer from "./CartDrawer";
import { useMegaMenuPanels } from "./SanityMegaMenuProvider";
import { urlFor } from "@/sanity/lib/image";
import { MEGA_MENU_PANELS, type MegaMenuId, type MegaMenuPanelContent } from "@/lib/megaMenu";

interface NavbarProps {
    variant?: "home" | "catalog";
    initialSearchValue?: string;
    hideMobileSearch?: boolean;
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
        { label: "Bottles", href: "/catalog?category=Glass+Bottle", megaId: "bottles" as MegaMenuId },
        { label: "Closures", href: "/catalog?category=Component", megaId: "closures" as MegaMenuId },
        { label: "Specialty", href: "/catalog", megaId: "specialty" as MegaMenuId },
        { label: "Catalog", href: "/catalog" },
        { label: "Build a Bottle", href: "/matrix" },
        { label: "Journal", href: "/blog" },
        { label: "About", href: "/about" },
    ],
    catalog: [
        { label: "Bottles", href: "/catalog?category=Glass+Bottle", megaId: "bottles" as MegaMenuId },
        { label: "Closures", href: "/catalog?category=Component", megaId: "closures" as MegaMenuId },
        { label: "Specialty", href: "/catalog", megaId: "specialty" as MegaMenuId },
        { label: "Catalog", href: "/catalog" },
        { label: "Build a Bottle", href: "/matrix" },
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

export default function Navbar({ variant = "home", initialSearchValue, hideMobileSearch = false }: NavbarProps) {
    const router = useRouter();
    // Grace trigger moved to the floating launcher; useGrace no longer needed here.
    const { itemCount, isCartHydrated } = useCart();
    const megaMenuPanels = useMegaMenuPanels();
    const [cartOpen, setCartOpen] = useState(false);
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
            router.push(`/catalog?search=${encodeURIComponent(term)}`);
        } else {
            router.push("/catalog");
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
        router.push(`/catalog?search=${encodeURIComponent(query)}`);
    };

    const links = NAV_LINKS[variant];
    const [activeMega, setActiveMega] = useState<MegaMenuId | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileOpenSection, setMobileOpenSection] = useState<MegaMenuId | null>(null);
    const megaRef = useRef<HTMLDivElement>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-bone/95 shadow-sm backdrop-blur-md" : "bg-bone"
                    } ${variant === "catalog" ? "border-b border-champagne" : ""}`}
                style={{ right: "var(--grace-content-inset, 0px)" }}
            >
                <div className="bg-obsidian py-1.5 text-center px-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-bone font-medium">
                        <span>Free shipping on orders above $99</span>
                        <span className="hidden md:inline"> · Need fitment help? Talk with Grace, AI Bottling Specialist</span>
                    </p>
                </div>

                <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
                    {/* Row 1: desktop = logo | nav | search | actions. mobile = hamburger | actions */}
                    <div className="relative flex h-[56px] items-center gap-2 sm:gap-4 xl:h-[72px] xl:gap-4 2xl:gap-6">
                        <button
                            aria-label="Open menu"
                            className="xl:hidden p-2 -ml-2 text-obsidian hover:text-muted-gold transition-colors shrink-0"
                            onClick={() => setMobileMenuOpen(true)}
                        >
                            <List size={20} weight="regular" />
                        </button>
                        {/* Mobile logo — text, Cormorant, left-aligned */}
                        <Link
                            href="/"
                            className="xl:hidden ml-1 font-cormorant text-lg font-semibold tracking-tight text-obsidian hover:text-muted-gold transition-colors"
                        >
                            BEST BOTTLES
                        </Link>
                        {/* Desktop logo — Cormorant font */}
                        <Link
                            href="/"
                            className="hidden xl:flex shrink-0 xl:mr-2 2xl:mr-4 font-cormorant text-2xl font-semibold tracking-tight text-obsidian hover:text-muted-gold transition-colors"
                        >
                            BEST BOTTLES
                        </Link>
                        <nav
                            className="hidden xl:flex items-center xl:gap-x-6 2xl:gap-x-12 text-sm font-medium text-obsidian tracking-wide normal-case shrink-0"
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
                                            className={`flex items-center gap-1 transition-colors ${isOpen ? "text-muted-gold" : "hover:text-muted-gold"
                                                }`}
                                        >
                                            {link.label}
                                            <CaretDown
                                                className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                                                size={14}
                                            />
                                        </button>

                                        {isOpen && (
                                            <div
                                                className="fixed left-0 right-0 mt-[22px] z-50"
                                                style={{ right: "var(--grace-content-inset, 0px)" }}
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
                                    <Link
                                        key={link.label}
                                        href={link.href}
                                        className="hover:text-muted-gold transition-colors"
                                        onMouseEnter={() => setActiveMega(null)}
                                    >
                                        {link.label}
                                    </Link>
                                );
                            })}
                        </nav>
                        <form
                            onSubmit={handleSearchSubmit}
                            className="group/search relative hidden min-w-0 items-center space-x-2 rounded-xl border border-champagne bg-white/60 px-3 py-2 transition-all duration-200 focus-within:border-muted-gold focus-within:ring-2 focus-within:ring-muted-gold/15 xl:flex xl:min-w-[320px] xl:max-w-[420px] xl:flex-1 2xl:min-w-[520px] 2xl:max-w-[520px]"
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
                                className="bg-transparent text-sm focus:outline-none flex-1 min-w-0 placeholder-slate/60 text-obsidian"
                                aria-label="Search products"
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
                        <div className="hidden xl:flex flex-1" />
                        <div className="ml-auto flex shrink-0 items-center justify-end space-x-2 xl:ml-0">
                            {/* Grace AI trigger removed from navbar in v3 — Grace now opens
                                via the floating bottom-right launcher (GraceLauncher.tsx)
                                so the entry point matches the PRD's collapsed-launcher spec.
                                Mobile keeps the tab-bar Grace button, PDPs keep PdpGraceTrigger. */}

                            <Link href="/sign-in" aria-label="Account" className="hidden xl:flex items-center p-2 hover:text-muted-gold transition-colors">
                                <User className="text-obsidian" size={20} />
                            </Link>

                            <button
                                aria-label="Cart"
                                onClick={() => setCartOpen(true)}
                                className="hidden xl:flex items-center p-2 hover:text-muted-gold transition-colors relative cursor-pointer"
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

                    {/* Row 2: full-width search bar (mobile only) */}
                    {!hideMobileSearch && (
                    <div className="flex xl:hidden pb-3 border-t border-champagne/40 pt-2">
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
                                className="bg-transparent text-sm focus:outline-none flex-1 min-w-0 placeholder-slate/60 text-obsidian"
                                aria-label="Search products"
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

            <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

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
                        onClick={() => setMobileMenuOpen(false)}
                    />
                    <div className="fixed top-0 left-0 bottom-0 z-[61] w-[360px] max-w-[88vw] bg-bone border-r border-champagne shadow-2xl xl:hidden flex flex-col">
                        <div className="h-[44px] bg-obsidian" />
                        <div className="h-[72px] px-4 flex items-center justify-between border-b border-champagne">
                            <Link
                                href="/"
                                onClick={() => setMobileMenuOpen(false)}
                                className="font-cormorant text-2xl font-semibold tracking-tight text-obsidian"
                                data-testid="mobile-menu-wordmark"
                            >
                                BEST BOTTLES
                            </Link>
                            <button
                                aria-label="Close menu"
                                onClick={() => setMobileMenuOpen(false)}
                                className="p-2 text-obsidian hover:text-muted-gold transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-4">
                            <nav className="space-y-2">
                                {links.map((link) => {
                                    if (!("megaId" in link)) {
                                        return (
                                            <Link
                                                key={link.label}
                                                href={link.href}
                                                onClick={() => setMobileMenuOpen(false)}
                                                className="flex items-center justify-between py-3 min-h-[44px] text-sm font-semibold tracking-wide text-obsidian border-b border-champagne/40"
                                            >
                                                {link.label}
                                                <ArrowRight className="text-slate" size={16} />
                                            </Link>
                                        );
                                    }

                                    const isExpanded = mobileOpenSection === link.megaId;
                                    const panel = MEGA_PANELS[link.megaId];

                                    return (
                                        <div key={link.label} className="border-b border-champagne/40 pb-2">
                                            <button
                                                onClick={() => setMobileOpenSection(isExpanded ? null : link.megaId)}
                                                className="w-full flex items-center justify-between py-3 min-h-[44px] text-sm font-semibold tracking-wide text-obsidian"
                                                aria-expanded={isExpanded}
                                            >
                                                {link.label}
                                                <CaretDown className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} size={16} />
                                            </button>
                                            {isExpanded && (
                                                <div className="pb-2 space-y-4">
                                                    <Link
                                                        href={link.href}
                                                        onClick={() => setMobileMenuOpen(false)}
                                                        data-testid="mobile-menu-primary-link"
                                                        className="flex items-center justify-between rounded-sm bg-obsidian px-3 py-3 min-h-[44px] text-xs font-bold uppercase tracking-wider text-white"
                                                    >
                                                        View {link.label}
                                                        <ArrowRight size={14} />
                                                    </Link>
                                                    {panel.columns.map((col) => (
                                                        <div key={col.heading}>
                                                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate font-bold mb-2">
                                                                {col.heading}
                                                            </p>
                                                            <div className="space-y-1">
                                                                {col.links.map((item) => (
                                                                    <Link
                                                                        key={item.label}
                                                                        href={item.href}
                                                                        onClick={() => setMobileMenuOpen(false)}
                                                                        className="flex items-center justify-between py-2 text-[13px] text-obsidian"
                                                                    >
                                                                        <span>{item.label}</span>
                                                                        {item.badge && (
                                                                            <span className="text-[10px] text-slate/60">{item.badge}</span>
                                                                        )}
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="p-4 border-t border-champagne bg-white/60">
                            <Link
                                href="/catalog"
                                onClick={() => setMobileMenuOpen(false)}
                                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-obsidian text-white text-xs uppercase tracking-wider font-bold"
                            >
                                Browse Full Catalog
                                <ArrowRight size={14} />
                            </Link>
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
                                            <Link
                                                href={item.href}
                                                onClick={onClose}
                                                className="group flex items-center justify-between py-1.5 px-2 -mx-2 rounded-md hover:bg-linen transition-colors duration-150"
                                            >
                                                <span className="text-[13px] text-obsidian normal-case font-normal group-hover:text-muted-gold transition-colors">
                                                    {item.label}
                                                </span>
                                                {item.badge && (
                                                    <span className="text-[10px] text-slate/60 font-medium tabular-nums">
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* Featured Card */}
                    <Link
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
                                        unoptimized
                                    />
                                </div>
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-white/70 flex items-center justify-center mb-4 shadow-sm">
                                    <FeaturedIcon className="text-muted-gold" size={20} />
                                </div>
                            )}
                            <h4 className="font-serif text-lg text-obsidian font-medium normal-case mb-2 group-hover:text-muted-gold transition-colors">
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
                    </Link>
                </div>

                {/* Footer Links */}
                <div className="border-t border-champagne/50 mt-6 pt-4 flex items-center justify-between">
                    {panel.footerLinks.map((fl) => (
                        <Link
                            key={fl.label}
                            href={fl.href}
                            onClick={onClose}
                            className="text-[11px] uppercase tracking-wider text-slate hover:text-muted-gold transition-colors font-semibold normal-case flex items-center gap-1"
                        >
                            {fl.label}
                            <ArrowRight size={12} />
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
