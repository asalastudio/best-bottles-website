"use client";

import { useEffect, useId, useRef, useState } from "react";
import FamilyShapeGroup from "@/components/icons/FamilyShapeGroup";
import type { BuilderFamily } from "@/lib/bottle-builder/entry";
import { familyPreviewScale, familyScreenOrder, familySizeRange, pickFamilyTileSizes, type BuilderFamilyPreview } from "@/lib/bottle-builder/family-previews";
import styles from "./FamilyChooser.module.css";

export type FamilyPreviewPayload = { families: BuilderFamilyPreview[] } | null;

/** Each family's sizes and option count stream into the page after the tiles have painted with one outline each.
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
            setPreviews(Object.fromEntries(payload.families.map(f => [f.family, f])));
        }, () => { settled = true; });
        // Closing the screen mid-request drops the answer; let the next opening ask again.
        return () => { live = false; if (!settled) asked.current = false; };
    }, [streamed, shown]);
    return previews;
}

/** The outline group's heights: the family's smallest, middle and largest size as shares of the tallest. */
function tileHeights(family: string, sizes: number[]) {
    const picked = pickFamilyTileSizes(sizes).map(capacityMl => ({ family, capacityMl }));
    return picked.length ? picked.map(size => familyPreviewScale(size, picked)) : [1];
}

/**
 * Build Your Bottle's first screen (Jordan, 20 Nov 2026): choose the shape before the size. Each family is
 * drawn as outline icons, one per size (smallest, middle, largest) at their measured relative heights, with
 * its size range (Jordan's 24 Nov mock-up, in place of the 20 Nov photo groups). Until the sizes arrive,
 * and for a family whose sizes failed to load, the tile draws a single outline.
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
                const sizes = previews[family]?.sizes ?? [];
                const range = familySizeRange(sizes);
                // Options = sizes × glass colours; it arrives with the sizes. Until then the tile shows no count.
                const options = previews[family]?.options ?? 0;
                const countLabel = options ? `${options} ${options === 1 ? "option" : "options"}` : "";
                const detail = [range, countLabel].filter(Boolean).join(" · ");
                const loading = pendingFamily === family;
                const selected = current === family;
                return <li key={family}>
                    <button type="button" className={`${styles.tile} ${selected ? styles.selected : ""}`} aria-pressed={selected}
                        aria-label={[family, range, countLabel].filter(Boolean).join(", ")} disabled={disabled || Boolean(pendingFamily)}
                        onClick={() => onChoose(family)} data-family={family}>
                        <span className={styles.stage} aria-hidden="true">
                            <FamilyShapeGroup family={family} heights={tileHeights(family, sizes)} className={styles.group} data-sizes={sizes.length || undefined} />
                        </span>
                        <span className={styles.name}>{family}</span>
                        <span className={styles.count}>{loading ? `Loading ${family} options…` : detail || "\u00a0"}</span>
                    </button>
                </li>;
            })}
        </ul>
    </section>;
}
