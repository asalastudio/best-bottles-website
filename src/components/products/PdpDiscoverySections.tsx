"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ChatCircle, Package, ShoppingBag } from "@/components/icons";
import { isCheckoutReady } from "@/lib/checkout";
import { APPLICATOR_NAV, catalogHref } from "@/lib/catalogFilters";
import { uniqueSameApplicationSizes, type FocusedPdpRelations, type ProductGroupRelation } from "@/lib/products/pdp-relations";

export interface PdpCompatibilityComponent {
    graceSku: string;
    websiteSku: string | null;
    itemName: string;
    imageUrl: string | null;
    shopifyVariantId: string | null;
    shopifySellable: boolean | null;
    webPrice1pc: number | null;
    webPrice12pc: number | null;
    capColor: string | null;
    stockStatus: string | null;
}

export interface PdpCompatibilityPayload {
    bottle: {
        graceSku: string;
        websiteSku: string;
        itemName: string;
        imageUrl: string | null;
        shopifyVariantId: string | null;
        shopifySellable: boolean | null;
        category: string;
        family: string | null;
        capacity: string | null;
        color: string | null;
        neckThreadSize: string | null;
        applicator: string | null;
        capColor: string | null;
        capStyle: string | null;
        heightWithCap: string | null;
        heightWithoutCap: string | null;
        diameter: string | null;
        bottleWeightG: number | null;
        caseWeightG: number | null;
        caseQuantity: number | null;
        useCaseDescription: string | null;
        webPrice1pc: number | null;
        webPrice10pc: number | null;
        webPrice12pc: number | null;
        stockStatus: string | null;
    };
    componentTypes: string[];
    totalComponents: number;
    components: Record<string, PdpCompatibilityComponent[]>;
}

type PdpDiscoveryContentProps = {
    family: string;
    relations: FocusedPdpRelations | null;
    compatibility: PdpCompatibilityPayload | null;
    onAskGrace: () => void;
    onAddComponent: (component: PdpCompatibilityComponent) => void;
};

function formatPrice(price: number | null): string {
    return price == null ? "Price on request" : `$${price.toFixed(2)} /ea`;
}

function sizeChipLabel(relation: ProductGroupRelation): string {
    return relation.capacityMl != null ? `${relation.capacityMl} ml` : (relation.capacity ?? "Size");
}

function ComponentTypeGroup({
    typeLabel,
    components,
    onAddComponent,
}: {
    typeLabel: string;
    components: PdpCompatibilityComponent[];
    onAddComponent: (component: PdpCompatibilityComponent) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const preview = expanded ? components : components.slice(0, 3);
    const hiddenCount = components.length - preview.length;

    return (
        <div className="rounded-sm border border-champagne/50 bg-white p-4">
            <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-serif text-xl text-obsidian">{typeLabel}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate">{components.length} fitment{components.length === 1 ? "" : "s"}</span>
            </div>
            <div className="mt-3 grid gap-3">
                {preview.map((component) => (
                    <ComponentCard key={component.graceSku} component={component} onAddComponent={onAddComponent} />
                ))}
            </div>
            {hiddenCount > 0 && (
                <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="mt-3 inline-flex min-h-11 items-center text-xs font-bold uppercase tracking-wider text-obsidian hover:text-muted-gold"
                >
                    Show all {components.length} {typeLabel.toLowerCase()} options
                </button>
            )}
        </div>
    );
}

function ComponentMedia({ component }: { component: PdpCompatibilityComponent }) {
    const [imageFailed, setImageFailed] = useState(false);
    if (!component.imageUrl || imageFailed) {
        return (
            <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center border border-dashed border-champagne/70 bg-bone p-2 text-center">
                <Package className="h-5 w-5 text-champagne" aria-hidden="true" />
                <span className="mt-1 text-[8px] font-semibold uppercase leading-tight tracking-wide text-slate">Media preparation in progress</span>
            </div>
        );
    }
    return (
        <Image
            src={component.imageUrl}
            alt={component.itemName}
            width={80}
            height={80}
            className="h-20 w-20 shrink-0 border border-champagne/40 bg-bone object-contain"
            onError={() => setImageFailed(true)}
        />
    );
}

function ComponentCard({
    component,
    onAddComponent,
}: {
    component: PdpCompatibilityComponent;
    onAddComponent: (component: PdpCompatibilityComponent) => void;
}) {
    const checkoutReady = isCheckoutReady({
        graceSku: component.graceSku,
        shopifyVariantId: component.shopifyVariantId,
        shopifySellable: component.shopifySellable,
    });
    const sku = component.websiteSku ?? component.graceSku;
    const quoteHref = `/request-quote?products=${encodeURIComponent(`${component.itemName} (SKU: ${sku})`)}`;

    return (
        <article className="flex flex-col gap-3 rounded-sm border border-champagne/50 bg-white p-4 sm:flex-row">
            <ComponentMedia component={component} />
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-gold">Compatible with this bottle</p>
                <h3 className="mt-1 text-base font-semibold text-obsidian">{component.itemName}</h3>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-slate">SKU {sku} · {component.graceSku}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate">
                    <span>{component.stockStatus ?? "Availability to confirm"}</span>
                    <span className="font-semibold text-obsidian">{formatPrice(component.webPrice1pc)}</span>
                </div>
            </div>
            <div className="flex shrink-0 items-end">
                {checkoutReady && component.webPrice1pc != null ? (
                    <button
                        type="button"
                        onClick={() => onAddComponent(component)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-obsidian px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-muted-gold"
                    >
                        <ShoppingBag className="h-4 w-4" />
                        Add to Cart
                    </button>
                ) : (
                    <Link
                        href={quoteHref}
                        className="inline-flex min-h-11 items-center justify-center rounded-sm border border-obsidian px-4 py-2 text-xs font-bold uppercase tracking-wider text-obsidian transition-colors hover:bg-obsidian hover:text-white"
                    >
                        Request Quote
                    </Link>
                )}
            </div>
        </article>
    );
}

/** Keep initial server truth during a selected-SKU query transition, avoiding a blank discovery rail. */
export function selectDiscoveryCompatibility(
    initialCompatibility: PdpCompatibilityPayload | null,
    refreshedCompatibility: PdpCompatibilityPayload | null | undefined,
): PdpCompatibilityPayload | null {
    return refreshedCompatibility === undefined ? initialCompatibility : refreshedCompatibility;
}

export function PdpDiscoveryContent({
    family,
    relations,
    compatibility,
    onAskGrace,
    onAddComponent,
}: PdpDiscoveryContentProps) {
    const sizeOptions = uniqueSameApplicationSizes(relations?.sameApplicationSizes ?? []);
    const componentTypes = compatibility?.componentTypes?.length
        ? compatibility.componentTypes
        : Object.keys(compatibility?.components ?? {});
    const groupedComponents = componentTypes
        .map((typeLabel) => ({
            typeLabel,
            components: compatibility?.components[typeLabel] ?? [],
        }))
        .filter((group) => group.components.length > 0);
    const hasComponents = groupedComponents.length > 0;

    return (
        <div className="border-t border-champagne/50 bg-linen" data-testid="pdp-discovery-sections">
            <div className="mx-auto max-w-[1440px] space-y-10 px-4 py-10 sm:px-6 sm:py-14">
                <section aria-labelledby="pdp-sizes-heading">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-gold">Same bottle intent</p>
                    <h2 id="pdp-sizes-heading" className="mt-1 font-serif text-2xl text-obsidian">Also available in these sizes</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">Choose another capacity in the same family and dispensing application. Neck finishes stay on the product page — they are not extra size options.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {sizeOptions.map((relation) => {
                            const label = sizeChipLabel(relation);
                            const className = relation.isCurrent
                                ? "inline-flex min-h-11 items-center rounded-full border border-obsidian bg-obsidian px-4 text-sm font-semibold text-white"
                                : "inline-flex min-h-11 items-center rounded-full border border-champagne bg-white px-4 text-sm font-semibold text-obsidian transition-colors hover:border-muted-gold";
                            return relation.isCurrent ? (
                                <span key={relation.slug} className={className} aria-current="true">{label}</span>
                            ) : (
                                <Link key={relation.slug} href={`/products/${relation.slug}`} className={className}>{label}</Link>
                            );
                        })}
                    </div>
                </section>

                <section aria-labelledby="pdp-applications-heading">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-gold">Different product intent</p>
                    <h2 id="pdp-applications-heading" className="mt-1 font-serif text-2xl text-obsidian">Other ways to dispense</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">Also available as one of the main {family} entry points — the same five starting points as the homepage, not every SKU in the family.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {APPLICATOR_NAV.map((nav) => {
                            const isCurrent = relations?.currentApplication === nav.value;
                            const className = `flex min-h-[7.5rem] flex-col justify-between rounded-sm border p-4 ${
                                isCurrent
                                    ? "border-obsidian bg-white"
                                    : "border-champagne/50 bg-white transition-colors hover:border-muted-gold"
                            }`;
                            const body = (
                                <>
                                    <span>
                                        <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-gold">
                                            {isCurrent ? "Current" : "Also available as"}
                                        </span>
                                        <span className="mt-1 block font-serif text-xl text-obsidian">{nav.label}</span>
                                    </span>
                                    <span className="mt-3 text-xs leading-relaxed text-slate">{nav.subtitle}</span>
                                </>
                            );
                            return isCurrent ? (
                                <div key={nav.value} aria-current="true" className={className}>{body}</div>
                            ) : (
                                <Link key={nav.value} href={catalogHref({ families: [family], applicators: [...nav.buckets] })} className={className}>
                                    {body}
                                </Link>
                            );
                        })}
                    </div>
                </section>

                <section aria-labelledby="pdp-components-heading">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-gold">Fitment-resolved parts</p>
                    <h2 id="pdp-components-heading" className="mt-1 font-serif text-2xl text-obsidian">Compatible components</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">These parts are grouped by closure type and resolved from this exact selected SKU’s fitment rules — separate from the size and dispense entry points above.</p>
                    {hasComponents ? (
                        <div className="mt-4 grid gap-4">
                            {groupedComponents.map((group) => (
                                <ComponentTypeGroup
                                    key={group.typeLabel}
                                    typeLabel={group.typeLabel}
                                    components={group.components}
                                    onAddComponent={onAddComponent}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-sm border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center">
                            <p className="text-sm leading-relaxed text-amber-900">Compatibility is unmapped for this SKU. Do not assume a component fits until the neck and fitment are verified.</p>
                            <button type="button" onClick={onAskGrace} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-sm border border-amber-700 px-3 py-2 text-xs font-bold uppercase tracking-wider text-amber-900 hover:bg-amber-100">
                                <ChatCircle className="h-4 w-4" />
                                Ask Grace about fitment
                            </button>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

export function PdpDiscoveryMatrixLink({ family }: { family: string }) {
    return (
        <div className="border-t border-champagne/50 bg-bone">
            <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-3 px-4 py-8 sm:flex-row sm:items-center sm:px-6">
                <p className="text-sm text-slate">Technical specifications, volume pricing, fulfillment details, and editorial guidance appear above this advanced comparison tool.</p>
                <Link href={`/matrix?family=${encodeURIComponent(family)}&from=pdp`} className="inline-flex min-h-11 items-center rounded-sm bg-obsidian px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-muted-gold">
                    Compare all compatible combinations
                </Link>
            </div>
        </div>
    );
}

export default function PdpDiscoverySections({
    family,
    relations,
    initialCompatibility,
    selectedWebsiteSku,
    selectedGraceSku,
    onAskGrace,
    onAddComponent,
}: {
    family: string;
    relations: FocusedPdpRelations | null;
    initialCompatibility: PdpCompatibilityPayload | null;
    selectedWebsiteSku: string | null | undefined;
    selectedGraceSku: string | null | undefined;
    onAskGrace: () => void;
    onAddComponent: (component: PdpCompatibilityComponent) => void;
}) {
    const refreshedCompatibility = useQuery(
        api.grace.getBottleComponents,
        selectedWebsiteSku
            ? { websiteSku: selectedWebsiteSku }
            : selectedGraceSku
                ? { graceSku: selectedGraceSku }
                : "skip",
    ) as PdpCompatibilityPayload | null | undefined;
    const compatibility = selectDiscoveryCompatibility(initialCompatibility, refreshedCompatibility);

    return <PdpDiscoveryContent family={family} relations={relations} compatibility={compatibility} onAskGrace={onAskGrace} onAddComponent={onAddComponent} />;
}
