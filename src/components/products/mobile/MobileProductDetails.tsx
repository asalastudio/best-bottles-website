"use client";

/**
 * Secondary information under the mobile configurator (PRD §9): compact
 * disclosure rows instead of the desktop's full-width tables and rails. Native
 * <details>/<summary> gives progressive disclosure, keyboard support, and
 * find-in-page for free; nothing here holds product state — every row reads
 * the same resolved variant the configurator and sticky bar use.
 */
import type { ReactNode } from "react";
import type { ProductVariant } from "@/app/products/[slug]/ProductDetailClient";
import { CaretDown, Flask, Package, Rows, Ruler, Sparkle, Tag, Truck } from "@/components/icons";
import {
    PdpCompatibleComponentList,
    PdpDispenseOptions,
    PdpSizeOptions,
    countPdpSizeOptions,
    useDiscoveryCompatibility,
    type PdpCompatibilityComponent,
    type PdpCompatibilityPayload,
} from "@/components/products/PdpDiscoverySections";
import type { FocusedPdpRelations } from "@/lib/products/pdp-relations";

type IconComponent = typeof Flask;

export type MobileDetailSection = {
    id: string;
    label: string;
    icon: IconComponent;
    summary?: string | null;
    content: ReactNode;
    testId?: string;
};

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
    if (value == null || value === "") return null;
    return (
        <div className="flex items-start justify-between gap-4 border-t border-champagne/60 py-2.5 first:border-t-0">
            <dt className="text-2xs font-semibold uppercase tracking-label text-slate">{label}</dt>
            <dd className="max-w-[58%] text-right text-sm font-medium text-obsidian">{value}</dd>
        </div>
    );
}

export function specificationRows(variant: ProductVariant, sku: string | null, capFinish: string): Array<{ label: string; value: string | number | null | undefined }> {
    return [
        { label: "SKU", value: variant.websiteSku || sku },
        { label: "Capacity", value: variant.capacity },
        { label: "Glass Color", value: variant.color },
        { label: "Neck Thread Size", value: variant.neckThreadSize },
        { label: "Applicator", value: variant.applicator },
        { label: "Ball Material", value: variant.ballMaterial },
        { label: "Cap Style", value: variant.capStyle },
        { label: "Cap Color", value: capFinish },
        { label: "Trim Finish", value: variant.trimColor },
        { label: "Cap Profile", value: variant.componentProfile || variant.capHeight },
        { label: "Bottle Weight", value: variant.bottleWeightG ? `${variant.bottleWeightG}g` : null },
        { label: "Case Quantity", value: variant.caseQuantity ? `${variant.caseQuantity} units/case` : "Confirm before ordering" },
        { label: "Shape", value: variant.shape },
        { label: "Assembly Type", value: variant.assemblyType },
        { label: "Component Group", value: variant.componentGroup },
        { label: "Category", value: variant.category },
        { label: "Collection", value: variant.bottleCollection },
    ];
}

export function dimensionRows(variant: ProductVariant, neckSize: string | null): Array<{ label: string; value: string | null | undefined }> {
    return [
        { label: "Height with cap", value: variant.heightWithCap },
        { label: "Height without cap", value: variant.heightWithoutCap },
        { label: "Diameter", value: variant.diameter },
        { label: "Neck", value: neckSize },
        { label: "Capacity", value: variant.capacity },
    ];
}

function hasAny(rows: Array<{ value: string | number | null | undefined }>): boolean {
    return rows.some((row) => row.value != null && row.value !== "");
}

export function MobileDetailDisclosures({ heading, sections }: { heading: string; sections: MobileDetailSection[] }) {
    if (sections.length === 0) return null;
    return (
        <section aria-labelledby="mobile-pdp-details-heading" data-testid="mobile-pdp-details" className="border-t border-champagne/60 bg-linen pb-6">
            <h2 id="mobile-pdp-details-heading" className="px-4 pb-2 pt-5 font-serif text-[22px] font-medium leading-tight text-obsidian">{heading}</h2>
            <div className="divide-y divide-champagne/60 border-y border-champagne/60 bg-white">
                {sections.map((section) => {
                    const Icon = section.icon;
                    return (
                        <details key={section.id} className="group" data-testid={section.testId ?? `mobile-pdp-details-${section.id}`}>
                            <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bone focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold [&::-webkit-details-marker]:hidden">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] bg-bone text-obsidian ring-1 ring-champagne/70" aria-hidden>
                                    <Icon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium text-obsidian">{section.label}</span>
                                    {section.summary ? <span className="block truncate text-2xs text-slate">{section.summary}</span> : null}
                                </span>
                                <CaretDown className="h-4 w-4 shrink-0 text-slate transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                            </summary>
                            <div className="border-t border-champagne/40 bg-bone/60 px-4 pb-5 pt-3">{section.content}</div>
                        </details>
                    );
                })}
            </div>
        </section>
    );
}

export type MobileProductDetailsProps = {
    variant: ProductVariant | null;
    sku: string | null;
    capFinish: string;
    neckSize: string | null;
    family: string | null | undefined;
    description: string | null;
    relations: FocusedPdpRelations | null;
    initialCompatibility: PdpCompatibilityPayload | null;
    /** The compact tier ladder; the parent owns quantity. */
    volumePricing: ReactNode;
    onAskGrace: () => void;
    onAddComponent: (component: PdpCompatibilityComponent) => void;
};

export default function MobileProductDetails({
    variant, sku, capFinish, neckSize, family, description, relations, initialCompatibility, volumePricing, onAskGrace, onAddComponent,
}: MobileProductDetailsProps) {
    const compatibility = useDiscoveryCompatibility(initialCompatibility, variant?.websiteSku, variant?.graceSku);
    if (!variant) return null;

    const specs = specificationRows(variant, sku, capFinish);
    const dims = dimensionRows(variant, neckSize);
    const sizeCount = countPdpSizeOptions(relations);
    const caseQty = variant.caseQuantity && variant.caseQuantity > 1 ? variant.caseQuantity : null;
    const componentCount = compatibility ? Object.values(compatibility.components).reduce((total, list) => total + list.length, 0) : 0;

    const sections: Array<MobileDetailSection | null> = [
        hasAny(specs) ? {
            id: "specifications",
            label: "Specifications",
            icon: Rows,
            summary: [variant.capacity, variant.color, variant.applicator].filter(Boolean).join(" · ") || null,
            content: <dl>{specs.map((row) => <DetailRow key={row.label} label={row.label} value={row.value} />)}</dl>,
        } : null,
        hasAny(dims.slice(0, 3)) ? {
            id: "dimensions",
            label: "Dimensions",
            icon: Ruler,
            summary: [variant.heightWithCap ? `H ${variant.heightWithCap}` : null, variant.diameter ? `⌀ ${variant.diameter}` : null].filter(Boolean).join(" · ") || null,
            content: <dl>{dims.map((row) => <DetailRow key={row.label} label={row.label} value={row.value} />)}</dl>,
        } : null,
        volumePricing ? {
            id: "volume-pricing",
            label: "Volume Pricing",
            icon: Tag,
            summary: "Quantity breaks and quote thresholds",
            content: <div>{volumePricing}</div>,
            testId: "mobile-pdp-volume-pricing",
        } : null,
        family ? {
            id: "compatible-components",
            label: "Compatible Components",
            icon: Package,
            summary: componentCount > 0 ? `${componentCount} fitment-resolved ${componentCount === 1 ? "part" : "parts"}` : "Resolved from this SKU's neck and fitment",
            content: <PdpCompatibleComponentList compatibility={compatibility} onAskGrace={onAskGrace} onAddComponent={onAddComponent} />,
        } : null,
        family ? {
            id: "uses-applications",
            label: "Uses & Applications",
            icon: Sparkle,
            summary: description ? null : "Other ways to dispense this bottle",
            content: (
                <div className="space-y-4">
                    {description ? <p className="font-serif text-[15px] leading-[1.7] text-obsidian">{description}</p> : null}
                    <div>
                        <p className="text-2xs font-semibold uppercase tracking-label text-muted-gold">Other ways to dispense</p>
                        <div className="mt-2">
                            <PdpDispenseOptions family={family} relations={relations} columns="grid-cols-1" />
                        </div>
                    </div>
                </div>
            ),
        } : null,
        sizeCount > 1 ? {
            id: "sizes",
            label: "Other Sizes",
            icon: Flask,
            summary: `${sizeCount} capacities in this family`,
            content: <PdpSizeOptions relations={relations} />,
        } : null,
        {
            id: "shipping",
            label: "Shipping & Fulfillment",
            icon: Truck,
            summary: "Free shipping over $99",
            content: (
                <dl>
                    <DetailRow label="Availability" value={variant.stockStatus ?? "Confirm availability"} />
                    <DetailRow label="Case quantity" value={caseQty ? `${caseQty.toLocaleString("en-US")} units/case` : "Confirm before ordering"} />
                    <DetailRow label="Shipping" value="Free over $99" />
                    <DetailRow label="Checkout price" value="1-unit rate; quantity breaks confirmed on quote" />
                </dl>
            ),
        },
    ];

    return <MobileDetailDisclosures heading="Product Details" sections={sections.filter((section): section is MobileDetailSection => section !== null)} />;
}
