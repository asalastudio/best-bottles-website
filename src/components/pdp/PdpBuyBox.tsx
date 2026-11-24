"use client";

/**
 * The buy box (design 3a §4.4): selection row, roller toggle, Set of menu
 * with the quantity stepper, the total quantity, Add to Cart, and the case
 * link. The legacy site's format, the same as the catalog card (Jordan,
 * 20 Nov 2026), worded as sets: "Set of" picks a published set ("Set of 144 –
 * $77.76 ($0.54 each)"), the stepper counts sets, and the total quantity — what the
 * cart receives, `qty` here — is pack × packs. One piece is one bottle with
 * its closure (and roller ball). Whether checkout bills the pack's rate is
 * `volumePricing.ts`'s concern. The roller choice
 * shows no price of its own: the set price above the button already follows it.
 *
 * On mobile the Add to Cart button lives in the sticky bar (option 4a) and
 * the Set of menu opens as a bottom sheet; both are stylesheet concerns.
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import Image from "next/image";
import styles from "./pdp.module.css";
import GraceMark from "@/components/icons/GraceMark";
import { useGrace } from "@/components/useGrace";
import { packOptionLabel, packSelectionFromQuantity, type DisplayVolumeTier } from "@/lib/volumePricing";
import { CATALOG_QUANTITY_MAX, parseCatalogQuantity } from "@/lib/products/catalog-card-purchase";
import type { RollerOption } from "@/lib/products/pdp-redesign/model";
import { displayDerivativeUrl } from "@/lib/products/display-derivative";

export type AddState = "add" | "sold-out" | "unavailable" | "unpriced";

export type PdpBuyBoxProps = {
    swatchStyle: CSSProperties;
    selectionName: string;
    rollers: RollerOption[];
    activeRoller: RollerOption["id"] | null;
    rollerImages: Partial<Record<RollerOption["id"], string>>;
    onRoller: (id: RollerOption["id"]) => void;
    tiers: DisplayVolumeTier[];
    qty: number;
    onQty: (qty: number, source: "stepper" | "input" | "tier" | "case") => void;
    unitPrice: number | null;
    lineTotal: number | null;
    addState: AddState;
    onAdd: () => void;
    addedQty: number | null;
    caseQuantity: number | null;
    formatPrice: (usd: number) => string;
};

export default function PdpBuyBox({
    swatchStyle, selectionName, rollers, activeRoller, rollerImages, onRoller,
    tiers, qty, onQty, unitPrice, lineTotal, addState, onAdd, addedQty, caseQuantity, formatPrice,
}: PdpBuyBoxProps) {
    const { openPanel } = useGrace();
    const baseId = useId();
    const menuId = `${baseId}-packs`;
    const [menuOpen, setMenuOpen] = useState(false);
    // `qty` is the total piece count; the box shows it as packs of a published size.
    const [packIndex, setPackIndex] = useState(() => packSelectionFromQuantity(tiers, qty).packIndex);
    const activeIndex = tiers.length ? Math.min(packIndex, tiers.length - 1) : -1;
    const activeTier = activeIndex >= 0 ? tiers[activeIndex] : null;
    const packSize = activeTier?.minQty ?? 1;
    const packs = Math.max(1, Math.floor(qty / packSize));
    const [qtyText, setQtyText] = useState(String(packs));
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

    // A total set from outside (the case link, a ?qty= link) is re-read as packs: kept as whole packs of the current
    // size when it is one, otherwise as the pack it fits. React's "adjust state when a prop changes", in render.
    const [readQty, setReadQty] = useState(qty);
    if (qty !== readQty) {
        setReadQty(qty);
        if (qty % packSize === 0) setQtyText(String(qty / packSize));
        else {
            const next = packSelectionFromQuantity(tiers, qty);
            setPackIndex(next.packIndex);
            setQtyText(String(next.packs));
        }
    }

    useEffect(() => {
        if (!menuOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && wrapperRef.current?.contains(event.target)) return;
            setMenuOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [menuOpen]);

    const { error } = parseCatalogQuantity(qtyText);

    /** Packs of `size`, clamped so the total stays within what the cart accepts; the parent receives pieces. */
    const commitPacks = (next: number, source: "stepper" | "input" | "tier", size = packSize) => {
        const clamped = Math.min(Math.max(1, Math.round(next)), Math.max(1, Math.floor(CATALOG_QUANTITY_MAX / size)));
        setQtyText(String(clamped));
        onQty(clamped * size, source);
    };
    /** Choosing a set size starts at one set of it: Set of 12 × 1 is 12 pieces. */
    const pickPack = (index: number) => {
        setPackIndex(index);
        commitPacks(1, "tier", tiers[index]?.minQty ?? 1);
    };
    const commitCase = (total: number) => {
        const clamped = Math.min(Math.max(1, Math.round(total)), CATALOG_QUANTITY_MAX);
        onQty(clamped, "case");
    };

    const openMenu = () => {
        if (menuOpen || tiers.length === 0) return;
        setMenuOpen(true);
        window.setTimeout(() => optionRefs.current[Math.max(activeIndex, 0)]?.focus({ preventScroll: true }), 0);
    };
    const closeMenu = (returnFocus: boolean) => {
        setMenuOpen(false);
        if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
    };
    const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const focused = optionRefs.current.findIndex((option) => option === document.activeElement);
        let next: number | null = null;
        if (event.key === "ArrowDown") next = Math.min(tiers.length - 1, focused + 1);
        else if (event.key === "ArrowUp") next = Math.max(0, focused - 1);
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tiers.length - 1;
        else if (event.key === "Escape") { event.preventDefault(); closeMenu(true); return; }
        else if (event.key === "Tab") { closeMenu(false); return; }
        if (next == null) return;
        event.preventDefault();
        optionRefs.current[next]?.focus();
    };

    const disabled = addState !== "add";
    // The pack's published price × packs, as the legacy menu prices it; the parent's line total when no ladder applies.
    const packTotal = activeTier && unitPrice != null && qty % packSize === 0 ? activeTier.packPrice * (qty / packSize) : lineTotal;
    const addLabel = addState === "sold-out"
        ? "Out of stock"
        : addState === "unavailable"
            ? "Unavailable online"
            : addState === "unpriced"
                ? "Request pricing"
                : addedQty != null
                    ? `Added ${addedQty.toLocaleString("en-US")}`
                    : `Add to cart${packTotal != null ? ` · ${formatPrice(packTotal)}` : ""}`;

    return (
        <div className={styles.buyBox} data-testid="pdp-buy-box">
            <div className={styles.selectionRow}>
                <span className={styles.swatchDot} style={swatchStyle} aria-hidden />
                <span className={styles.selectionName} data-testid="pdp-selection-name">{selectionName}</span>
                <span className={styles.selectionHint}>change on canvas</span>
            </div>

            {rollers.length > 1 && (
                <>
                <p className={styles.rollerIntro}>Choose the roller-ball insert fitted inside this bottle.</p>
                <div className={styles.rollerToggle} role="group" aria-label="Roller ball" data-testid="pdp-roller-toggle">
                    {rollers.map((roller) => {
                        const rollerImage = rollerImages[roller.id];
                        return (
                            <button
                                key={roller.id}
                                type="button"
                                className={styles.rollerButton}
                                aria-pressed={roller.id === activeRoller}
                                onClick={() => onRoller(roller.id)}
                                data-roller={roller.id}
                            >
                                {/* Use a verified lossless thumbnail when present. Otherwise serve the native register
                                    layer directly: the image optimizer's private-IP guard can reject Blob on NAT64. */}
                                {rollerImage && <Image className={styles.rollerImage} src={displayDerivativeUrl(rollerImage, 128) ?? rollerImage} alt="" width={44} height={44} loading="lazy" unoptimized />}
                                <span>{roller.label}</span>
                            </button>
                        );
                    })}
                </div>
                </>
            )}

            <div className={styles.qtyRow}>
                <div className={styles.packWrap} ref={wrapperRef}>
                    <button
                        ref={triggerRef}
                        type="button"
                        className={styles.packButton}
                        aria-haspopup="listbox"
                        aria-expanded={menuOpen}
                        aria-controls={menuId}
                        disabled={tiers.length === 0 || unitPrice == null}
                        onClick={() => (menuOpen ? closeMenu(false) : openMenu())}
                        onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); openMenu(); } }}
                        data-testid="pdp-pack-toggle"
                    >
                        <span>Set of <b>{packSize.toLocaleString("en-US")}</b>{activeTier && unitPrice != null ? ` · ${formatPrice(activeTier.unitPrice)} each` : ""}</span>
                        <span className={styles.packChevron} aria-hidden>{menuOpen ? "▴" : "▾"}</span>
                    </button>
                    {menuOpen && (
                        <>
                            <div className={styles.packSheetBackdrop} onClick={() => closeMenu(false)} aria-hidden />
                            <div id={menuId} role="listbox" aria-label="Set sizes" className={styles.packMenu} onKeyDown={onMenuKeyDown} data-testid="pdp-pack-menu">
                                {tiers.map((tier, index) => (
                                    <button
                                        key={tier.minQty}
                                        ref={(element) => { optionRefs.current[index] = element; }}
                                        type="button"
                                        role="option"
                                        aria-selected={index === activeIndex}
                                        className={styles.packOption}
                                        onClick={() => { pickPack(index); closeMenu(true); }}
                                        data-tier-min={tier.minQty}
                                    >
                                        <span>{packOptionLabel(tier, formatPrice)}</span>
                                        {tier.savePct > 0 ? <span className={styles.packSave}>{tier.savePct}% off</span> : null}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className={styles.stepper} role="group" aria-label="Quantity">
                    <button type="button" className={styles.stepButton} aria-label="Decrease quantity" disabled={packs <= 1} onClick={() => commitPacks(packs - 1, "stepper")}>−</button>
                    <input
                        className={styles.qtyInput}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        aria-label="Quantity"
                        value={qtyText}
                        onChange={(event) => setQtyText(event.target.value)}
                        onFocus={(event) => event.currentTarget.select()}
                        onBlur={() => { const parsed = parseCatalogQuantity(qtyText); if (parsed.qty != null) commitPacks(parsed.qty, "input"); else setQtyText(String(packs)); }}
                        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); const parsed = parseCatalogQuantity(qtyText); if (parsed.qty != null) commitPacks(parsed.qty, "input"); } }}
                        aria-invalid={error ? true : undefined}
                        data-testid="pdp-qty"
                    />
                    <button type="button" className={styles.stepButton} aria-label="Increase quantity" onClick={() => commitPacks(packs + 1, "stepper")}>+</button>
                </div>
            </div>
            <p className={styles.totalQty} aria-live="polite" data-testid="pdp-total-qty">
                Total quantity: <b>{qty.toLocaleString("en-US")}</b> {qty === 1 ? "pc" : "pcs"}
            </p>

            {error && <p role="alert" className={styles.error}>{error}</p>}

            <button type="button" className={styles.addButton} disabled={disabled} onClick={onAdd} data-testid="pdp-add">
                {addLabel}
            </button>

            <div className={styles.buyFoot}>
                <button
                    type="button"
                    className={styles.caseLink}
                    disabled={!caseQuantity || caseQuantity <= 1}
                    onClick={() => caseQuantity && commitCase(qty <= 1 ? caseQuantity : qty + caseQuantity)}
                    data-testid="pdp-add-case"
                >
                    {caseQuantity && caseQuantity > 1 ? `+ Add a case (${caseQuantity.toLocaleString("en-US")})` : "Case quantity on request"}
                </button>
                <span className={styles.buyFootNote}>
                    <span className={styles.buyFootNoteDesktop}>1–11 rate billed online; 12+ confirmed on a quote</span>
                    <span className={styles.buyFootNoteMobile}>12+ rates confirmed on a quote</span>
                </span>
            </div>

            {/* Grace's place on product pages (2026-11-04): a quiet line under the buy box, clear of the swatches,
                in place of the floating bubble. */}
            <button type="button" className={styles.askGrace} onClick={() => openPanel({ source: "pdp" })} data-testid="pdp-ask-grace">
                <GraceMark size={16} />
                <span>Questions about fit or finish? <span className={styles.askGraceLink}>Ask Grace</span></span>
            </button>
        </div>
    );
}
