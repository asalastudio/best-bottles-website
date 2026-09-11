"use client";

/**
 * Family landing-page hero carousel. One slide visible at a time with a
 * crossfade; previous/next buttons, dot indicators, arrow keys, and a gentle
 * auto-advance that pauses on hover/focus and is off entirely for
 * prefers-reduced-motion. Single-slide families never mount this.
 */

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CaretLeft, CaretRight } from "@/components/icons";
import type { FamilyHeroImage } from "@/lib/products/family-hero-images";

export const FAMILY_HERO_SLIDE_INTERVAL_MS = 6000;

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold";

export type FamilyHeroSliderProps = {
    family: string;
    slides: readonly FamilyHeroImage[];
    /** Match the parent hero's `sizes` so Next serves the same widths as the static hero. */
    sizes?: string;
};

export default function FamilyHeroSlider({ family, slides, sizes = "(max-width: 1024px) 100vw, 55vw" }: FamilyHeroSliderProps) {
    const baseId = useId();
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);
    const regionRef = useRef<HTMLDivElement>(null);
    const count = slides.length;

    useEffect(() => {
        const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
        if (!query) return;
        const sync = () => setReducedMotion(query.matches);
        sync();
        query.addEventListener?.("change", sync);
        return () => query.removeEventListener?.("change", sync);
    }, []);

    const go = useCallback((next: number) => {
        setIndex(((next % count) + count) % count);
    }, [count]);

    useEffect(() => {
        if (count < 2 || paused || reducedMotion) return;
        // Global timers (not window.*) so test fake timers and browsers see the same clock.
        const timer = setInterval(() => {
            if (document.visibilityState === "hidden") return;
            setIndex((current) => (current + 1) % count);
        }, FAMILY_HERO_SLIDE_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [count, paused, reducedMotion]);

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "ArrowRight") { event.preventDefault(); go(index + 1); }
        else if (event.key === "ArrowLeft") { event.preventDefault(); go(index - 1); }
        else if (event.key === "Home") { event.preventDefault(); go(0); }
        else if (event.key === "End") { event.preventDefault(); go(count - 1); }
    };

    return (
        <div
            ref={regionRef}
            role="region"
            aria-roledescription="carousel"
            aria-label={`${family} product photography`}
            data-testid="family-hero-slider"
            className="group relative h-full min-h-[340px] w-full overflow-hidden bg-travertine sm:min-h-[460px]"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}
            onKeyDown={onKeyDown}
        >
            <div aria-live="polite" aria-atomic="true" className="sr-only">
                Slide {index + 1} of {count}: {slides[index]?.alt}
            </div>
            {slides.map((slide, slideIndex) => {
                const active = slideIndex === index;
                return (
                    <div
                        key={slide.src}
                        id={`${baseId}-slide-${slideIndex}`}
                        role="group"
                        aria-roledescription="slide"
                        aria-label={`${slideIndex + 1} of ${count}`}
                        aria-hidden={!active}
                        data-testid="family-hero-slide"
                        data-active={active ? "true" : "false"}
                        className={`absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}
                    >
                        <Image
                            src={slide.src}
                            alt={slide.alt}
                            fill
                            priority={slideIndex === 0}
                            unoptimized={slide.src.startsWith("http")}
                            className="object-cover"
                            sizes={sizes}
                        />
                    </div>
                );
            })}
            {count > 1 && (
                <>
                    <button
                        type="button"
                        onClick={() => go(index - 1)}
                        aria-label="Previous slide"
                        data-testid="family-hero-prev"
                        className={`absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-obsidian shadow-sm backdrop-blur transition-colors hover:bg-white motion-reduce:transition-none ${FOCUS_RING}`}
                    >
                        <CaretLeft className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                        type="button"
                        onClick={() => go(index + 1)}
                        aria-label="Next slide"
                        data-testid="family-hero-next"
                        className={`absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-obsidian shadow-sm backdrop-blur transition-colors hover:bg-white motion-reduce:transition-none ${FOCUS_RING}`}
                    >
                        <CaretRight className="h-4 w-4" aria-hidden />
                    </button>
                    <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2" role="tablist" aria-label="Choose slide">
                        {slides.map((slide, slideIndex) => {
                            const active = slideIndex === index;
                            return (
                                <button
                                    key={slide.src}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    aria-controls={`${baseId}-slide-${slideIndex}`}
                                    aria-label={`Show slide ${slideIndex + 1} of ${count}`}
                                    data-testid="family-hero-dot"
                                    onClick={() => go(slideIndex)}
                                    className={`flex h-11 w-8 items-center justify-center ${FOCUS_RING}`}
                                >
                                    <span aria-hidden className={`block h-2 rounded-full transition-all motion-reduce:transition-none ${active ? "w-6 bg-obsidian" : "w-2 bg-obsidian/40"}`} />
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
