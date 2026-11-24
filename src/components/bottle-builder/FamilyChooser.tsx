"use client";

import { useEffect, useId, useRef, useState } from "react";
import FamilyShapeIcon from "@/components/icons/FamilyShapeIcon";
import BuilderImage from "@/components/bottle-builder/BuilderImage";
import { previewParts } from "@/lib/bottle-builder/model";
import type { BuilderFamily } from "@/lib/bottle-builder/entry";
import { familyPreviewScale, familyScreenOrder, type BuilderFamilyPreview } from "@/lib/bottle-builder/family-previews";
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
 * Build Your Bottle's first screen (Jordan, 20 Nov 2026): choose the shape before the size. Each family
 * is a small group of its own bottles, the bare clear glass the bottle step draws, at their measured
 * relative heights; until those arrive, and for a family with no drawable body, its outline icon.
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
            <h2 id={headingId} ref={heading} tabIndex={-1}>Choose your bottle family</h2>
            <p>Start with a shape. Every size, glass and fitment after this is made for the family you choose.</p>
        </div>
        <ul className={styles.grid}>
            {familyScreenOrder(families).map(({ family }) => {
                const bodies = previews[family]?.bodies ?? [];
                // Options = sizes × glass colours; it arrives with the bottle groups. Until then the tile shows no count.
                const options = previews[family]?.options ?? 0;
                const countLabel = options ? `${options} ${options === 1 ? "option" : "options"}` : "";
                const loading = pendingFamily === family;
                const selected = current === family;
                return <li key={family}>
                    <button type="button" className={`${styles.tile} ${selected ? styles.selected : ""}`} aria-pressed={selected}
                        aria-label={countLabel ? `${family}, ${countLabel}` : family} disabled={disabled || Boolean(pendingFamily)}
                        onClick={() => onChoose(family)} data-family={family}>
                        <span className={styles.stage} aria-hidden="true">
                            {bodies.length ? bodies.map(body => {
                                const config = body.configurations[0];
                                return <span key={body.id} className={styles.bottle}>
                                    <BuilderImage config={config} parts={previewParts(config, "body")} label={`${body.capacityMl} ml ${family} bottle`}
                                        scale={familyPreviewScale(body, bodies)} thumbnail />
                                </span>;
                            }) : <FamilyShapeIcon family={family} size={72} strokeWidth={0.8} className={styles.outline} />}
                        </span>
                        <span className={styles.name}><FamilyShapeIcon family={family} size={18} strokeWidth={1.1} />{family}</span>
                        <span className={styles.count}>{loading ? `Loading ${family} options…` : countLabel || "\u00a0"}</span>
                    </button>
                </li>;
            })}
        </ul>
    </section>;
}
