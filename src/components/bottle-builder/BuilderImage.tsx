"use client";

import { useId, useState } from "react";
import exposedSprayers from "@/lib/bottle-builder/exposed-sprayers.generated.json";
import type { BuilderConfiguration, BuilderPart } from "@/lib/bottle-builder/model";
import { registerVintagePreview } from "@/lib/bottle-builder/preview-registration";
import { previewFrame } from "@/lib/bottle-builder/preview-frame";

/** These are the existing alpha layers on their registered canvas, never
 * independently resized parts. Only the viewport changes for thumbnails. */
export default function BuilderImage({ config, parts, label, thumbnail = false, expanded = false, scale = 1, stage = "body", showCover = false, bodyReference }: {
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
}) {
    const titleId = useId();
    const kit = stage === "body" ? config.previewKit ?? config.kit : config.kit;
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    if (!kit) {
        const exposed = (exposedSprayers as Record<string, { url: string }>)[config.id];
        const url = stage === "complete" && config.photoUrl ? (!showCover && exposed ? exposed.url : config.photoUrl) : config.bodyImage?.url;
        if (!url || failedUrl === url) return <span role="img" aria-label={label}>Image unavailable</span>;
        // Reviewed original body layer until a complete finish is selected.
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={url} alt={label} loading="lazy" data-builder-layer={stage === "complete" ? "assembly" : "body"}
            onError={() => setFailedUrl(url)} style={{ width: "100%", height: "100%", objectFit: "contain", mixBlendMode: config.color === "Clear" && stage !== "complete" ? "multiply" : undefined, transform: expanded ? undefined : `scale(${scale * .88})`, transformOrigin: "bottom center" }} />;
    }
    const registration = !thumbnail ? registerVintagePreview(config, parts, bodyReference) : null;
    const layers = registration?.layers ?? parts.map(part => ({ part, bounds: part.bounds, transform: undefined }));
    const failed = layers.some(({ part }) => part.image.url === failedUrl);
    if (!parts.length || failed) return <span role="img" aria-label={label}>Image unavailable</span>;
    const { x, y, width, height } = previewFrame(registration?.anchors ?? kit.anchors,
        layers.map(layer => layer.bounds), { scale, thumbnail, expanded });
    return <svg role="img" aria-labelledby={titleId} viewBox={`${x} ${y} ${width} ${height}`} width="400" height="520" style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        <title id={titleId}>{label}</title>
        {layers.map(({ part, transform }) => <image key={part.slot} href={part.image.url} width={part.image.width} height={part.image.height} transform={transform}
            x="0" y="0" style={{ mixBlendMode: (config.color === "Clear" && ["body", "diptube"].includes(part.slot)) || part.image.url.startsWith("/images/bottle-builder/rollers/") ? "multiply" : undefined }}
            onError={() => setFailedUrl(part.image.url)} data-builder-layer={part.slot} />)}
    </svg>;
}
