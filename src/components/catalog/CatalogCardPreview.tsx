"use client";

import ProductCardImagePreview from "@/components/products/ProductCardImagePreview";
import type { CatalogHero } from "@/lib/products/catalog-heroes";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Package } from "@/components/icons";
import { catalogCapPhoto, CATALOG_CAP_FAMILY, type CatalogCapKind } from "@/lib/products/catalog-cap-photos";
import CatalogCapOptions from "./CatalogCapOptions";
import { resolveCatalogCardVisual } from "@/lib/products/catalog-card-visual";
import type { ProductCardVariantPreview } from "@/lib/products/product-card-variant-previews";

type Props = {
    title: string;
    catalogHero?: CatalogHero | null;
    imageUrl: string | null;
    heroHoverImageUrl?: string | null;
    href: string;
    variants: ProductCardVariantPreview[];
    capKind: CatalogCapKind | null;
    neck: string | null;
    family: string | null;
    slug: string;
};

export default function CatalogCardPreview({ title, catalogHero, imageUrl, href, variants, capKind, neck, family, slug }: Props) {
    const [failed, setFailed] = useState<Set<string>>(() => new Set());
    const canHaveCaps = Boolean(capKind && neck && variants.length > 1);
    const capPlates = useQuery(api.productPlates.byFamily, canHaveCaps
        ? { familyId: `${CATALOG_CAP_FAMILY[capKind!]}-${neck}`, limit: 200 } : "skip");
    const fallbackCaps = useQuery(api.productPlates.byFamily,
        canHaveCaps && (capKind === "plain" || capKind === "pump") && capPlates !== undefined && capPlates.page.length === 0
            ? { familyId: `roll-on-cap-${neck}`, limit: 200 } : "skip");
    const skus = variants.slice(0, 1).map((variant) => variant.websiteSku ?? variant.graceSku).filter((sku): sku is string => Boolean(sku));
    // Bottle imagery must remain available even when there is no cap chooser.
    const assemblyPlates = useQuery(api.productPlates.forSkus, skus.length ? { skus } : "skip");
    const rows = [...(capPlates?.page ?? []), ...(fallbackCaps?.page ?? [])];
    const photo = (variant: ProductCardVariantPreview) => capKind ? catalogCapPhoto(variant, rows, capKind, failed) : undefined;
    const assembly = (variant: ProductCardVariantPreview) => {
        const plate = assemblyPlates?.plates[variant.websiteSku ?? variant.graceSku ?? ""];
        return [plate?.thumb, variant.imageUrl].find((url) => url && !failed.has(url));
    };
    const photographed = variants.filter((variant) => {
        const url = photo(variant);
        return url && !failed.has(url);
    });
    // Only products with multiple actual cap photos get an interactive cap rail.
    const showRail = canHaveCaps && photographed.length > 1;
    const visual = resolveCatalogCardVisual({
        heroImageUrl: imageUrl && !failed.has(imageUrl) ? imageUrl : null,
        heroHoverImageUrl: null,
        heroHovered: false,
        fallbackImageUrl: variants[0] ? assembly(variants[0]) : null,
    });
    const displayImage = visual.url;
    const fail = (url: string) => setFailed((current) => new Set(current).add(url));

    const heroFallbackVariant = variants.find(variant => variant.websiteSku === catalogHero?.websiteSku);

    return <div>
        {catalogHero ? <ProductCardImagePreview
            productTitle={title} defaultImage={{ url: heroFallbackVariant?.imageUrl ?? null, alt: title }} catalogHero={catalogHero}
            productHref={href} variantPreviews={[]}
            auditMeta={{ surface: "catalog-card", family, productGroupSlug: slug, websiteSku: heroFallbackVariant?.websiteSku }}
        /> : <Link href={href} aria-label={`View ${title}`} className="relative block aspect-[4/3] w-full overflow-hidden bg-[#f0ebe3] sm:aspect-[10/11]"
            data-visual-mode={visual.mode}
            data-bb-image-audit="catalog-card" data-bb-family={family ?? undefined} data-bb-product-group-slug={slug}
            data-bb-website-sku={variants[0]?.websiteSku}>
            {displayImage ? <Image src={displayImage} alt={title} fill
                unoptimized={displayImage.includes(".public.blob.vercel-storage.com/")}
                className="object-contain" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                onError={() => fail(displayImage)} />
                : <span className="flex h-full flex-col items-center justify-center gap-3 text-xs text-slate"><Package className="h-10 w-10" />Product image coming soon</span>}
        </Link>}
        {showRail && <CatalogCapOptions title={title} href={href} variants={variants}
            photo={(variant) => { const url = photo(variant); return url && !failed.has(url) ? url : undefined; }}
            onImageError={fail} />}
    </div>;
}
