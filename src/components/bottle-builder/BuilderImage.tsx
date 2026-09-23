"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { dropperGlassStartY } from "@/lib/bottle-builder/dropper-compositing";
import exposedSprayers from "@/lib/bottle-builder/exposed-sprayers.generated.json";
import type { BuilderConfiguration, BuilderPart } from "@/lib/bottle-builder/model";
import { builderBodyFrame, builderPreviewLayout } from "@/lib/bottle-builder/preview-layout";
import { layerCropStyle, previewFrame } from "@/lib/bottle-builder/preview-frame";

/** Clear glass and the clear dip tube take the stage colour. A published dropper
 * part also contains its metal collar; multiplying a clear dropper assembly
 * exposes the bottle's neck threads through opaque metal. Measured sources split
 * the two materials below. Unmeasured sources keep their existing behaviour. */
function blendsIntoGlass(config: BuilderConfiguration, part: BuilderPart, stage: "body" | "fitment" | "complete", splitDropper: boolean) {
    if (part.slot === "pipette") return config.color !== "Clear";
    return config.color === "Clear" && (part.slot === "diptube"
        || (part.slot === "body" && (stage === "body" || config.fitment !== "Dropper" || splitDropper)));
}

/** These are the existing alpha layers on their registered canvas, never
 * independently resized parts. Only the viewport changes for thumbnails. */
export default function BuilderImage({ config, parts, label, thumbnail = false, expanded = false, scale = 1, stage = "body", showCover = false, bodyReference, frameConfigurations, placeholder = false, priority = false }: {
    config: BuilderConfiguration;
    parts: BuilderPart[];
    label: string;
    thumbnail?: boolean;
    expanded?: boolean;
    stage?: "body" | "fitment" | "complete";
    showCover?: boolean;
    bodyReference?: BuilderConfiguration;
    frameConfigurations?: readonly BuilderConfiguration[];
    /** Relative chooser size; preserves all layer registration and the baseline. */
    scale?: number;
    /** Slate sits behind the layer until it paints — chooser tiles. */
    placeholder?: boolean;
    /** First-viewport cards start immediately instead of waiting on lazy decode. */
    priority?: boolean;
}) {
    const titleId = useId();
    const kit = stage === "body" ? config.previewKit ?? config.kit ?? config.chooserKit : config.kit;
    const exposed = (exposedSprayers as Record<string, { url: string }>)[config.id];
    const fallbackUrl = !kit ? (stage === "complete" && config.photoUrl ? (!showCover && exposed ? exposed.url : config.photoUrl) : config.bodyImage?.url) : undefined;
    const layout = builderPreviewLayout(config, parts, { stage, thumbnail, showCover, bodyReference });
    const layers = layout?.layers ?? [];
    const splitDropper = config.fitment === "Dropper" && layers.some(({ part }) => dropperGlassStartY(part) !== undefined);
    const urls = kit ? layers.map(({ part }) => part.image.url) : fallbackUrl ? [fallbackUrl] : [];
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const urlKey = urls.join("|");
    const [loadState, setLoadState] = useState({ key: urlKey, count: 0 });
    if (loadState.key !== urlKey) setLoadState({ key: urlKey, count: 0 });
    const markLoaded = () => setLoadState(state => state.key === urlKey ? { key: urlKey, count: state.count + 1 } : state);
    const ready = !placeholder || urls.length === 0 || loadState.count >= urls.length || Boolean(failedUrl);

    const wrap = (node: ReactNode) => placeholder
        ? <span data-builder-thumb data-loaded={ready} aria-busy={!ready} style={{ position: "relative", display: "block", width: "100%", height: "100%" }}>
            {!ready && <span data-slate aria-hidden="true" />}
            {node}
        </span>
        : node;

    const imgProps = {
        loading: (priority ? "eager" : "lazy") as "eager" | "lazy",
        decoding: "async" as const,
        onLoad: markLoaded,
        // Never fetchPriority=low: mobile Chrome then starves tiles 8–12.
        ...(priority ? { fetchPriority: "high" as const } : {}),
    };

    if (!kit) {
        if (!fallbackUrl || failedUrl === fallbackUrl) return <span role="img" aria-label={label}>Image unavailable</span>;
        // Reviewed original body layer until a complete finish is selected.
        // eslint-disable-next-line @next/next/no-img-element
        return wrap(<img src={fallbackUrl} alt={label} {...imgProps} data-builder-layer={stage === "complete" ? "assembly" : "body"}
            onError={() => setFailedUrl(fallbackUrl)} style={{ width: expanded ? "auto" : "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", objectPosition: "center", mixBlendMode: config.color === "Clear" && stage !== "complete" ? "multiply" : undefined, transform: expanded ? undefined : `scale(${Math.min(1, scale) * .88})`, transformOrigin: expanded ? "center center" : "bottom center" }} />);
    }
    const failed = layers.some(({ part }) => part.image.url === failedUrl);
    if (!parts.length || failed) return <span role="img" aria-label={label}>Image unavailable</span>;
    const { x, y, width, height } = !thumbnail && frameConfigurations?.length && layout
        ? builderBodyFrame(config, frameConfigurations, bodyReference, layout, { expanded })
        : previewFrame(layout?.anchors ?? kit.anchors, layers.map(layer => layer.bounds), { scale, thumbnail, expanded });
    // A single registered body layer is the chooser tile. <img> fetches in
    // parallel with preload/priority; SVG <image href> waits on hydrate and
    // does not honor loading or fetchPriority — Cylinder tiles sat blank.
    if (layers.length === 1 && !layers[0].transform && !splitDropper) {
        const [{ part }] = layers;
        const crop = layerCropStyle(part.image, { x, y, width, height });
        const blend: CSSProperties["mixBlendMode"] = blendsIntoGlass(config, part, stage, splitDropper) || part.image.url.startsWith("/images/bottle-builder/rollers/") ? "multiply" : undefined;
        // Size is applied once by the frame, equally for a single layer and SVG.
        // layerCropStyle places the layer in percentages of its box, which matches the
        // SVG viewBox only while that box has the frame's own aspect ratio. The SVG
        // this replaced letterboxed (preserveAspectRatio "meet"); CSS has no such
        // default, so a square frame in a wide tile drew every Cylinder 2.4x too wide.
        // The outer span measures the tile; the inner one is the largest box of the
        // frame's ratio that fits inside it, centred — "meet", in both directions.
        const ratio = width / height;
        // The multiply that makes clear glass take the stage colour lives HERE, on the
        // outermost wrapper. mix-blend-mode blends an element with the backdrop of its
        // nearest stacking context, and both the zoom wrapper (transform) and this size
        // container create one — so a multiply on the <img> blended against nothing and
        // every clear bottle drew as an opaque white block.
        return wrap(<span data-chooser-img style={{ containerType: "size", display: "grid", placeItems: "center", width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", overflow: "hidden", mixBlendMode: blend }}>
            <span data-chooser-frame style={{ position: "relative", display: "block", overflow: "hidden", width: `min(100cqw, calc(100cqh * ${ratio}))`, height: `min(100cqh, calc(100cqw / ${ratio}))` }}>
            <span style={{ position: "absolute", inset: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={part.image.url} alt={label} {...imgProps} data-builder-layer={part.slot}
                    onError={() => setFailedUrl(part.image.url)} style={crop} />
            </span>
            </span>
        </span>);
    }
    return wrap(<svg role="img" aria-labelledby={titleId} viewBox={`${x} ${y} ${width} ${height}`} width="400" height="520" preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: expanded ? "auto" : "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", margin: expanded ? "0 auto" : undefined, overflow: expanded ? "visible" : "hidden" }}>
        <title id={titleId}>{label}</title>
        {layers.map(({ part, transform }) => {
            const glassY = splitDropper ? dropperGlassStartY(part) : undefined;
            if (glassY !== undefined) {
                const opaqueId = `${titleId}-${part.slot}-opaque`, glassId = `${titleId}-${part.slot}-glass`;
                return <g key={part.slot} transform={transform}>
                    <defs>
                        <clipPath id={opaqueId} clipPathUnits="userSpaceOnUse"><rect x="0" y="0" width={part.image.width} height={glassY} /></clipPath>
                        <clipPath id={glassId} clipPathUnits="userSpaceOnUse"><rect x="0" y={glassY} width={part.image.width} height={part.image.height - glassY} /></clipPath>
                    </defs>
                    <image href={part.image.url} width={part.image.width} height={part.image.height} x="0" y="0"
                        clipPath={`url(#${opaqueId})`} data-builder-layer={part.slot} data-builder-material="opaque"
                        onLoad={markLoaded} onError={() => setFailedUrl(part.image.url)} />
                    <image href={part.image.url} width={part.image.width} height={part.image.height} x="0" y="0"
                        clipPath={`url(#${glassId})`} data-builder-material="glass" style={{ mixBlendMode: "multiply" }}
                        onError={() => setFailedUrl(part.image.url)} />
                </g>;
            }
            return <image key={part.slot} href={part.image.url} width={part.image.width} height={part.image.height} transform={transform}
                x="0" y="0" style={{ mixBlendMode: blendsIntoGlass(config, part, stage, splitDropper) || part.image.url.startsWith("/images/bottle-builder/rollers/") ? "multiply" : undefined }}
                onLoad={markLoaded} onError={() => setFailedUrl(part.image.url)} data-builder-layer={part.slot} />;
        })}
    </svg>);
}
