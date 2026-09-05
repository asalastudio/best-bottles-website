"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, X } from "@/components/icons";
import { productCardVariantHref, type ProductCardVariantPreview } from "@/lib/products/product-card-variant-previews";
import { catalogCapPhotoFrame } from "@/lib/products/catalog-cap-photos";

function CapPhoto({ url, size, onError }: { url: string; size: number; onError: () => void }) {
    const frame = catalogCapPhotoFrame(url);
    return <span className="relative block shrink-0 overflow-hidden" style={{ width: "100%", maxWidth: size, aspectRatio: "1 / 1" }}>
        <Image src={url} alt="" width={size} height={size} unoptimized onError={onError}
            className={frame ? "absolute max-w-none" : "h-full w-full object-contain"} style={frame} />
    </span>;
}

type Props = {
    title: string;
    href: string;
    variants: ProductCardVariantPreview[];
    photo: (variant: ProductCardVariantPreview) => string | undefined;
    onImageError: (url: string) => void;
};

export default function CatalogCapOptions({ title, href, variants, photo, onImageError }: Props) {
    const panel = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement | null>(null);
    const id = useId();
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 400 });
    const visible = variants.filter((variant) => photo(variant)).slice(0, 4);
    const hiddenCount = variants.length - visible.length;

    useEffect(() => {
        if (!open) return;
        const close = (event: Event) => {
            if (event.target instanceof Node && panel.current?.contains(event.target)) return;
            panel.current?.hidePopover();
        };
        window.addEventListener("resize", close);
        return () => {
            window.removeEventListener("resize", close);
        };
    }, [open]);

    function showOptions(event: React.MouseEvent<HTMLButtonElement>) {
        trigger.current = event.currentTarget;
        const rect = event.currentTarget.closest("[data-cap-rail]")!.getBoundingClientRect();
        const width = Math.min(340, window.innerWidth - 24);
        const below = window.innerHeight - rect.bottom - 16;
        const above = rect.top - 16;
        const maxHeight = Math.min(400, Math.max(below, above));
        setPosition({ left: Math.min(Math.max(12, rect.left), window.innerWidth - width - 12),
            top: below >= Math.min(400, above) ? rect.bottom + 8 : Math.max(12, rect.top - maxHeight - 8), maxHeight });
        panel.current?.showPopover();
        panel.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    }

    return <>
        <div data-cap-rail className="px-3 pt-3 sm:px-4">
            <button type="button" onClick={showOptions} aria-expanded={open} aria-controls={id} aria-haspopup="dialog"
                aria-label={`Show all ${variants.length} cap options for ${title}`}
                className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obsidian">
                <span className="block text-[10px] font-semibold uppercase leading-4 tracking-[0.14em] text-obsidian">Cap options · {variants.length}</span>
                <span className="mt-1 grid grid-cols-5 items-center gap-0.5" aria-hidden="true">
                    {visible.map((variant) => {
                        const url = photo(variant)!;
                        return <span key={variant.id} className="flex h-10 min-w-0 items-center justify-center">
                            <CapPhoto url={url} size={40} onError={() => onImageError(url)} />
                        </span>;
                    })}
                    {hiddenCount > 0 && <span className="flex aspect-square w-full max-w-10 items-center justify-center rounded-full border border-champagne text-xs font-medium text-obsidian">+{hiddenCount}</span>}
                </span>
            </button>
        </div>
        <div ref={panel} id={id} popover="auto" role="dialog" aria-label={`Cap options for ${title}`}
            onToggle={(event) => setOpen(event.newState === "open")}
            style={{ ...position, margin: 0, width: "min(340px, calc(100vw - 24px))" }}
            className="fixed overflow-y-auto rounded border border-champagne bg-white p-4 shadow-xl backdrop:bg-transparent">
            <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Cap options · {variants.length}</p>
                <button type="button" aria-label="Close cap options" onClick={() => { panel.current?.hidePopover(); trigger.current?.focus({ preventScroll: true }); }} className="flex h-8 w-8 items-center justify-center"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-4 gap-2">{variants.map((variant) => {
                const url = photo(variant);
                return <Link key={variant.id} href={productCardVariantHref(href, variant)} prefetch={false}
                    aria-label={`View ${title} with ${variant.label}`}
                    className="flex min-h-20 min-w-0 flex-col items-center gap-2 rounded-sm border border-transparent p-1.5 text-center hover:border-champagne hover:bg-bone/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obsidian">
                    {url ? <CapPhoto url={url} size={48} onError={() => onImageError(url)} />
                        : <span className="flex h-12 items-center text-[9px] text-slate">Photo unavailable</span>}
                    <span className="text-[11px] leading-tight text-obsidian">{variant.label}</span>
                </Link>;
            })}</div>
            <Link href={href} className="mt-4 flex min-h-11 items-center justify-between border-t border-champagne pt-3 text-[10px] font-semibold uppercase tracking-wider">View full configuration <ArrowRight className="h-4 w-4" /></Link>
        </div>
    </>;
}
