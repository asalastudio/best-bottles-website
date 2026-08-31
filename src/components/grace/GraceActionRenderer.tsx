"use client";

import type { GraceAction, ProductCard } from "@/components/GraceContext";
import PatternA_SingleSku from "./patterns/PatternA_SingleSku";
import PatternB_FamilyCard from "./patterns/PatternB_FamilyCard";
import PatternC_ComponentsTray from "./patterns/PatternC_ComponentsTray";
import PatternD_BuildKit from "./patterns/PatternD_BuildKit";
import PatternE_Anatomy from "./patterns/PatternE_Anatomy";
import PatternF_DeepCompare from "./patterns/PatternF_DeepCompare";
import PatternH_ReferenceMatch from "./patterns/PatternH_ReferenceMatch";
import PatternI_BrandMockup from "./patterns/PatternI_BrandMockup";
import PatternJ_Shortlist from "./patterns/PatternJ_Shortlist";
import PatternL_CatalogDiscovery from "./patterns/PatternL_CatalogDiscovery";
import GraceProductCard from "./cards/GraceProductCard";

/**
 * Central dispatch for Grace's inline rich actions.
 *
 * Each `GraceAction` variant maps to exactly one pattern component (PRD A-L).
 * Patterns added incrementally in their respective phases:
 *  - Phase 3: A, B, C, D, F, J, L (this file)
 *  - Phase 4: K (voice note pinned, rendered separately as a message variant)
 *  - Phase 5: H, I (file-upload patterns)
 *  - Phase 6: E, G (anatomy + true-scale)
 *
 * The renderer is a pure switch — no data fetching here. Payloads arrive
 * pre-built from the corresponding clientTool in GraceProvider.
 */
export interface GraceActionRendererProps {
    action: GraceAction;
    onAddToShortlist?: (p: ProductCard) => void;
    tierLabel?: string | null;
    onConfirmAction?: () => void;
    onDismissAction?: () => void;
}

function GraceProductTileGrid({
    products,
    headline,
    onAddToShortlist,
    tierLabel,
}: {
    products: ProductCard[];
    headline?: string;
    onAddToShortlist?: (p: ProductCard) => void;
    tierLabel?: string | null;
}) {
    if (products.length === 0) return null;

    return (
        <div
            className="rounded-[2px] p-3 space-y-3"
            style={{
                background: "var(--color-linen)",
                border: "1px solid rgba(212, 197, 169, 0.55)",
            }}
            data-testid="grace-product-tile-grid"
        >
            {headline && (
                <div className="font-serif text-[16px] font-medium text-obsidian leading-tight">
                    {headline}
                </div>
            )}
            <div className="grid grid-cols-1 gap-2">
                {products.slice(0, 6).map((product) => (
                    <GraceProductCard
                        key={product.slug ?? product.graceSku}
                        product={product}
                        mode="single"
                        onAddToShortlist={onAddToShortlist}
                        tierLabel={tierLabel}
                    />
                ))}
            </div>
        </div>
    );
}

function CartProposal({
    action,
    onConfirmAction,
    onDismissAction,
}: {
    action: Extract<GraceAction, { type: "proposeCartAdd" }>;
    onConfirmAction?: () => void;
    onDismissAction?: () => void;
}) {
    const total = action.products.reduce((sum, p) => sum + (p.unitPrice ?? p.webPrice1pc ?? 0) * p.quantity, 0);
    return (
        <div
            className="mt-2 rounded-[2px] p-3 space-y-3"
            style={{
                background: "var(--color-linen)",
                border: "1px solid rgba(212, 197, 169, 0.55)",
            }}
            data-testid="grace-cart-proposal"
        >
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate">
                Review before adding
            </div>
            <div className="space-y-2">
                {action.products.map((p) => (
                    <div key={p.graceSku} className="flex items-start justify-between gap-3 text-[12px] text-obsidian/80">
                        <div>
                            <div className="font-medium text-obsidian">{p.itemName}</div>
                            <div className="text-slate">{[p.capacity, p.color, p.applicator].filter(Boolean).join(" · ")}</div>
                        </div>
                        <div className="text-right whitespace-nowrap">
                            <div>×{p.quantity}</div>
                            {(p.unitPrice ?? p.webPrice1pc) != null && (
                                <div className="text-slate">${((p.unitPrice ?? p.webPrice1pc) as number).toFixed(2)}/pc</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-champagne/50">
                <div className="text-[11px] text-slate">
                    {action.awaitingConfirmation
                        ? (total > 0 ? `Estimated subtotal $${total.toFixed(2)}` : "Price will be confirmed in cart")
                        : "Added to cart"}
                </div>
                {action.awaitingConfirmation && (
                    <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onDismissAction}
                        className="px-3 py-1.5 text-[11px] font-medium text-slate hover:text-obsidian"
                    >
                        Dismiss
                    </button>
                    <button
                        type="button"
                        onClick={onConfirmAction}
                        className="px-3 py-1.5 rounded-[2px] bg-obsidian text-bone text-[11px] font-semibold hover:bg-black"
                    >
                        Add to cart
                    </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function ProjectSaveProposal({
    action,
    onConfirmAction,
    onDismissAction,
}: {
    action: Extract<GraceAction, { type: "proposeProjectSave" }>;
    onConfirmAction?: () => void;
    onDismissAction?: () => void;
}) {
    return (
        <div className="mt-2 space-y-3 rounded-[2px] border border-champagne/60 bg-linen p-3" data-testid="grace-project-proposal">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate">Review project save</div>
            <div>
                <div className="text-[12px] font-medium text-obsidian">{action.product.itemName}</div>
                <div className="text-[11px] text-slate">SKU {action.product.graceSku}</div>
                {action.projectName && <div className="mt-1 text-[11px] text-slate">Project: {action.projectName}</div>}
            </div>
            {action.error && <p className="text-[11px] text-red-700">{action.error}</p>}
            {action.saved ? (
                <p className="border-t border-champagne/50 pt-2 text-[11px] font-medium text-obsidian">Saved to your Grace project.</p>
            ) : action.awaitingConfirmation ? (
                <div className="flex items-center justify-end gap-2 border-t border-champagne/50 pt-2">
                    <button type="button" onClick={onDismissAction} className="px-3 py-1.5 text-[11px] font-medium text-slate hover:text-obsidian">Dismiss</button>
                    <button type="button" onClick={onConfirmAction} className="rounded-[2px] bg-obsidian px-3 py-1.5 text-[11px] font-semibold text-bone hover:bg-black">
                        {action.requiresSignIn ? "Sign in to save" : "Confirm save"}
                    </button>
                </div>
            ) : null}
        </div>
    );
}

export default function GraceActionRenderer({ action, onAddToShortlist, tierLabel, onConfirmAction, onDismissAction }: GraceActionRendererProps) {
    switch (action.type) {
        case "displayProductCard":
            return (
                <PatternA_SingleSku
                    product={action.product}
                    onAddToShortlist={onAddToShortlist}
                    tierLabel={tierLabel}
                />
            );

        case "displayFamilyCard":
            return (
                <PatternB_FamilyCard
                    payload={action.payload}
                    onAddToShortlist={onAddToShortlist}
                    tierLabel={tierLabel}
                />
            );

        case "displayCompatibility":
            return (
                <PatternC_ComponentsTray
                    payload={action.payload}
                    onAddToShortlist={onAddToShortlist}
                />
            );

        case "displayBuildKit":
            return <PatternD_BuildKit payload={action.payload} />;

        case "displayComparison":
            return (
                <PatternF_DeepCompare
                    payload={action.payload}
                    onAddToShortlist={onAddToShortlist}
                />
            );

        case "displayShortlist":
            return <PatternJ_Shortlist payload={action.payload} />;

        case "displayCatalogStrip":
            return <PatternL_CatalogDiscovery payload={action.payload} />;

        case "displayReferenceMatch":
            return <PatternH_ReferenceMatch payload={action.payload} />;

        case "displayBrandMockup":
            return <PatternI_BrandMockup payload={action.payload} />;

        case "displayAnatomy":
            return <PatternE_Anatomy payload={action.payload} />;

        case "showProducts":
        case "compareProducts":
            return (
                <GraceProductTileGrid
                    products={action.products}
                    onAddToShortlist={onAddToShortlist}
                    tierLabel={tierLabel}
                />
            );
        case "showProductPresentation":
            return (
                <GraceProductTileGrid
                    products={action.products}
                    headline={action.headline}
                    onAddToShortlist={onAddToShortlist}
                    tierLabel={tierLabel}
                />
            );

        case "buildKit":
            return null;
        case "proposeCartAdd":
            return (
                <CartProposal
                    action={action}
                    onConfirmAction={onConfirmAction}
                    onDismissAction={onDismissAction}
                />
            );
        case "proposeProjectSave":
            return (
                <ProjectSaveProposal
                    action={action}
                    onConfirmAction={onConfirmAction}
                    onDismissAction={onDismissAction}
                />
            );
        case "navigateToPage":
        case "prefillForm":
            return null;

        default:
            return null;
    }
}
