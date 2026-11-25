"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { BuilderFamily } from "@/lib/bottle-builder/entry";
import { familyPreviewScale, familyScreenOrder, type BuilderFamilyPreview } from "@/lib/bottle-builder/family-previews";
import { familyIconGroup, familySizeRange } from "@/lib/catalog/family-icon-group";
import { registerDisplayDerivatives, type DisplayDerivativeMap } from "@/lib/products/display-derivative";
import styles from "./FamilyChooser.module.css";

export type FamilyPreviewPayload = { families: BuilderFamilyPreview[]; displayDerivatives: DisplayDerivativeMap } | null;

/** The bottle groups stream into the page after the tiles have painted with their outline icons.
 * A page that opened on a bottle streams none; it asks for them once, when the family screen is first shown. */
export function useFamilyPreviews(streamed: Promise<FamilyPreviewPayload> | undefined, shown: boolean) {
    const [previews, setPreviews] = useState<Record<string, BuilderFamilyPreview>>({});
    const asked = useRef(false);
    useEffect(() => {
        if (!streamed && (!shown || asked.current)) return;
        asked.current = true;
        let live = true, settled = false;
        const source = streamed ?? fetch("/api/bottle-builder/family-previews")
            .then(response => response.ok ? response.json() as Promise<FamilyPreviewPayload> : null);
        source.then(payload => {
            settled = true;
            if (!live || !payload?.families) return;
            registerDisplayDerivatives(payload.displayDerivatives);
            setPreviews(Object.fromEntries(payload.families.map(f => [f.family, f])));
        }, () => { settled = true; });
        // Closing the screen mid-request drops the answer; let the next opening ask again.
        return () => { live = false; if (!settled) asked.current = false; };
    }, [streamed, shown]);
    return previews;
}

/**
 * Build Your Bottle's first screen (Jordan, 20 Nov 2026): choose the shape before the size. Each family is a
 * group of its own outline icon, one per size, at their measured relative heights (24 Nov 2026: icons, not
 * bottle photographs). Until the sizes arrive, and for a family with none to show, it is one icon.
 */
export default function FamilyChooser({ families, previews, current, pendingFamily, onChoose, stepLabel, focusOnMount = false, disabled = false }: {
    families: BuilderFamily[];
    previews: Record<string, BuilderFamilyPreview>;
    /** The family already open behind this screen, if the customer came back to change it. */
    current?: string;
    pendingFamily?: string | null;
    onChoose: (family: string) => void;
    stepLabel: string;
    focusOnMount?: boolean;
    disabled?: boolean;
}) {
    const headingId = useId();
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => { if (focusOnMount) heading.current?.focus({ preventScroll: true }); }, [focusOnMount]);
    return <section className={styles.chooser} aria-labelledby={headingId} data-family-chooser>
        <div className={styles.intro}>
            <span className={styles.eyebrow}>{stepLabel}</span>
            <h2 id={headingId} ref={heading} tabIndex={-1}>Choose a shape</h2>
            <p>Size, glass, top and cap color follow, each one fitted to the shape you pick.</p>
        </div>
        <ul className={styles.grid}>
            {familyScreenOrder(families).map(({ family }) => {
                const bodies = previews[family]?.bodies ?? [];
                // The group arrives with the sizes: the smallest, the largest and one between.
                const range = familySizeRange(bodies.map(body => body.capacityMl));
                const loading = pendingFamily === family;
                const selected = current === family;
                return <li key={family}>
                    <button type="button" className={`${styles.tile} ${selected ? styles.selected : ""}`} aria-pressed={selected}
                        aria-label={range ? `${family}, ${range}` : family} disabled={disabled || Boolean(pendingFamily)}
                        onClick={() => onChoose(family)} data-family={family}>
                        <span className={styles.stage} aria-hidden="true">
                            <svg viewBox="0 0 100 100" className={styles.group} fill="none" stroke="currentColor" strokeWidth={.9}
                                strokeLinecap="round" strokeLinejoin="round" focusable="false" data-family-icons={Math.max(1, bodies.length)}>
                                <path d={familyIconGroup(family, bodies.map(body => familyPreviewScale(body, bodies)))} />
                            </svg>
                        </span>
                        <span className={styles.name}>{family}</span>
                        <span className={styles.count}>{loading ? `Loading ${family} options…` : range || "\u00a0"}</span>
                    </button>
                </li>;
            })}
        </ul>
    </section>;
}
