"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Package } from "@/components/icons";
import type { ProductCardVariantPreview } from "@/lib/products/product-card-variant-previews";

type ProductCardImagePreviewProps = {
    productTitle: string;
    defaultImage: {
        url?: string | null;
        alt?: string | null;
    };
    placeholderLabel?: string | null;
    variantPreviews?: ProductCardVariantPreview[];
    productHref: string;
    maxVisibleSwatches?: number;
};

function stopCardNavigation(event: React.SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();
}

function swatchStyle(preview: ProductCardVariantPreview): React.CSSProperties | undefined {
    if (preview.swatchImageUrl) {
        return {
            backgroundImage: `url(${preview.swatchImageUrl})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
        };
    }
    if (preview.swatchColor) return { backgroundColor: preview.swatchColor };
    return undefined;
}

function ProductCardSwatch({
    preview,
    isActive,
    onPreview,
}: {
    preview: ProductCardVariantPreview;
    isActive: boolean;
    onPreview: (preview: ProductCardVariantPreview) => void;
}) {
    return (
        <button
            type="button"
            aria-label={`Preview ${preview.label}`}
            title={preview.label}
            onMouseEnter={() => onPreview(preview)}
            onFocus={() => onPreview(preview)}
            onClick={(event) => {
                stopCardNavigation(event);
                onPreview(preview);
            }}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-obsidian focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
            <span
                className={`relative block h-5 w-5 overflow-hidden rounded-full border ${
                    isActive
                        ? "border-obsidian shadow-[0_0_0_2px_rgba(32,32,32,0.16)]"
                        : "border-champagne/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]"
                } ${preview.swatchColor || preview.swatchImageUrl ? "" : "bg-bone"}`}
                style={swatchStyle(preview)}
                aria-hidden="true"
            >
                {!preview.swatchColor && !preview.swatchImageUrl && (
                    <span className="absolute inset-x-1/2 top-0 h-full w-px -rotate-45 bg-slate/50" />
                )}
            </span>
        </button>
    );
}

function ProductCardSwatchRow({
    variants,
    activeVariantId,
    maxVisible,
    onPreview,
}: {
    variants: ProductCardVariantPreview[];
    activeVariantId: string | null;
    maxVisible: number;
    onPreview: (preview: ProductCardVariantPreview) => void;
}) {
    const visible = variants.slice(0, maxVisible);
    const hiddenCount = Math.max(variants.length - maxVisible, 0);

    if (variants.length <= 1) return null;

    return (
        <div className="flex min-h-11 items-center gap-1.5 border-t border-champagne/30 bg-white px-4" aria-label="Variant color previews">
            {visible.map((preview) => (
                <ProductCardSwatch
                    key={preview.id}
                    preview={preview}
                    isActive={activeVariantId === preview.id}
                    onPreview={onPreview}
                />
            ))}
            {hiddenCount > 0 && (
                <span className="ml-1 inline-flex h-6 items-center rounded-full border border-champagne/70 bg-bone px-2 text-[10px] font-semibold text-slate">
                    +{hiddenCount}
                </span>
            )}
        </div>
    );
}

export default function ProductCardImagePreview({
    productTitle,
    defaultImage,
    placeholderLabel,
    variantPreviews = [],
    productHref,
    maxVisibleSwatches = 3,
}: ProductCardImagePreviewProps) {
    const previews = useMemo(
        () => variantPreviews.filter((preview) => preview.id && (preview.imageUrl || preview.swatchColor || preview.swatchImageUrl)),
        [variantPreviews],
    );
    const [activePreviewId, setActivePreviewId] = useState<string | null>(previews[0]?.id ?? null);

    const activePreview = previews.find((preview) => preview.id === activePreviewId) ?? previews[0] ?? null;
    const displayImage = activePreview?.imageUrl
        ? {
            url: activePreview.imageUrl,
            alt: activePreview.imageAlt ?? `${productTitle} - ${activePreview.label}`,
        }
        : {
            url: defaultImage.url ?? null,
            alt: defaultImage.alt ?? productTitle,
        };

    const handlePreview = (preview: ProductCardVariantPreview) => {
        setActivePreviewId(preview.id);
    };

    return (
        <div>
            <div className="relative aspect-[10/11] w-full overflow-hidden bg-[#efe2d0]">
                <Link
                    href={productHref}
                    className="absolute inset-0 z-10"
                    aria-label={`View ${productTitle}`}
                />
                {displayImage.url ? (
                    <Image
                        key={displayImage.url}
                        src={displayImage.url}
                        alt={displayImage.alt ?? productTitle}
                        fill
                        className="object-contain transition duration-500 ease-out group-hover/catalog-card:scale-[1.03]"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                        unoptimized
                    />
                ) : (
                    <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                        <Package className="mb-3 h-12 w-12 text-champagne" strokeWidth={1} />
                        <p className="max-w-[120px] text-[10px] font-medium uppercase leading-tight tracking-wider text-slate/60">
                            {placeholderLabel}
                        </p>
                    </div>
                )}

            </div>
            <ProductCardSwatchRow
                variants={previews}
                activeVariantId={activePreview?.id ?? null}
                maxVisible={maxVisibleSwatches}
                onPreview={handlePreview}
            />
        </div>
    );
}
