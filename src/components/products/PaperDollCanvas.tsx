"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { resolvePaperDollLayers } from "@/lib/paper-doll/render";
import type { StorefrontPaperDollFamily } from "@/lib/paper-doll/sanity";
import type { PaperDollConfiguration } from "@/lib/paper-doll/types";

export default function PaperDollCanvas({
    family,
    selected,
    onFailure,
}: {
    family: StorefrontPaperDollFamily;
    selected: PaperDollConfiguration;
    onFailure?: () => void;
}) {
    const layers = useMemo(() => resolvePaperDollLayers(family, selected), [family, selected]);
    const loadIdentity = `${family.assetRevision}:${selected.graceSku}`;
    const [loadState, setLoadState] = useState<{ identity: string; keys: Set<string> }>({ identity: loadIdentity, keys: new Set() });
    const loaded = loadState.identity === loadIdentity ? loadState.keys : new Set<string>();

    return (
        <div
            className="relative aspect-[10/11] overflow-hidden border border-champagne/60 bg-travertine"
            role="img"
            aria-label={`${selected.glassLabel} 9 mL Cylinder with ${selected.applicatorLabel} and ${selected.finishLabel} finish`}
            data-paper-doll-revision={family.assetRevision}
        >
            {loaded.size < layers.length && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-travertine" aria-live="polite">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate">Preparing your bottle…</span>
                </div>
            )}
            {layers.map((layer) => {
                const key = `${layer.slot}:${layer.variantKey}`;
                return (
                    <Image
                        key={key}
                        src={layer.imageUrl}
                        alt=""
                        fill
                        unoptimized
                        sizes="(min-width: 1024px) 52vw, 100vw"
                        className="absolute inset-0 object-contain"
                        onLoad={() => setLoadState((current) => ({
                            identity: loadIdentity,
                            keys: new Set(current.identity === loadIdentity ? current.keys : []).add(key),
                        }))}
                        onError={onFailure}
                    />
                );
            })}
        </div>
    );
}
