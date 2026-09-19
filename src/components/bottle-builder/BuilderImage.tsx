"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import exposedSprayers from "@/lib/bottle-builder/exposed-sprayers.generated.json";
import type { BuilderConfiguration, BuilderPart } from "@/lib/bottle-builder/model";
import { registerVintagePreview } from "@/lib/bottle-builder/preview-registration";
import { layerCropStyle, previewFrame } from "@/lib/bottle-builder/preview-frame";

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
    /** Slate sits behind the layer until it paints — chooser tiles. */
    placeholder?: boolean;
    /** First-viewport cards start immediately instead of waiting on lazy decode. */
    priority?: boolean;
}) {
    const titleId = useId();
    const kit = stage === "body" ? config.previewKit ?? config.kit ?? config.chooserKit : config.kit;
    const exposed = (exposedSprayers as Record<string, { url: string }>)[config.id];
    const fallbackUrl = !kit ? (stage === "complete" && config.photoUrl ? (!showCover && exposed ? exposed.url : config.photoUrl) : config.bodyImage?.url) : undefined;
    const registration = kit && !thumbnail ? registerVintagePreview(config, parts, bodyReference) : null;
    let layers = kit ? registration?.layers ?? parts.map(part => ({ part, bounds: part.bounds, transform: undefined })) : [];
    // A pump or sprayer is shown working, its overcap standing on the ground
    // beside the bottle so the shopper sees what comes with it (Jordan,
    // 2026-09-16). Display only: the assembled registration is untouched.
    if (kit && !thumbnail && !showCover && stage !== "body" && layers.some(l => l.part.slot === "overcap") && layers.some(l => !["body", "overcap", "diptube"].includes(l.part.slot))) {
        const body = layers.find(l => l.part.slot === "body");
        const baseline = registration?.anchors.baselineY ?? kit.anchors.baselineY;
        layers = layers.map(l => {
            if (l.part.slot !== "overcap" || !body) return l;
            const gap = Math.max(18, (body.bounds.right - body.bounds.left) * .08);
            const dx = body.bounds.right + gap - l.bounds.left, dy = baseline - l.bounds.bottom;
            return { ...l, bounds: { left: l.bounds.left + dx, right: l.bounds.right + dx, top: l.bounds.top + dy, bottom: l.bounds.bottom + dy },
                transform: `translate(${dx} ${dy})${l.transform ? ` ${l.transform}` : ""}` };
        });
    }
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
            onError={() => setFailedUrl(fallbackUrl)} style={{ width: expanded ? "auto" : "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", objectPosition: "center", mixBlendMode: config.color === "Clear" && stage !== "complete" ? "multiply" : undefined, transform: expanded ? undefined : `scale(${scale * .88})`, transformOrigin: expanded ? "center center" : "bottom center" }} />);
    }
    const failed = layers.some(({ part }) => part.image.url === failedUrl);
    if (!parts.length || failed) return <span role="img" aria-label={label}>Image unavailable</span>;
    const { x, y, width, height } = previewFrame(registration?.anchors ?? kit.anchors,
        layers.map(layer => layer.bounds), { scale, thumbnail, expanded });
    // A single registered body layer is the chooser tile. <img> fetches in
    // parallel with preload/priority; SVG <image href> waits on hydrate and
    // does not honor loading or fetchPriority — Cylinder tiles sat blank.
    if (layers.length === 1) {
        const [{ part }] = layers;
        const crop = layerCropStyle(part.image, { x, y, width, height });
        const blend: CSSProperties["mixBlendMode"] = (config.color === "Clear" && ["body", "diptube"].includes(part.slot)) || part.image.url.startsWith("/images/bottle-builder/rollers/") ? "multiply" : undefined;
        return wrap(<span data-chooser-img style={{ position: "relative", display: "block", width: expanded ? "auto" : "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", margin: expanded ? "0 auto" : undefined, overflow: "hidden" }}>
            <span style={{ position: "absolute", inset: 0, transform: expanded ? undefined : `scale(${thumbnail ? scale : scale * .88})`, transformOrigin: "bottom center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={part.image.url} alt={label} {...imgProps} data-builder-layer={part.slot}
                    onError={() => setFailedUrl(part.image.url)} style={{ ...crop, mixBlendMode: blend }} />
            </span>
        </span>);
    }
    return wrap(<svg role="img" aria-labelledby={titleId} viewBox={`${x} ${y} ${width} ${height}`} width="400" height="520" preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: expanded ? "auto" : "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", margin: expanded ? "0 auto" : undefined, overflow: expanded ? "visible" : "hidden" }}>
        <title id={titleId}>{label}</title>
        {layers.map(({ part, transform }) => <image key={part.slot} href={part.image.url} width={part.image.width} height={part.image.height} transform={transform}
            x="0" y="0" style={{ mixBlendMode: (config.color === "Clear" && ["body", "diptube"].includes(part.slot)) || part.image.url.startsWith("/images/bottle-builder/rollers/") ? "multiply" : undefined }}
            onLoad={markLoaded} onError={() => setFailedUrl(part.image.url)} data-builder-layer={part.slot} />)}
    </svg>);
}
