"use client";

import { useState } from "react";
import LocaleLink from "@/components/LocaleLink";
import CatalogCardPurchase from "@/components/catalog/CatalogCardPurchase";
import CatalogCardPreview from "@/components/catalog/CatalogCardPreview";
import CatalogCapDots, { useCatalogCapPhotos } from "@/components/catalog/CatalogCapDots";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { displayApplicatorName } from "@/lib/catalogFilters";
import { getProductCardVariantPreviews } from "@/lib/products/product-card-variant-previews";
import type { GuidedFinderProduct } from "@/lib/products/guided-finder";
import { safeCatalogReturnPath } from "@/components/catalog/FinderNavigationMemory";

type FocusedProductCardProps = {
    product: GuidedFinderProduct;
    finderUrl: string;
    onOpen?: (product: GuidedFinderProduct) => void;
};

export function buildFocusedProductHref(productHref: string, finderUrl: string): string {
    const safeReturnPath = safeCatalogReturnPath(finderUrl);
    if (!safeReturnPath) return productHref;
    try {
        const url = new URL(productHref, "https://bestbottles.com");
        url.searchParams.set("from", safeReturnPath);
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return productHref;
    }
}

function detailLine(product: GuidedFinderProduct): string {
    return [
        product.capacity,
        product.application,
        product.rollerMaterial ? `${product.rollerMaterial === "metal" ? "Metal" : "Plastic"} roller` : null,
        product.neckFinish ? `${product.neckFinish} neck` : null,
    ].filter(Boolean).join(" · ");
}

export default function FocusedProductCard({ product, finderUrl, onOpen }: FocusedProductCardProps) {
    const productHref = buildFocusedProductHref(product.href, finderUrl);
    const heroTitle = product.catalogHero?.alt ? displayApplicatorName(product.catalogHero.alt) : null;
    const productTitle = heroTitle ?? getCustomerFacingProductName({
        group: {
            family: product.family,
            capacity: product.capacity,
            color: product.color,
            applicatorTypes: product.application ? [product.application] : [],
        },
        variant: {
            itemName: product.displayName,
            applicator: product.application,
            color: product.color,
        },
        fallbackName: product.displayName,
    }).displayName;
    const [pickedCapId, setPickedCapId] = useState<string | null>(null);
    const previews = getProductCardVariantPreviews([{
        id: product.id,
        itemName: productTitle,
        imageUrl: product.imageUrl,
        color: product.color,
        applicator: product.application,
        ballMaterial: product.rollerMaterial,
    }], {
        productTitle,
        defaultImageUrl: product.imageUrl,
        groupColor: product.color,
        productHref,
    });

    const capVariants = product.variantPreviews.length > 0 ? product.variantPreviews : previews;
    const capPhoto = useCatalogCapPhotos({ capKind: product.capKind, neck: product.neckFinish, variants: capVariants });
    const defaultSku = product.purchase?.websiteSku ?? product.purchase?.graceSku ?? null;
    const defaultCap = capVariants.find((variant) => defaultSku && (variant.websiteSku === defaultSku || variant.graceSku === defaultSku)) ?? capVariants[0] ?? null;
    // A dot only swaps the card when that cap can actually be sold from here.
    const pickedCap = capVariants.find((variant) => variant.id === pickedCapId && variant.id !== defaultCap?.id && product.purchaseOptions?.[variant.id]) ?? null;
    const purchase = pickedCap ? product.purchaseOptions![pickedCap.id] : product.purchase;
    const showCapDots = Boolean(product.capKind && product.purchaseOptions && capVariants.length > 0);

    return (
        <article className="group/catalog-card relative flex h-full flex-col bg-warm-white focus-within:z-10 has-[[role=listbox]]:z-20 focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-muted-gold">
            {/* The catalogue's own preview, so the family pages get the
                fitment chooser — the rail that shows this bottle with each
                cap, sprayer or roller it is sold with. The simpler preview
                this replaces had swatches but no way to see the assembly. */}
            <CatalogCardPreview
                title={productTitle}
                catalogHero={product.catalogHero ?? null}
                imageUrl={product.imageUrl}
                href={productHref}
                variants={capVariants}
                family={product.family}
                slug={product.slug}
                selected={pickedCap}
            />
            <LocaleLink href={productHref} onClick={() => onOpen?.(product)} className="flex flex-1 flex-col px-4 pb-5 pt-4 focus-visible:outline-none">
                <h3 className="font-serif text-xl font-medium leading-tight text-obsidian">{productTitle}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate">{detailLine(product)}</p>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-champagne/55 pt-3 text-xs">
                    <div>
                        <dt className="text-slate">Availability</dt>
                        <dd className="mt-0.5 text-obsidian">
                            {product.availability === "in-stock" ? "In stock" : "Confirm availability"}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-slate">Case quantity</dt>
                        <dd className="mt-0.5 text-obsidian">{product.caseQuantity ?? "Confirm"}</dd>
                    </div>
                </dl>
                {product.startingUnitPrice == null ? (
                    <p className="mt-auto pt-5 text-sm font-semibold text-obsidian">Request pricing</p>
                ) : null}
            </LocaleLink>
            {/* Same component, same resolver and the same tier ladder as the
                main catalogue grid. A buyer who arrives through Bottle Families
                was getting a strictly worse version of the same product. */}
            <div className="flex flex-col gap-2.5 border-t border-champagne/55 px-4 pb-4 pt-3">
            {showCapDots && (
                <CatalogCapDots title={productTitle} variants={capVariants} selectedId={pickedCap?.id ?? defaultCap?.id ?? null}
                    onSelect={(variant) => setPickedCapId(variant.id)} photo={capPhoto} />
            )}
            <CatalogCardPurchase
                productId={product.groupId}
                title={productTitle}
                href={productHref}
                variant={purchase}
                groupStartingPrice={product.startingUnitPrice}
                context={{
                    family: product.family,
                    capacity: product.capacity,
                    color: product.color,
                    // The finder does not carry the group's category, and the
                    // cart uses it for reporting rather than for pricing.
                    category: null,
                    neckThreadSize: product.neckFinish,
                }}
            />
            </div>
        </article>
    );
}
