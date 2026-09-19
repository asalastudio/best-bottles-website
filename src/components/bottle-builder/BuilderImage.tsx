"use client";

import { useId, useState, type ReactNode } from "react";
import exposedSprayers from "@/lib/bottle-builder/exposed-sprayers.generated.json";
import type { BuilderConfiguration, BuilderPart } from "@/lib/bottle-builder/model";
import { registerVintagePreview } from "@/lib/bottle-builder/preview-registration";
import { previewFrame } from "@/lib/bottle-builder/preview-frame";

/** These are the existing alpha layers on their registered canvas, never
 * independently resized parts. Only the viewport changes for thumbnails. */
export default function BuilderImage({ config, parts, label, thumbnail = false, expanded = false, scale = 1, stage = "body", showCover = false, bodyReference, placeholder = false, priority = false }: {
    config: BuilderConfiguration;
    parts: BuilderPart[];
    label: string;
    thumbnail?: boolean;
    expanded?: boolean;
    stage?: "body" | "fitment" | "complete";
    showCover?: boolean;
    bodyReference?: BuilderConfiguration;
    /** Relative chooser size; preserves all layer registration and the baseline. */
    scale?: number;
    /** Slate shimmer until the layer paints — mobile chooser only. */
    placeholder?: boolean;
    /** First-viewport cards start immediately instead of waiting on lazy decode. */
    priority?: boolean;
}) {
    const titleId = useId();
    const kit = stage === "body" ? config.previewKit ?? config.kit ?? config.chooserKit : config.kit;
    const exposed = (exposedSprayers as Record<string, { url: string }>)[config.id];
    const fallbackUrl = !kit ? (stage === "complete" && config.photoUrl ? (!showCover && exposed ? exposed.url : config.photoUrl) : config.bodyImage?.url) : undefined;
    const registration = kit && !thumbnail ? registerVintagePreview(config, parts, bodyReference) : null;
    const layers = kit ? registration?.layers ?? parts.map(part => ({ part, bounds: part.bounds, transform: undefined })) : [];
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

    if (!kit) {
        if (!fallbackUrl || failedUrl === fallbackUrl) return <span role="img" aria-label={label}>Image unavailable</span>;
        // Reviewed original body layer until a complete finish is selected.
        // eslint-disable-next-line @next/next/no-img-element
        return wrap(<img src={fallbackUrl} alt={label} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "low"} decoding="async" data-builder-layer={stage === "complete" ? "assembly" : "body"}
            onLoad={markLoaded} onError={() => setFailedUrl(fallbackUrl)} style={{ width: expanded ? "auto" : "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", objectPosition: "center", mixBlendMode: config.color === "Clear" && stage !== "complete" ? "multiply" : undefined, transform: expanded ? undefined : `scale(${scale * .88})`, transformOrigin: expanded ? "center center" : "bottom center" }} />);
    }
    const failed = layers.some(({ part }) => part.image.url === failedUrl);
    if (!parts.length || failed) return <span role="img" aria-label={label}>Image unavailable</span>;
    const { x, y, width, height } = previewFrame(registration?.anchors ?? kit.anchors,
        layers.map(layer => layer.bounds), { scale, thumbnail, expanded });
    return wrap(<svg role="img" aria-labelledby={titleId} viewBox={`${x} ${y} ${width} ${height}`} width="400" height="520" preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: expanded ? "auto" : "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", margin: expanded ? "0 auto" : undefined, overflow: expanded ? "visible" : "hidden" }}>
        <title id={titleId}>{label}</title>
        {layers.map(({ part, transform }) => <image key={part.slot} href={part.image.url} width={part.image.width} height={part.image.height} transform={transform}
            x="0" y="0" style={{ mixBlendMode: (config.color === "Clear" && ["body", "diptube"].includes(part.slot)) || part.image.url.startsWith("/images/bottle-builder/rollers/") ? "multiply" : undefined }}
            onLoad={markLoaded} onError={() => setFailedUrl(part.image.url)} data-builder-layer={part.slot} />)}
    </svg>);
}
