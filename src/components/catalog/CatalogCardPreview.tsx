"use client";

import ProductCardImagePreview from "@/components/products/ProductCardImagePreview";
import { getCatalogHeroStyle, type CatalogHero } from "@/lib/products/catalog-heroes";
import { capSwapFraming, capSwapPlateBox, capSwapPlateUrl } from "@/lib/products/catalog-cap-swap";
import { useEffect, useState } from "react";
import Image from "next/image";
import LocaleLink from "@/components/LocaleLink";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Package } from "@/components/icons";
import { resolveCatalogCardVisual } from "@/lib/products/catalog-card-visual";
import type { ProductCardVariantPreview } from "@/lib/products/product-card-variant-previews";

type Props = {
    title: string;
    catalogHero?: CatalogHero | null;
    imageUrl: string | null;
    heroHoverImageUrl?: string | null;
    href: string;
    variants: ProductCardVariantPreview[];
    family: string | null;
    slug: string;
    /**
     * A cap the buyer picked on the card that is not the one pictured by
     * default. On a hero card its own SKU plate is drawn in the hero's frame
     * (see catalog-cap-swap.ts); with no calibrated plate for that SKU the
     * hero stays (never borrow another finish's photo, never show a mismatch).
     */
    selected?: ProductCardVariantPreview | null;
};

function skuOf(variant: ProductCardVariantPreview | null | undefined): string | null {
    return variant?.websiteSku ?? variant?.graceSku ?? null;
}

export default function CatalogCardPreview({ title, catalogHero, imageUrl, heroHoverImageUrl, href, variants, family, slug, selected = null }: Props) {
    const [heroHovered, setHeroHovered] = useState(false);
    const [failed, setFailed] = useState<Set<string>>(() => new Set());
    const skus = [...new Set([skuOf(variants[0]), skuOf(selected)].filter((sku): sku is string => Boolean(sku)))];
    // Bottle imagery must remain available even when there is no hero.
    const assemblyPlates = useQuery(api.productPlates.forSkus, skus.length ? { skus } : "skip");
    const assembly = (variant: ProductCardVariantPreview) => {
        const plate = assemblyPlates?.plates[skuOf(variant) ?? ""];
        return [plate?.thumb, variant.imageUrl].find((url) => url && !failed.has(url));
    };
    const visual = resolveCatalogCardVisual({
        heroImageUrl: imageUrl && !failed.has(imageUrl) ? imageUrl : null,
        heroHoverImageUrl: heroHoverImageUrl && !failed.has(heroHoverImageUrl) ? heroHoverImageUrl : null,
        heroHovered,
        fallbackImageUrl: variants[0] ? assembly(variants[0]) : null,
    });
    const selectedPlate = selected ? assemblyPlates?.plates[skuOf(selected) ?? ""] : undefined;
    // Hero card: the picked cap's plate, placed and lit like the hero. Other
    // cards show plates already, so the picked cap's full plate simply replaces it.
    const heroSwap = catalogHero && selected ? capSwapFraming(catalogHero.url) : null;
    const heroSwapUrl = heroSwap ? capSwapPlateUrl(heroSwap, selectedPlate) : null;
    const swapUrl = catalogHero
        ? undefined
        : selected
            ? [selectedPlate?.image, selected.imageUrl, assembly(selected)].find((url) => url && !failed.has(url))
            : undefined;
    const displayImage = swapUrl ?? visual.url;
    const fail = (url: string) => setFailed((current) => new Set(current).add(url));

    const preloadUrls = heroHoverImageUrl ?? "";
    useEffect(() => {
        if (!preloadUrls) return;
        const images = preloadUrls.split("\n").map((url) => {
            const image = new window.Image();
            image.src = url;
            return image;
        });
        return () => { images.forEach((image) => { image.onload = null; }); };
    }, [preloadUrls]);

    const approvedHero = catalogHero && !("hoverUrl" in catalogHero);
    const exactVariant = variants.find(variant => variant.websiteSku === catalogHero?.websiteSku);

    if (catalogHero && heroSwap && heroSwapUrl && !failed.has(heroSwapUrl)) {
        // bone × the hero's own shadow × the plate. The wrapper carries the bone
        // and the hero's framing so both multiplies blend inside it (a transform
        // seals a blend, so the backdrop must live on the same element).
        return <LocaleLink href={href} aria-label={`View ${title}, ${selected!.label}`}
            className="relative block aspect-[10/11] w-full overflow-hidden bg-[#f5f3ef]"
            data-visual-mode="selected-cap" data-bb-image-audit="catalog-card" data-bb-family={family ?? undefined}
            data-bb-product-group-slug={slug} data-bb-website-sku={skuOf(selected) ?? undefined}>
            <span className="absolute inset-0 block bg-[#f5f3ef]" style={getCatalogHeroStyle(catalogHero)} data-testid="catalog-card-cap-swap">
                <Image src={heroSwap.shadow} alt="" fill unoptimized aria-hidden className="object-fill" style={{ mixBlendMode: "multiply" }} />
                <span className="absolute block" style={{ ...capSwapPlateBox(heroSwap), mixBlendMode: "multiply" }}>
                    <Image key={heroSwapUrl} src={heroSwapUrl} alt={`${title}, ${selected!.label}`} fill unoptimized
                        className="object-fill" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        onError={() => fail(heroSwapUrl)} />
                </span>
            </span>
        </LocaleLink>;
    }

    if (catalogHero) {
        return <ProductCardImagePreview
            productTitle={title} defaultImage={{ url: approvedHero ? exactVariant?.imageUrl ?? null : imageUrl, alt: title }} catalogHero={catalogHero}
            productHref={href} variantPreviews={[]}
            auditMeta={{ surface: "catalog-card", family, productGroupSlug: slug, websiteSku: approvedHero ? exactVariant?.websiteSku : undefined }}
        />;
    }

    return <LocaleLink href={href} aria-label={`View ${title}`} className="relative block aspect-[4/3] w-full overflow-hidden bg-[#f8f6f2] sm:aspect-[10/11]"
        onPointerEnter={(event) => { if (event.pointerType === "mouse") setHeroHovered(true); }}
        onPointerLeave={() => setHeroHovered(false)} data-visual-mode={swapUrl ? "selected-cap" : visual.mode}
        data-bb-image-audit="catalog-card" data-bb-family={family ?? undefined} data-bb-product-group-slug={slug}
        data-bb-website-sku={skuOf(selected) ?? variants[0]?.websiteSku}>
        {displayImage ? <Image key={displayImage} src={displayImage} alt={selected ? `${title}, ${selected.label}` : title} fill
            unoptimized={displayImage.includes(".public.blob.vercel-storage.com/")}
            className="object-contain" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            onError={() => fail(displayImage)} />
            : <span className="flex h-full flex-col items-center justify-center gap-3 text-xs text-slate"><Package className="h-10 w-10" />Product image coming soon</span>}
    </LocaleLink>;
}
