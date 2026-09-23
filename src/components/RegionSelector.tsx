"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CaretDown, Globe } from "@/components/icons";
import { useRegion } from "@/components/RegionProvider";
import { MARKETS, RATES_AS_OF } from "@/lib/region";
import styles from "./RegionSelector.module.css";

/**
 * Market + currency selector for the header's left slot. Trigger reads
 * "US · USD $"; the menu lists "USD $ | United States" rows with the active
 * market marked, and states that non-USD prices are estimates settled in USD.
 */
export default function RegionSelector({ className, inline = false }: { className?: string; inline?: boolean }) {
    const { market, setMarket, estimate } = useRegion();
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const listId = useId();

    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        const onPointer = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("pointerdown", onPointer);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("pointerdown", onPointer);
        };
    }, [open]);

    const classes = [styles.root, inline ? styles.inline : "", className ?? ""].filter(Boolean).join(" ");

    return (
        <div ref={root} className={classes}>
            <button
                type="button"
                className={styles.trigger}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                aria-label={`Region and currency: ${market.country}, ${market.currency}`}
                onClick={() => setOpen((current) => !current)}
            >
                <Globe size={17} weight="light" />
                <span className={styles.code}>{market.code} · {market.currency} {market.symbol}</span>
                <CaretDown size={12} />
            </button>
            {open && (
                <div className={styles.menu}>
                    <ul id={listId} role="listbox" aria-label="Choose your region and currency" className={styles.list}>
                        {MARKETS.map((option) => (
                            <li key={option.code} role="none">
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={option.code === market.code}
                                    className={styles.option}
                                    onClick={() => {
                                        setMarket(option.code);
                                        setOpen(false);
                                    }}
                                >
                                    <span className={styles.currency}>{option.currency} {option.symbol}</span>
                                    <span className={styles.country}>{option.country}</span>
                                    <span className={styles.check} aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                    <p className={styles.note}>
                        {estimate
                            ? `Prices in ${market.currency} are estimates (rates as of ${RATES_AS_OF}). Orders are settled in USD at checkout.`
                            : "Prices shown in US dollars. Choose a region to see estimated local prices; orders are settled in USD."}
                    </p>
                </div>
            )}
        </div>
    );
}
