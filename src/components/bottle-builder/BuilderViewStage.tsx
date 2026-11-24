"use client";

import { useMemo, useState } from "react";
import { bostonDropperCutout } from "@/lib/products/boston-dropper-cutout";
import { plugMaskStyle } from "@/lib/products/sprayer-glass-transmission";
import { displayImageUrl } from "@/lib/products/optimizable-image";
import { registeredImageSizes } from "@/lib/products/display-derivative";
import { markRegisterOptimizerUnavailable, registerImageSrc, registerImageSrcSet } from "@/lib/products/register-image";
import { availableViews, STAGE_VIEWS, stageLayout, type KitLike, type StageContext, type StageView } from "@/lib/products/pdp-redesign/stage";
import type { BuilderConfiguration } from "@/lib/bottle-builder/model";
import styles from "./BuilderViewStage.module.css";

/** The cap beside the glass reads CAP OFF here: the builder customer just put that cap on the bottle. */
export function builderViewLabel(view: StageView) {
    if (view === "sidecar") return "CAP OFF";
    return STAGE_VIEWS.find(option => option.id === view)?.label ?? view.toUpperCase();
}

export function builderStageContext(configuration: BuilderConfiguration): StageContext {
    return {
        family: configuration.family,
        capacityMl: configuration.capacityMl,
        color: configuration.color,
        applicator: configuration.fitment,
        websiteSku: configuration.product.websiteSku ?? configuration.id,
    };
}

/** The kit as the product page draws it: every part, each tagged with the views it appears in. */
function viewKit(configuration: BuilderConfiguration | null | undefined): KitLike | null {
    const kit = configuration?.kit;
    if (!kit) return null;
    return (kit.viewParts ? { ...kit, parts: kit.viewParts } : kit) as unknown as KitLike;
}

/** The views this finished bottle can be shown in, in the product page's order: cap on first. */
export function builderViews(configuration: BuilderConfiguration | null | undefined): StageView[] {
    const kit = viewKit(configuration);
    if (!configuration || !kit?.parts?.length) return [];
    const views = availableViews(kit, builderStageContext(configuration));
    return (["capon", "sidecar", "exploded"] as StageView[]).filter(view => views.includes(view));
}

/**
 * The finished bottle in the product page's three views (Jordan, 20 Nov 2026: "repurpose the same cap on,
 * cap off and exploded features"). The geometry is the product page's own `stageLayout`; this component only
 * draws its layers inside the builder's preview, with the same image delivery the product page uses.
 */
export default function BuilderViewStage({ configuration, view, label }: { configuration: BuilderConfiguration; view: StageView; label: string }) {
    const kit = useMemo(() => viewKit(configuration), [configuration]);
    const context = useMemo(() => builderStageContext(configuration), [configuration]);
    const layout = useMemo(() => stageLayout(kit, view, context), [kit, view, context]);
    const [rawUrls, setRawUrls] = useState<ReadonlySet<string>>(() => new Set());
    const showRaw = (url: string) => setRawUrls(current => (current.has(url) ? current : new Set(current).add(url)));
    if (!layout) return null;
    return <div className={styles.stage} data-view={view} data-builder-view-stage role="img" aria-label={label}>
        <div className={styles.host}>
            <div className={styles.canvas}>
                <div className={styles.frame} style={{ transform: layout.frameCss }}>
                    {layout.floorShadows.map(shadow => <span key={shadow.key} className={styles.floorShadow} aria-hidden
                        style={{ left: `${shadow.leftPct}%`, top: `${shadow.topPct}%`, width: `${shadow.widthPct}%`, height: `${shadow.heightPct}%` }} />)}
                    {layout.parts.map(part => part.box ? (
                        <span key={part.key} className={styles.part} data-slot={part.slot}
                            style={{ transform: `translate(${part.dxPct}%, ${part.dyPct}%)`, zIndex: part.zIndex, mixBlendMode: part.blendMode }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={rawUrls.has(part.url) ? part.url : registerImageSrc(part.url, 640)}
                                srcSet={rawUrls.has(part.url) ? undefined : registerImageSrcSet(part.url)}
                                sizes={registeredImageSizes(part.box.widthPct, layout.frame.scale, 1)}
                                alt="" draggable={false} decoding="async" loading="eager"
                                onError={() => { if (markRegisterOptimizerUnavailable(part.url)) showRaw(part.url); }}
                                style={{
                                    position: "absolute", display: "block", maxWidth: "none", opacity: part.opacity,
                                    ...plugMaskStyle(part.maskImage),
                                    left: `${part.box.leftPct}%`, top: `${part.box.topPct}%`, width: `${part.box.widthPct}%`, height: `${part.box.heightPct}%`,
                                    ...(part.clipBottomPct ? { clipPath: `inset(0 0 ${part.clipBottomPct}% 0)` } : {}),
                                }} />
                        </span>
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={part.key} src={displayImageUrl(part.url)} srcSet={registerImageSrcSet(part.url)}
                            sizes={registeredImageSizes(100, layout.frame.scale, 1)} alt="" draggable={false} decoding="async" loading="eager"
                            className={styles.part} data-slot={part.slot}
                            style={{ transform: `translate(${part.dxPct}%, ${part.dyPct}%)`, zIndex: part.zIndex, mixBlendMode: part.blendMode, clipPath: bostonDropperCutout(part.url) }} />
                    ))}
                </div>
            </div>
        </div>
    </div>;
}
