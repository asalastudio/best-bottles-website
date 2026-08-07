"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { resolvePaperDollLayersResult } from "@/lib/paper-doll/render";
import type { RenderablePaperDollFamily, StorefrontPaperDollLayer } from "@/lib/paper-doll/sanity";
import type { PaperDollConfiguration } from "@/lib/paper-doll/types";

/**
 * Display rendition of a released 2080×2288 layer. The Sanity image CDN
 * derives a lossless-alpha webp at display scale (~150–300 KB instead of the
 * 2–4 MB source PNG); non-Sanity URLs pass through untouched.
 */
const RENDITION_WIDTH = 1600;
export function paperDollRenditionUrl(url: string): string {
    if (!url.includes("cdn.sanity.io")) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}w=${RENDITION_WIDTH}&fit=max&fm=webp&q=85`;
}

// One warm per asset URL per session, kicked off after first paint so every
// glass/finish/applicator swap after the first is served from browser cache.
const warmedUrls = new Set<string>();
function preloadFamilyLayers(family: RenderablePaperDollFamily) {
    const urls = (family.layerAssets ?? [])
        .map((layer) => layer?.imageUrl)
        .filter((url): url is string => typeof url === "string" && url.length > 0)
        .map(paperDollRenditionUrl)
        .filter((url) => !warmedUrls.has(url));
    if (urls.length === 0) return;
    const warm = () => {
        for (const url of urls) {
            if (warmedUrls.has(url)) continue;
            warmedUrls.add(url);
            const image = new window.Image();
            image.decoding = "async";
            image.src = url;
        }
    };
    if ("requestIdleCallback" in window) {
        (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(warm);
    } else {
        setTimeout(warm, 400);
    }
}

export default function PaperDollCanvas({
    family,
    selected,
    preview = false,
    capOff = false,
    className = "aspect-[10/11]",
    onFailure,
}: {
    family: RenderablePaperDollFamily;
    selected: PaperDollConfiguration;
    preview?: boolean;
    /** Lift the cap layer so the roller fitment underneath stays visible. */
    capOff?: boolean;
    /** Sizing classes for the canvas box; defaults to the full 10/11 plate. */
    className?: string;
    onFailure?: () => void;
}) {
    const resolution = useMemo(() => resolvePaperDollLayersResult(family, selected), [family, selected]);
    const layers = resolution.ok ? resolution.layers : [];
    const loadIdentity = `${family.assetRevision}:${selected.graceSku}`;
    const [loadState, setLoadState] = useState<{ identity: string; keys: Set<string> }>({ identity: loadIdentity, keys: new Set() });
    const loaded = loadState.identity === loadIdentity ? loadState.keys : new Set<string>();
    const currentReady = layers.length > 0 && loaded.size >= layers.length;

    // Double buffer: the last fully loaded stack stays visible underneath
    // while the next configuration's layers stream in, so swaps never blank
    // the bottle. The blocking "Preparing" state only exists before the very
    // first stack has ever completed.
    const stableRef = useRef<{ identity: string; layers: StorefrontPaperDollLayer[]; capOff: boolean } | null>(null);
    if (currentReady) {
        stableRef.current = { identity: loadIdentity, layers, capOff };
    }
    const stable = stableRef.current;
    const showPrevious = !currentReady && stable !== null && stable.identity !== loadIdentity;

    useEffect(() => {
        preloadFamilyLayers(family);
    }, [family]);

    if (!resolution.ok) return null;

    const renderStack = (
        stack: StorefrontPaperDollLayer[],
        stackCapOff: boolean,
        options: { tracked: boolean; keyPrefix: string },
    ) => stack.map((layer) => {
        const key = `${options.keyPrefix}${layer.slot}:${layer.variantKey}`;
        const markLoaded = options.tracked
            ? () => setLoadState((current) => {
                // Idempotent: ref callbacks re-fire on every render, so an
                // already-recorded key must return the same state object.
                const plainKey = `${layer.slot}:${layer.variantKey}`;
                if (current.identity === loadIdentity && current.keys.has(plainKey)) return current;
                return {
                    identity: loadIdentity,
                    keys: new Set(current.identity === loadIdentity ? current.keys : []).add(plainKey),
                };
            })
            : undefined;
        // The cap stays mounted while lifted so replacing it is instant; it
        // fades and rises out of frame instead of unmounting.
        const lifted = stackCapOff && layer.slot === "cap";
        return (
            <Image
                key={key}
                src={paperDollRenditionUrl(layer.imageUrl)}
                alt=""
                fill
                unoptimized
                sizes="(min-width: 1024px) 52vw, 100vw"
                aria-hidden={lifted || undefined}
                className={`absolute inset-0 object-contain transition-[opacity,transform] duration-300 ease-out ${lifted ? "-translate-y-[6%] opacity-0" : "translate-y-0 opacity-100"}`}
                // Cached images can complete before hydration attaches onLoad;
                // the ref check clears the overlay for those.
                ref={(image) => {
                    if (markLoaded && image?.complete && image.naturalWidth > 0) markLoaded();
                }}
                onLoad={markLoaded}
                onError={onFailure}
            />
        );
    });

    return (
        <div
            className={`relative overflow-hidden border border-champagne/60 bg-travertine ${className}`}
            role="img"
            aria-label={capOff
                ? `${selected.glassLabel} 9 mL Cylinder with ${selected.applicatorLabel}, cap removed to show the roller fitment`
                : `${selected.glassLabel} 9 mL Cylinder with ${selected.applicatorLabel} and ${selected.finishLabel} finish`}
            data-paper-doll-revision={family.assetRevision}
            data-paper-doll-preview={preview ? "true" : undefined}
            data-paper-doll-cap={capOff ? "off" : "on"}
            data-paper-doll-swapping={showPrevious ? "true" : undefined}
        >
            {!currentReady && !stable && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-travertine" aria-live="polite">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate">Preparing your bottle…</span>
                </div>
            )}
            {showPrevious && stable ? renderStack(stable.layers, stable.capOff, { tracked: false, keyPrefix: "stable:" }) : null}
            <div className={`absolute inset-0 transition-opacity duration-200 ${currentReady || !stable ? "opacity-100" : "opacity-0"}`}>
                {renderStack(layers, capOff, { tracked: true, keyPrefix: "" })}
            </div>
        </div>
    );
}
