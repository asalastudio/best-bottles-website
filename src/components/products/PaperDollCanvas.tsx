"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { resolvePaperDollLayersResult } from "@/lib/paper-doll/render";
import type { RenderablePaperDollFamily } from "@/lib/paper-doll/sanity";
import type { PaperDollConfiguration } from "@/lib/paper-doll/types";

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

    if (!resolution.ok) return null;

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
        >
            {loaded.size < layers.length && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-travertine" aria-live="polite">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate">Preparing your bottle…</span>
                </div>
            )}
            {layers.map((layer) => {
                const key = `${layer.slot}:${layer.variantKey}`;
                const markLoaded = () => setLoadState((current) => {
                    // Idempotent: ref callbacks re-fire on every render, so an
                    // already-recorded key must return the same state object.
                    if (current.identity === loadIdentity && current.keys.has(key)) return current;
                    return {
                        identity: loadIdentity,
                        keys: new Set(current.identity === loadIdentity ? current.keys : []).add(key),
                    };
                });
                // The cap stays mounted while lifted so replacing it is
                // instant; it fades and rises out of frame instead of
                // unmounting.
                const lifted = capOff && layer.slot === "cap";
                return (
                    <Image
                        key={key}
                        src={layer.imageUrl}
                        alt=""
                        fill
                        unoptimized
                        sizes="(min-width: 1024px) 52vw, 100vw"
                        aria-hidden={lifted || undefined}
                        className={`absolute inset-0 object-contain transition-[opacity,transform] duration-300 ease-out ${lifted ? "-translate-y-[6%] opacity-0" : "translate-y-0 opacity-100"}`}
                        // Cached images can complete before hydration attaches
                        // onLoad; the ref check clears the overlay for those.
                        ref={(image) => {
                            if (image?.complete && image.naturalWidth > 0) markLoaded();
                        }}
                        onLoad={markLoaded}
                        onError={onFailure}
                    />
                );
            })}
        </div>
    );
}
