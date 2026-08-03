"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useCart } from "@/components/CartProvider";
import { ArrowRight, Check, Package, ShoppingBag, Truck } from "@/components/icons";
import BottleConfigurator, { MODE_LABELS } from "./BottleConfigurator";
import PaperDollCanvas from "./PaperDollCanvas";
import ProductImageGallery, { type GalleryImage } from "./ProductImageGallery";
import { analytics } from "@/lib/analytics";
import { isCheckoutReady } from "@/lib/checkout";
import type { StorefrontPaperDollFamily } from "@/lib/paper-doll/sanity";
import type { PaperDollConfiguration } from "@/lib/paper-doll/types";
import {
    GRACE_PAPER_DOLL_SELECT_EVENT,
    resolveGracePaperDollSelection,
    type GracePaperDollSelectionRequest,
} from "@/lib/grace/paperDollController";
import {
    isUnifiedCylinderBuildReady,
    resolveCylinderConfigurationFromQuery,
    resolveUnifiedPdpView,
    selectCylinderConfiguration,
    type CylinderSelectionChange,
} from "@/lib/products/unified-cylinder-pdp";

function usableImage(value: string | null | undefined): value is string {
    return Boolean(value && !value.includes("www.bestbottles.com/images/store/") && !value.includes("cdn.sanity.io/"));
}

function initialFromSearch(
    configurations: readonly PaperDollConfiguration[],
    params: URLSearchParams,
): PaperDollConfiguration {
    const requested = params.get("configuration");
    if (requested) return resolveCylinderConfigurationFromQuery(configurations, requested).configuration;
    let selected = resolveCylinderConfigurationFromQuery(configurations, null).configuration;
    const glass = params.get("glass");
    if (glass) selected = selectCylinderConfiguration(configurations, selected, { dimension: "glass", value: glass });
    const applicator = params.get("applicator");
    const mode = applicator === "Fine Mist Spray" ? "spray" : applicator === "Lotion Pump" ? "lotion" : applicator === "Roll-On" ? "rollon" : null;
    if (mode) selected = selectCylinderConfiguration(configurations, selected, { dimension: "deliverySystem", value: mode });
    const roller = params.get("roller");
    if (selected.mode === "rollon" && (roller === "Metal" || roller === "Plastic")) {
        selected = selectCylinderConfiguration(configurations, selected, { dimension: "rollerMaterial", value: roller });
    }
    const finish = params.get("finish");
    if (finish) selected = selectCylinderConfiguration(configurations, selected, { dimension: "finish", value: finish });
    return selected;
}

function formatPrice(value: number | null | undefined): string {
    return value == null ? "Request quote" : `$${value.toFixed(2)}`;
}

export default function UnifiedBottlePdp({
    configurations,
    paperDollFamily,
}: {
    configurations: PaperDollConfiguration[];
    paperDollFamily: StorefrontPaperDollFamily | null;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { addItems } = useCart();
    const buildReady = isUnifiedCylinderBuildReady(configurations, Boolean(paperDollFamily));
    const view = resolveUnifiedPdpView(searchParams.get("view"));
    const [selectedSku, setSelectedSku] = useState(() => initialFromSearch(configurations, new URLSearchParams(searchParams.toString())).graceSku);
    const [qty, setQty] = useState(1);
    const [added, setAdded] = useState(false);
    const [canvasFailed, setCanvasFailed] = useState(false);

    const requestedConfiguration = searchParams.get("configuration");
    const queryResolution = requestedConfiguration
        ? resolveCylinderConfigurationFromQuery(configurations, requestedConfiguration)
        : null;
    const selected = queryResolution && !queryResolution.invalidConfiguration
        ? queryResolution.configuration
        : configurations.find((configuration) => configuration.graceSku === selectedSku) ?? configurations[0];

    useEffect(() => {
        if (queryResolution?.invalidConfiguration) {
            const next = new URLSearchParams(searchParams.toString());
            next.delete("configuration");
            router.replace(`?${next.toString()}`, { scroll: false });
        }
    }, [queryResolution?.invalidConfiguration, router, searchParams]);

    useEffect(() => {
        const handleGraceSelection = (event: Event) => {
            const request = (event as CustomEvent<GracePaperDollSelectionRequest>).detail;
            if (!request) return;
            const result = resolveGracePaperDollSelection(configurations, selected, request);
            if (!result.ok) {
                window.dispatchEvent(new CustomEvent("grace:paperDollSelectionRejected", { detail: { reason: result.reason } }));
                return;
            }

            setSelectedSku(result.configuration.graceSku);
            setCanvasFailed(false);
            const next = new URLSearchParams(searchParams.toString());
            next.set("view", request.view === "beauty" ? "beauty" : "build");
            next.set("configuration", result.configuration.graceSku);
            next.delete("glass");
            next.delete("applicator");
            next.delete("roller");
            next.delete("finish");
            router.replace(`?${next.toString()}`, { scroll: false });
            analytics.paperDollOptionSelected({
                familyKey: "CYL-9ML",
                capacityMl: 9,
                neckThreadSize: "17-415",
                sku: result.configuration.graceSku,
                dimension: "grace",
                value: request.configurationSku ?? [request.glass, request.deliverySystem, request.rollerMaterial, request.finish].filter(Boolean).join(" · "),
            });
            analytics.paperDollConfigurationResolved({ familyKey: "CYL-9ML", capacityMl: 9, neckThreadSize: "17-415", sku: result.configuration.graceSku });
        };

        window.addEventListener(GRACE_PAPER_DOLL_SELECT_EVENT, handleGraceSelection);
        return () => window.removeEventListener(GRACE_PAPER_DOLL_SELECT_EVENT, handleGraceSelection);
    }, [configurations, router, searchParams, selected]);

    const images = useMemo(() => {
        const rows: GalleryImage[] = [];
        if (usableImage(selected.imageUrl)) rows.push({ url: selected.imageUrl, label: "Complete bottle", alt: `${selected.glassLabel} Cylinder bottle with ${selected.finishLabel} finish` });
        if (usableImage(selected.imageUrlCapOff) && selected.imageUrlCapOff !== selected.imageUrl) rows.push({ url: selected.imageUrlCapOff, label: "Applicator view", alt: `${selected.glassLabel} Cylinder bottle with applicator exposed` });
        if (rows.length === 0) rows.push({ url: "/assets/Cylinder-BB.png", label: "Cylinder family", alt: "Cylinder bottle on warm natural stone" });
        return rows;
    }, [selected]);

    const checkoutReady = isCheckoutReady(selected);
    const inStock = selected.stockStatus === "In Stock";
    const canAdd = checkoutReady && inStock;
    const productName = `9 mL ${selected.glassLabel} Cylinder — ${MODE_LABELS[selected.mode]}, ${selected.finishLabel}`;
    const quoteHref = `/request-quote?products=${encodeURIComponent(`${productName} (SKU: ${selected.graceSku})`)}&quantities=${encodeURIComponent(`${qty} units`)}`;

    function updateView(nextView: "beauty" | "build") {
        const next = new URLSearchParams(searchParams.toString());
        next.set("view", nextView);
        router.replace(`?${next.toString()}`, { scroll: false });
        if (nextView === "build") {
            analytics.paperDollViewOpened({ familyKey: "CYL-9ML", capacityMl: 9, neckThreadSize: "17-415", sku: selected.graceSku });
        }
    }

    function updateSelection(configuration: PaperDollConfiguration, change: CylinderSelectionChange) {
        setSelectedSku(configuration.graceSku);
        setCanvasFailed(false);
        const next = new URLSearchParams(searchParams.toString());
        next.set("configuration", configuration.graceSku);
        next.delete("glass");
        next.delete("applicator");
        next.delete("roller");
        next.delete("finish");
        router.replace(`?${next.toString()}`, { scroll: false });
        analytics.paperDollOptionSelected({
            familyKey: "CYL-9ML",
            capacityMl: 9,
            neckThreadSize: "17-415",
            sku: configuration.graceSku,
            dimension: change.dimension,
            value: change.value,
        });
        analytics.paperDollConfigurationResolved({ familyKey: "CYL-9ML", capacityMl: 9, neckThreadSize: "17-415", sku: configuration.graceSku });
    }

    function addToCart() {
        if (!canAdd) return;
        addItems([{
            graceSku: selected.graceSku,
            itemName: productName,
            quantity: qty,
            unitPrice: selected.price1pc,
            checkoutEligible: checkoutReady,
            shopifyVariantId: selected.shopifyVariantId,
            shopifySellable: selected.shopifySellable,
            websiteSku: selected.websiteSku,
            variantId: selected.variantId,
            productGroupSlug: selected.productGroupSlug,
            family: "Cylinder",
            capacity: "9 ml (0.3 oz)",
            color: selected.glassLabel,
            applicator: selected.applicatorLabel,
            capColor: selected.finishLabel,
            category: selected.category,
            neckThreadSize: "17-415",
            webPrice1pc: selected.price1pc,
            webPrice10pc: selected.webPrice10pc,
            webPrice12pc: selected.webPrice12pc,
        }]);
        analytics.cartItemAdded({ sku: selected.graceSku, name: productName, quantity: qty, unitPrice: selected.price1pc, family: "Cylinder", capacity: "9 ml", source: "pdp" });
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1600);
        window.dispatchEvent(new Event("open-cart-drawer"));
    }

    return (
        <main className="min-h-screen bg-warm-white pt-[92px] lg:pt-[120px]">
            <Navbar hideMobileSearch />
            <Breadcrumbs steps={[{ label: "Catalog", href: "/catalog" }, { label: "Cylinder", href: "/catalog/cylinder" }, { label: "9 mL · 17-415" }]} />

            <section className="mx-auto max-w-[1540px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
                <div className="mb-7 border-b border-champagne pb-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-gold">Unified bottle platform · 9 mL · 17-415</p>
                    <h1 className="mt-2 font-serif text-4xl font-medium text-obsidian sm:text-5xl">9 mL Cylinder Bottle</h1>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate">Choose the glass, delivery system, roller material when needed, and finish. Every option shown belongs to this exact 17-415 bottle platform.</p>
                </div>

                <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)] xl:gap-12">
                    <div className="min-w-0">
                        <div className="mb-3 flex border-b border-champagne" role="tablist" aria-label="Product media view">
                            <button type="button" role="tab" aria-selected={view === "beauty"} onClick={() => updateView("beauty")} className={`min-h-12 border-b-2 px-4 text-xs font-bold ${view === "beauty" ? "border-obsidian text-obsidian" : "border-transparent text-slate"}`}>Beauty View</button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={view === "build"}
                                aria-disabled={!buildReady}
                                disabled={!buildReady}
                                onClick={() => updateView("build")}
                                className={`min-h-12 border-b-2 px-4 text-left text-xs font-bold ${view === "build" ? "border-obsidian text-obsidian" : "border-transparent text-slate"} disabled:cursor-not-allowed disabled:opacity-65`}
                            >
                                <span className="block">Build This Bottle · 145 configurations</span>
                                {!buildReady && <span className="mt-0.5 block text-[9px] font-medium text-slate">Layered preview in preparation</span>}
                            </button>
                        </div>
                        {view === "build" && buildReady && paperDollFamily && !canvasFailed ? (
                            <PaperDollCanvas family={paperDollFamily} selected={selected} onFailure={() => setCanvasFailed(true)} />
                        ) : view === "build" ? (
                            <div className="flex aspect-[10/11] min-h-[360px] sm:min-h-[420px] flex-col items-center justify-center border border-champagne bg-bone px-6 text-center">
                                <Package className="h-10 w-10 text-muted-gold" />
                                <h2 className="mt-4 font-serif text-2xl text-obsidian">
                                    {canvasFailed ? "Layered preview temporarily unavailable" : "Layered preview in preparation"}
                                </h2>
                                <p className="mt-2 max-w-md text-sm leading-6 text-slate">
                                    You can still choose among all verified 9 mL · 17-415 configurations. The composited component view appears only after every 2080×2288 layer passes release checks.
                                </p>
                                <button type="button" onClick={() => updateView("beauty")} className="mt-5 min-h-11 border border-obsidian px-5 text-[10px] font-bold uppercase tracking-wider text-obsidian hover:bg-obsidian hover:text-white">Return to Beauty View</button>
                            </div>
                        ) : (
                            <ProductImageGallery images={images} primaryAlt={productName} aspectRatio="10/11" mainPadding="p-3 sm:p-8" />
                        )}
                        <div className="mt-4 grid grid-cols-3 border border-champagne bg-bone text-center">
                            <div className="p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-gold">Glass</p><p className="mt-1 text-xs font-semibold">{selected.glassLabel}</p></div>
                            <div className="border-x border-champagne p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-gold">Delivery</p><p className="mt-1 text-xs font-semibold">{MODE_LABELS[selected.mode]}</p></div>
                            <div className="p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-gold">Finish</p><p className="mt-1 text-xs font-semibold">{selected.finishLabel}</p></div>
                        </div>
                    </div>

                    <aside className="border border-champagne bg-bone p-4 sm:p-6 lg:sticky lg:top-32">
                        <div className="flex items-start justify-between gap-4 border-b border-champagne pb-5">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-gold">Configure this bottle</p>
                                <h2 className="mt-1 font-serif text-2xl text-obsidian">{selected.glassLabel} · {MODE_LABELS[selected.mode]}</h2>
                                <p className="mt-1 text-[11px] text-slate">SKU {selected.graceSku}</p>
                            </div>
                            <div className="text-right"><p className="font-serif text-2xl text-obsidian">{formatPrice(selected.price1pc)}</p><p className="text-[10px] text-slate">per bottle</p></div>
                        </div>

                        <div className="py-5"><BottleConfigurator configurations={configurations} selected={selected} onSelect={updateSelection} /></div>

                        {selected.priceTiers.length > 1 && (
                            <div className="border-t border-champagne py-4">
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate">Volume pricing</p>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                                    {selected.priceTiers.slice(0, 4).map((tier) => <div key={tier.minQty} className="border border-champagne bg-white p-2"><p className="text-[9px] text-slate">{tier.minQty}+ units</p><p className="mt-1 text-xs font-semibold">{formatPrice(tier.unitPrice)}/ea</p></div>)}
                                </div>
                            </div>
                        )}

                        <div className="border-t border-champagne pt-4">
                            <div className="mb-3 flex items-center justify-between gap-4">
                                <label htmlFor="unified-cylinder-qty" className="text-xs font-semibold text-obsidian">Order quantity</label>
                                <input id="unified-cylinder-qty" type="number" min={1} max={9999} value={qty} onChange={(event) => setQty(Math.max(1, Math.min(9999, Number(event.target.value) || 1)))} className="min-h-11 w-28 border border-champagne bg-white px-3 text-right text-sm outline-none focus:border-muted-gold" />
                            </div>
                            {canAdd ? (
                                <button type="button" onClick={addToCart} className="flex min-h-13 w-full items-center justify-center gap-2 bg-obsidian px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-white hover:bg-muted-gold hover:text-obsidian"><ShoppingBag className="h-4 w-4" /> {added ? "Added to cart" : "Add configuration to cart"}</button>
                            ) : (
                                <Link href={quoteHref} className="flex min-h-13 w-full items-center justify-center gap-2 bg-obsidian px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-white hover:bg-muted-gold hover:text-obsidian">Request a quote <ArrowRight className="h-4 w-4" /></Link>
                            )}
                            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-slate">{inStock ? <Check className="h-4 w-4 text-muted-gold" /> : <Package className="h-4 w-4" />}{selected.stockStatus || "Availability on request"} <span aria-hidden="true">·</span> <Truck className="h-4 w-4" /> B2B volume pricing</div>
                        </div>

                        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-champagne pt-4 text-[11px]">
                            <div><dt className="text-slate">Capacity</dt><dd className="mt-0.5 font-semibold text-obsidian">9 mL (0.3 oz)</dd></div>
                            <div><dt className="text-slate">Neck finish</dt><dd className="mt-0.5 font-semibold text-obsidian">17-415</dd></div>
                            {selected.heightWithCap && <div><dt className="text-slate">Height with cap</dt><dd className="mt-0.5 font-semibold text-obsidian">{selected.heightWithCap}</dd></div>}
                            {selected.diameter && <div><dt className="text-slate">Diameter</dt><dd className="mt-0.5 font-semibold text-obsidian">{selected.diameter}</dd></div>}
                            {selected.caseQuantity && <div><dt className="text-slate">Case quantity</dt><dd className="mt-0.5 font-semibold text-obsidian">{selected.caseQuantity}</dd></div>}
                        </dl>
                    </aside>
                </div>
            </section>
        </main>
    );
}
