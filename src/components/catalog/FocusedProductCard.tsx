import Link from "next/link";
import ProductCardImagePreview from "@/components/products/ProductCardImagePreview";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { getProductCardVariantPreviews } from "@/lib/products/product-card-variant-previews";
import type { GuidedFinderProduct } from "@/lib/products/guided-finder";
import { safeCatalogReturnPath } from "@/components/catalog/FinderNavigationMemory";

type FocusedProductCardProps = {
    product: GuidedFinderProduct;
    finderUrl: string;
    onOpen?: (product: GuidedFinderProduct) => void;
};

const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
});

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
    const productTitle = getCustomerFacingProductName({
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

    return (
        <article className="group/catalog-card flex h-full flex-col bg-warm-white focus-within:relative focus-within:z-10 focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-muted-gold">
            <ProductCardImagePreview
                productTitle={productTitle}
                defaultImage={{ url: product.imageUrl, alt: productTitle }}
                placeholderLabel="Product media in preparation"
                variantPreviews={previews}
                productHref={productHref}
                onOpen={() => onOpen?.(product)}
                maxVisibleSwatches={3}
                auditMeta={{
                    surface: "focused-finder-card",
                    family: product.family,
                    shopifyVariantId: product.shopifyVariantId,
                }}
            />
            <Link href={productHref} onClick={() => onOpen?.(product)} className="flex flex-1 flex-col px-4 pb-5 pt-4 focus-visible:outline-none">
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
                <p className="mt-auto pt-5 text-sm font-semibold text-obsidian">
                    {product.startingUnitPrice != null
                        ? `From ${price.format(product.startingUnitPrice)}/ea`
                        : "Request pricing"}
                </p>
            </Link>
        </article>
    );
}
