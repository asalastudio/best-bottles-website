"use client";

import { useState } from "react";
import Link from "next/link";
import type { RailFamily } from "@/lib/grace/workspaceRailTypes";

function FamilyThumbnail({ family }: { family: RailFamily }) {
    const [failed, setFailed] = useState<string[]>([]);
    const image = family.images.find(candidate => !failed.includes(candidate.url));
    return <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[2px] border border-white/15 bg-[#f5f3ef]">
        {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- editorial and live catalog CDN sources, with a same-family fallback chain
            <img src={image.url} alt={`${family.family} products`} width={64} height={64} loading="lazy"
                className={`h-full w-full ${image.kind === "editorial" ? "object-cover" : "object-contain"}`}
                onError={() => setFailed(previous => [...previous, image.url])} />
        ) : <span className="px-1 text-center text-[9px] leading-tight text-slate">Image unavailable</span>}
    </span>;
}

export default function WorkspaceFamilies({ families }: { families: RailFamily[] }) {
    return <nav aria-label="Browse by family" data-workspace-families className="normal-case tracking-normal">
        <div className="flex items-center justify-between px-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
            <span>Browse by family</span><span>{families.length || ""}</span>
        </div>
        <div className="mt-1.5">
            {families.map(family => <Link key={family.family}
                href={`/catalog?families=${encodeURIComponent(family.family)}`}
                className="flex items-center gap-3 rounded-[2px] px-1.5 py-[7px] transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-muted-gold"
                title={`Browse all ${family.family} products`}>
                <FamilyThumbnail family={family} />
                <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-snug text-white/[0.88]">{family.family}</span>
                    <span className="mt-0.5 block text-[10.5px] tabular-nums text-white/50">{family.variantCount} {family.variantCount === 1 ? "variant" : "variants"}</span>
                </span>
            </Link>)}
            <Link href="/catalog?scope=all" className="mt-1 block rounded-[2px] px-1.5 py-2 text-[11px] font-medium text-white/60 hover:bg-white/[0.06] hover:text-white">View all products →</Link>
        </div>
    </nav>;
}
