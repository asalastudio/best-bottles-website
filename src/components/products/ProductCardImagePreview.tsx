"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Package } from "@/components/icons";
import {
    getProductCardPreviewAccessibleLabel,
    type ProductCardVariantPreview,
} from "@/lib/products/product-card-variant-previews";
import { getMaterialSwatchStyle } from "@/lib/products/material-swatches";
import { resolveImageWithFallback } from "@/lib/products/image-fallback";
import { getCylinderHeroStyle, type CylinderCatalogHero } from "@/lib/products/cylinder-catalog-heroes";

import styles from "./ProductCardImagePreview.module.css";

type ProductCardImagePreviewProps = {
    productTitle: string;
    defaultImage: {
        url?: string | null;
        alt?: string | null;
    };
    placeholderLabel?: string | null;
    catalogHero?: CylinderCatalogHero | null;
    variantPreviews?: ProductCardVariantPreview[];
    productHref: string;
    onOpen?: () => void;
    maxVisibleSwatches?: number;
    auditMeta?: {
        surface: string;
        family?: string | null;
        productGroupSlug?: string | null;
        graceSku?: string | null;
        websiteSku?: string | null;
        shopifyVariantId?: string | null;
    };
};

function stopCardNavigation(event: React.SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();
}

function swatchStyle(preview: ProductCardVariantPreview): React.CSSProperties | undefined {
    const style = getMaterialSwatchStyle(preview.label, {
        fallbackColor: preview.swatchColor,
        imageUrl: preview.swatchImageUrl,
    });
    return Object.keys(style).length ? style : undefined;
}

function ProductCardSwatch({
    preview,
    productTitle,
    index,
    isActive,
    onPreview,
}: {
    preview: ProductCardVariantPreview;
    productTitle: string;
    index: number;
    isActive: boolean;
    onPreview: (preview: ProductCardVariantPreview) => void;
}) {
    return (
        <button
            type="button"
            aria-label={getProductCardPreviewAccessibleLabel(preview, productTitle, index)}
            title={preview.label}
            aria-pressed={isActive}
            onMouseEnter={() => onPreview(preview)}
            onFocus={() => onPreview(preview)}
            onClick={(event) => {
                stopCardNavigation(event);
                onPreview(preview);
            }}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-obsidian focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
            <span
                className={`relative block h-5 w-5 overflow-hidden rounded-full border ${
                    isActive
                        ? "border-obsidian shadow-[0_0_0_2px_rgba(32,32,32,0.16),inset_0_1px_1px_rgba(255,255,255,0.48)]"
                        : "border-champagne/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.65),inset_0_-2px_5px_rgba(32,32,32,0.12)]"
                } ${preview.swatchColor || preview.swatchImageUrl ? "" : "bg-bone"}`}
                style={swatchStyle(preview)}
                aria-hidden="true"
            >
                {(preview.swatchColor || preview.swatchImageUrl) && (
                    <span className="absolute inset-[2px] rounded-full bg-[radial-gradient(circle_at_32%_24%,rgba(255,255,255,0.78),rgba(255,255,255,0)_42%)]" />
                )}
                {!preview.swatchColor && !preview.swatchImageUrl && (
                    <span className="absolute inset-x-1/2 top-0 h-full w-px -rotate-45 bg-slate/50" />
                )}
            </span>
        </button>
    );
}

function ProductCardStaticSwatch({
    preview,
}: {
    preview: ProductCardVariantPreview;
}) {
    return (
        <span
            title={`${preview.label} option`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            aria-hidden="true"
        >
            <span
                className={`relative block h-5 w-5 overflow-hidden rounded-full border border-champagne/60 opacity-75 shadow-[inset_0_1px_1px_rgba(255,255,255,0.65),inset_0_-2px_5px_rgba(32,32,32,0.10)] ${
                    preview.swatchColor || preview.swatchImageUrl ? "" : "bg-bone"
                }`}
                style={swatchStyle(preview)}
                aria-hidden="true"
            >
                {(preview.swatchColor || preview.swatchImageUrl) && (
                    <span className="absolute inset-[2px] rounded-full bg-[radial-gradient(circle_at_32%_24%,rgba(255,255,255,0.72),rgba(255,255,255,0)_42%)]" />
                )}
                {!preview.swatchColor && !preview.swatchImageUrl && (
                    <span className="absolute inset-x-1/2 top-0 h-full w-px -rotate-45 bg-slate/50" />
                )}
            </span>
        </span>
    );
}

function ProductCardSwatchRow({
    previewableVariants,
    staticVariants,
    productTitle,
    activeVariantId,
    maxVisible,
    onPreview,
}: {
    previewableVariants: ProductCardVariantPreview[];
    staticVariants: ProductCardVariantPreview[];
    productTitle: string;
    activeVariantId: string | null;
    maxVisible: number;
    onPreview: (preview: ProductCardVariantPreview) => void;
}) {
    const variants = [...previewableVariants, ...staticVariants];
    const visible = variants.slice(0, maxVisible);
    const hiddenCount = Math.max(variants.length - maxVisible, 0);

    if (variants.length <= 1) return null;

    return (
        <div className="flex min-h-11 items-center gap-0.5 border-t border-champagne/30 bg-white px-2 sm:px-4" aria-label="Available variant previews">
            {visible.map((preview, index) => (
                preview.imageUrl ? (
                    <ProductCardSwatch
                        key={preview.id}
                        preview={preview}
                        productTitle={productTitle}
                        index={index}
                        isActive={activeVariantId === preview.id}
                        onPreview={onPreview}
                    />
                ) : (
                    <ProductCardStaticSwatch key={preview.id} preview={preview} />
                )
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
    catalogHero,
    variantPreviews = [],
    productHref,
    onOpen,
    maxVisibleSwatches = 3,
    auditMeta,
}: ProductCardImagePreviewProps) {
    const previews = useMemo(
        () => variantPreviews.filter((preview) => preview.id && (preview.imageUrl || preview.swatchColor || preview.swatchImageUrl)),
        [variantPreviews],
    );
    const previewablePreviews = useMemo(
        () => previews.filter((preview) => preview.imageUrl),
        [previews],
    );
    const staticPreviews = useMemo(
        () => previews.filter((preview) => !preview.imageUrl),
        [previews],
    );
    const fixedHero = Boolean(catalogHero);
    const [loadedHoverUrl, setLoadedHoverUrl] = useState<string | null>(null);
    const [selection, setSelection] = useState<{ productHref: string; id: string } | null>(null);
    const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());

    const selectedPreview = selection?.productHref === productHref
        ? previewablePreviews.find((preview) => preview.id === selection.id) ?? null
        : null;
    const activePreview = fixedHero ? null : selectedPreview ?? (catalogHero ? null : previewablePreviews[0] ?? null);
    const firstPreview = previewablePreviews[0];
    const legacyImage = {
        url: defaultImage.url ?? firstPreview?.imageUrl ?? null,
        alt: defaultImage.alt ?? firstPreview?.imageAlt ?? productTitle,
        graceSku: auditMeta?.graceSku ?? firstPreview?.graceSku ?? null,
        websiteSku: auditMeta?.websiteSku ?? firstPreview?.websiteSku ?? null,
        shopifyVariantId: auditMeta?.shopifyVariantId ?? null,
    };
    const defaultPhoto = catalogHero ?? legacyImage;
    const displayImage = activePreview?.imageUrl
        ? {
            url: activePreview.imageUrl,
            alt: activePreview.imageAlt ?? `${productTitle} - ${activePreview.label}`,
            graceSku: activePreview.graceSku ?? auditMeta?.graceSku ?? null,
            websiteSku: activePreview.websiteSku ?? activePreview.sku ?? auditMeta?.websiteSku ?? null,
            shopifyVariantId: activePreview.shopifyVariantId ?? null,
        }
        : defaultPhoto;
    const fallbackPhoto = fixedHero ? defaultPhoto : [defaultPhoto, legacyImage].find((photo) =>
        photo.url && photo.url !== displayImage.url && !failedImages.has(photo.url),
    ) ?? legacyImage;
    const fallbackImageUrl = fallbackPhoto.url !== displayImage.url ? fallbackPhoto.url : null;
    const resolvedImageUrl = resolveImageWithFallback(displayImage.url, failedImages, fallbackImageUrl);
    const resolvedPhoto = resolvedImageUrl === displayImage.url ? displayImage : fallbackPhoto;
    const resolvedImageAlt = resolvedPhoto.alt;
    const isStudioHero = Boolean(catalogHero && resolvedImageUrl === catalogHero.url);
    const hoverReady = Boolean(isStudioHero && catalogHero && loadedHoverUrl === catalogHero.hoverUrl && !failedImages.has(catalogHero.hoverUrl));

    const markImageFailed = (url: string) => {
        setFailedImages((current) => {
            if (current.has(url)) return current;
            const next = new Set(current);
            next.add(url);
            return next;
        });
    };

    const handlePreview = (preview: ProductCardVariantPreview) => {
        setSelection({ productHref, id: preview.id });
    };

    return (
        <div
            onMouseLeave={() => { if (catalogHero) setSelection(null); }}
            onBlur={(event) => {
                if (catalogHero && !event.currentTarget.contains(event.relatedTarget as Node | null)) setSelection(null);
            }}
        >
            <div
                className={`relative w-full overflow-hidden ${catalogHero ? `aspect-[10/11] ${styles.heroFrame}` : "aspect-[4/3] sm:aspect-[10/11] bg-[#efe2d0]"}`}
                data-bb-image-audit={auditMeta?.surface}
                data-hover-ready={hoverReady ? "true" : "false"}
                data-bb-family={auditMeta?.family ?? undefined}
                data-bb-product-group-slug={auditMeta?.productGroupSlug ?? undefined}
                data-bb-grace-sku={resolvedPhoto.graceSku ?? undefined}
                data-bb-website-sku={resolvedPhoto.websiteSku ?? undefined}
                data-bb-shopify-variant-id={resolvedPhoto.shopifyVariantId ?? undefined}
                data-bb-studio-hero={isStudioHero ? "true" : undefined}
            >
                <Link
                    href={productHref}
                    onClick={onOpen}
                    className="absolute inset-0 z-10"
                    aria-label={`View ${productTitle}`}
                />
                {resolvedImageUrl ? (
                    <Image
                        key={resolvedImageUrl}
                        src={resolvedImageUrl}
                        alt={resolvedImageAlt ?? productTitle}
                        fill
                        data-bb-image-audit={auditMeta?.surface}
                        data-bb-family={auditMeta?.family ?? undefined}
                        data-bb-product-group-slug={auditMeta?.productGroupSlug ?? undefined}
                        data-bb-grace-sku={resolvedPhoto.graceSku ?? undefined}
                        data-bb-website-sku={resolvedPhoto.websiteSku ?? undefined}
                        data-bb-shopify-variant-id={resolvedPhoto.shopifyVariantId ?? undefined}
                        className={isStudioHero ? "object-contain" : "object-contain transition duration-500 ease-out group-hover/catalog-card:scale-[1.03]"}
                        style={isStudioHero && catalogHero ? getCylinderHeroStyle(catalogHero) : undefined}
                        data-bb-hero-state={isStudioHero ? "empty" : undefined}
                        sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 320px"
                        onError={() => markImageFailed(resolvedImageUrl)}
                    />
                ) : (
                    <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                        <Package className="mb-3 h-12 w-12 text-champagne" strokeWidth={1} />
                        <p className="max-w-[120px] text-[10px] font-medium uppercase leading-tight tracking-wider text-slate/60">
                            {placeholderLabel}
                        </p>
                    </div>
                )}

                {isStudioHero && catalogHero && !failedImages.has(catalogHero.hoverUrl) && (
                    <Image
                        key={catalogHero.hoverUrl}
                        src={catalogHero.hoverUrl}
                        alt=""
                        aria-hidden="true"
                        fill
                        className={`object-contain ${styles.filled}`}
                        style={getCylinderHeroStyle(catalogHero, "filled")}
                        data-bb-hero-state="filled"
                        sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 320px"
                        onLoad={() => setLoadedHoverUrl(catalogHero.hoverUrl)}
                        onError={() => markImageFailed(catalogHero.hoverUrl)}
                    />
                )}

            </div>
            <ProductCardSwatchRow
                previewableVariants={fixedHero ? [] : previewablePreviews}
                staticVariants={fixedHero ? previews.map((preview) => ({ ...preview, imageUrl: undefined })) : staticPreviews}
                productTitle={productTitle}
                activeVariantId={activePreview?.id ?? null}
                maxVisible={maxVisibleSwatches}
                onPreview={handlePreview}
            />
        </div>
    );
}
