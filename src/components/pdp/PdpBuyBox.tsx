"use client";

/**
 * The buy box (design 3a §4.4): selection row, roller toggle, Pack of menu
 * with the quantity stepper, Add to Cart, and the case link. Pricing shown is
 * the active break's unit rate (the same rule as the catalog card); whether
 * checkout bills the break is `volumePricing.ts`'s concern.
 *
 * On mobile the Add to Cart button lives in the sticky bar (option 4a) and
 * the Pack of menu opens as a bottom sheet; both are stylesheet concerns.
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import styles from "./pdp.module.css";
import { formatVolumeQtyRange, type DisplayVolumeTier } from "@/lib/volumePricing";
import { CATALOG_QUANTITY_MAX, parseCatalogQuantity } from "@/lib/products/catalog-card-purchase";
import type { RollerOption } from "@/lib/products/pdp-redesign/model";

export type AddState = "add" | "sold-out" | "unavailable" | "unpriced";

export type PdpBuyBoxProps = {
    swatchStyle: CSSProperties;
    selectionName: string;
    rollers: RollerOption[];
    activeRoller: RollerOption["id"] | null;
    rollerUnitPrice: (id: RollerOption["id"]) => number | null;
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
    swatchStyle, selectionName, rollers, activeRoller, rollerUnitPrice, onRoller,
    tiers, qty, onQty, unitPrice, lineTotal, addState, onAdd, addedQty, caseQuantity, formatPrice,
}: PdpBuyBoxProps) {
    const baseId = useId();
    const menuId = `${baseId}-packs`;
    const [menuOpen, setMenuOpen] = useState(false);
    const [qtyText, setQtyText] = useState(String(qty));
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

    useEffect(() => { setQtyText(String(qty)); }, [qty]);

    useEffect(() => {
        if (!menuOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && wrapperRef.current?.contains(event.target)) return;
            setMenuOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [menuOpen]);

    const activeIndex = tiers.reduce((acc, tier, index) => (qty >= tier.minQty ? index : acc), -1);
    const activeTier = activeIndex >= 0 ? tiers[activeIndex] : null;
    const packLabel = activeTier ? `${activeTier.minQty.toLocaleString("en-US")}${activeTier.maxQty == null ? "+" : ""}` : "1";
    const { error } = parseCatalogQuantity(qtyText);

    const commit = (next: number, source: "stepper" | "input" | "tier" | "case") => {
        const clamped = Math.min(Math.max(1, Math.round(next)), CATALOG_QUANTITY_MAX);
        setQtyText(String(clamped));
        onQty(clamped, source);
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
    const addLabel = addState === "sold-out"
        ? "Out of stock"
        : addState === "unavailable"
            ? "Unavailable online"
            : addState === "unpriced"
                ? "Request pricing"
                : addedQty != null
                    ? `Added ${addedQty.toLocaleString("en-US")}`
                    : `Add to cart${lineTotal != null ? ` · ${formatPrice(lineTotal)}` : ""}`;

    return (
        <div className={styles.buyBox} data-testid="pdp-buy-box">
            <div className={styles.selectionRow}>
                <span className={styles.swatchDot} style={swatchStyle} aria-hidden />
                <span className={styles.selectionName} data-testid="pdp-selection-name">{selectionName}</span>
                <span className={styles.selectionHint}>change on canvas</span>
            </div>

            {rollers.length > 1 && (
                <div className={styles.rollerToggle} role="group" aria-label="Roller ball" data-testid="pdp-roller-toggle">
                    {rollers.map((roller) => {
                        const price = rollerUnitPrice(roller.id);
                        return (
                            <button
                                key={roller.id}
                                type="button"
                                className={styles.rollerButton}
                                aria-pressed={roller.id === activeRoller}
                                onClick={() => onRoller(roller.id)}
                                data-roller={roller.id}
                            >
                                <span>{roller.label}</span>
                                <span className={styles.rollerPrice}>{price != null ? `${formatPrice(price)}/pc` : ""}</span>
                            </button>
                        );
                    })}
                </div>
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
                        <span>Pack of <b>{packLabel}</b>{unitPrice != null ? ` · ${formatPrice(unitPrice)}/pc` : ""}</span>
                        <span className={styles.packChevron} aria-hidden>{menuOpen ? "▴" : "▾"}</span>
                    </button>
                    {menuOpen && (
                        <>
                            <div className={styles.packSheetBackdrop} onClick={() => closeMenu(false)} aria-hidden />
                            <div id={menuId} role="listbox" aria-label="Quantity breaks" className={styles.packMenu} onKeyDown={onMenuKeyDown} data-testid="pdp-pack-menu">
                                {tiers.map((tier, index) => (
                                    <button
                                        key={tier.minQty}
                                        ref={(element) => { optionRefs.current[index] = element; }}
                                        type="button"
                                        role="option"
                                        aria-selected={index === activeIndex}
                                        className={styles.packOption}
                                        onClick={() => { commit(tier.minQty, "tier"); closeMenu(true); }}
                                        data-tier-min={tier.minQty}
                                    >
                                        <span>{formatVolumeQtyRange(tier.minQty, tier.maxQty)} pcs</span>
                                        <span><b>{formatPrice(tier.unitPrice)}</b>/pc{tier.savePct > 0 ? <span className={styles.packSave}>{tier.savePct}% off</span> : null}</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className={styles.stepper} role="group" aria-label="Quantity">
                    <button type="button" className={styles.stepButton} aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => commit(qty - 1, "stepper")}>−</button>
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
                        onBlur={() => { const parsed = parseCatalogQuantity(qtyText); if (parsed.qty != null) commit(parsed.qty, "input"); else setQtyText(String(qty)); }}
                        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); const parsed = parseCatalogQuantity(qtyText); if (parsed.qty != null) commit(parsed.qty, "input"); } }}
                        aria-invalid={error ? true : undefined}
                        data-testid="pdp-qty"
                    />
                    <button type="button" className={styles.stepButton} aria-label="Increase quantity" onClick={() => commit(qty + 1, "stepper")}>+</button>
                </div>
            </div>

            {error && <p role="alert" className={styles.error}>{error}</p>}

            <button type="button" className={styles.addButton} disabled={disabled} onClick={onAdd} data-testid="pdp-add">
                {addLabel}
            </button>

            <div className={styles.buyFoot}>
                <button
                    type="button"
                    className={styles.caseLink}
                    disabled={!caseQuantity || caseQuantity <= 1}
                    onClick={() => caseQuantity && commit(qty <= 1 ? caseQuantity : qty + caseQuantity, "case")}
                    data-testid="pdp-add-case"
                >
                    {caseQuantity && caseQuantity > 1 ? `+ Add a case (${caseQuantity.toLocaleString("en-US")})` : "Case quantity on request"}
                </button>
                <span className={styles.buyFootNote}>
                    <span className={styles.buyFootNoteDesktop}>1–11 rate billed online; 12+ confirmed on a quote</span>
                    <span className={styles.buyFootNoteMobile}>12+ rates confirmed on a quote</span>
                </span>
            </div>
        </div>
    );
}
