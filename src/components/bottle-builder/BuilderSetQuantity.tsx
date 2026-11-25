"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { builderSets, piecesFor, readSets, type BuilderSet } from "@/lib/bottle-builder/set-quantity";
import styles from "./BuilderSetQuantity.module.css";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

/**
 * Quantity in sets, the catalog card's control (Jordan, 25 Nov 2026: "the same dropdown as we have on the regular
 * grid catalog page"): a "Set of" menu, a number of sets, and the total in pieces.
 * `quantity` and `onQuantity` are pieces, as the builder's selection holds them.
 */
export default function BuilderSetQuantity({ id, quantity, caseQuantity, disabled = false, invalid = false, describedBy, priceFor, onQuantity }: {
    id: string;
    quantity: number;
    caseQuantity: number | null | undefined;
    disabled?: boolean;
    invalid?: boolean;
    describedBy?: string;
    /** What the cart charges for one set of this many pieces; omitted or null = the menu lists sizes without prices. */
    priceFor?: (pieces: number) => { unitPrice: number | null; total: number | null } | null;
    onQuantity: (pieces: number) => void;
}) {
    const sets = useMemo(() => builderSets(caseQuantity), [caseQuantity]);
    const [chosenSize, setChosenSize] = useState<number | undefined>(undefined);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuId = useId();
    const wrapper = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const options = useRef<Array<HTMLButtonElement | null>>([]);
    const { size, count } = readSets(sets, quantity, chosenSize);
    const whole = Number.isFinite(count);
    const pieces = whole ? quantity : null;
    const active = sets.find(set => set.size === size) ?? sets[0];
    const activeIndex = sets.indexOf(active);

    useEffect(() => {
        if (!menuOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && wrapper.current?.contains(event.target)) return;
            setMenuOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [menuOpen]);

    const name = (set: BuilderSet) => set.label.startsWith("Case") ? set.label : `Set of ${set.label}`;
    const optionLabel = (set: BuilderSet) => {
        const price = priceFor?.(set.size);
        if (!price || price.unitPrice == null || price.total == null) return name(set);
        return set.size === 1 ? `${name(set)} – ${money(price.unitPrice)} each` : `${name(set)} – ${money(price.total)} (${money(price.unitPrice)} each)`;
    };
    const openMenu = () => {
        if (menuOpen || disabled) return;
        setMenuOpen(true);
        window.setTimeout(() => options.current[Math.max(activeIndex, 0)]?.focus({ preventScroll: true }), 0);
    };
    const closeMenu = (returnFocus: boolean) => {
        setMenuOpen(false);
        if (returnFocus) trigger.current?.focus({ preventScroll: true });
    };
    /** Choosing a set size starts at one set of it: Set of 12 x 1 is 12 pieces. */
    const pick = (set: BuilderSet) => { setChosenSize(set.size); onQuantity(set.size); closeMenu(true); };
    const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const focused = options.current.findIndex(option => option === document.activeElement);
        let next: number | null = null;
        if (event.key === "ArrowDown") next = Math.min(sets.length - 1, focused + 1);
        else if (event.key === "ArrowUp") next = Math.max(0, focused - 1);
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = sets.length - 1;
        else if (event.key === "Escape") { event.preventDefault(); closeMenu(true); return; }
        else if (event.key === "Tab") { closeMenu(false); return; }
        if (next == null) return;
        event.preventDefault();
        options.current[next]?.focus();
    };
    const commit = (sets_: number) => { setChosenSize(size); onQuantity(piecesFor(size, sets_)); };

    return <div className={styles.sets} data-builder-sets>
        <div className={styles.row}>
            <div ref={wrapper} className={styles.menuWrap}>
                <button ref={trigger} type="button" className={styles.toggle} aria-haspopup="listbox" aria-expanded={menuOpen} aria-controls={menuId} disabled={disabled}
                    data-builder-set-toggle data-set-size={size}
                    onClick={() => (menuOpen ? closeMenu(false) : openMenu())}
                    onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); openMenu(); } }}>
                    <span>{active.label.startsWith("Case") ? <>Case of <b>{active.size.toLocaleString("en-US")}</b></> : <>Set of <b>{active.label}</b></>}</span>
                    <span aria-hidden="true" className={styles.chevron}>{menuOpen ? "▴" : "▾"}</span>
                </button>
                {menuOpen && <div id={menuId} role="listbox" aria-label="Set sizes" className={styles.menu} onKeyDown={onMenuKeyDown} data-builder-set-menu>
                    {sets.map((set, index) => <button key={set.size} ref={element => { options.current[index] = element; }} type="button" role="option" aria-selected={index === activeIndex}
                        className={styles.option} data-set-size={set.size} onClick={() => pick(set)}>{optionLabel(set)}</button>)}
                </div>}
            </div>
            <div className={styles.stepper} role="group" aria-label="Quantity">
                <button type="button" aria-label="Decrease quantity" disabled={disabled || !whole || count <= 1} onClick={() => commit(count - 1)}>−</button>
                <input id={id} type="number" inputMode="numeric" min="1" step="1" aria-label={size === 1 ? "Quantity" : `Number of sets of ${size.toLocaleString("en-US")}`}
                    value={whole ? count : ""} disabled={disabled} aria-invalid={invalid || undefined} aria-describedby={describedBy}
                    onFocus={event => event.currentTarget.select()}
                    onChange={event => { setChosenSize(size); onQuantity(event.target.value === "" ? NaN : piecesFor(size, Number(event.target.value))); }} />
                <button type="button" aria-label="Increase quantity" disabled={disabled} onClick={() => commit(whole ? count + 1 : 1)}>+</button>
            </div>
        </div>
        <p className={styles.total} aria-live="polite" data-builder-total-quantity>
            Total quantity: <b>{pieces == null ? "—" : pieces.toLocaleString("en-US")}</b> {pieces === 1 ? "pc" : "pcs"}
        </p>
    </div>;
}
