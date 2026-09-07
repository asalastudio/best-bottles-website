"use client";

import { useId, useState } from "react";
import type { BuilderConfiguration, BuilderPart } from "@/lib/bottle-builder/model";

/** These are the existing alpha layers on their registered canvas, never
 * independently resized parts. Only the viewport changes for thumbnails. */
export default function BuilderImage({ config, parts, label, thumbnail = false, scale = 1, stage = "body" }: {
    config: BuilderConfiguration;
    parts: BuilderPart[];
    label: string;
    thumbnail?: boolean;
    stage?: "body" | "fitment" | "complete";
    /** Relative chooser size; preserves all layer registration and the baseline. */
    scale?: number;
}) {
    const titleId = useId();
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    if (!config.kit) {
        const url = stage === "complete" && config.photoUrl ? config.photoUrl : config.bodyImage?.url;
        if (!url || failedUrl === url) return <span role="img" aria-label={label}>Image unavailable</span>;
        // Reviewed original body layer until a complete finish is selected.
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={url} alt={label} loading="lazy" data-builder-layer={stage === "complete" ? "assembly" : "body"}
            onError={() => setFailedUrl(url)} style={{ width: "100%", height: "100%", objectFit: "contain", transform: `scale(${scale * .88})`, transformOrigin: "bottom center" }} />;
    }
    const failed = parts.some(part => part.image.url === failedUrl);
    if (!parts.length || failed) return <span role="img" aria-label={label}>Image unavailable</span>;
    const { axisX, seatY, baselineY } = config.kit.anchors;
    const bodyHeight = baselineY - seatY;
    let x = axisX - bodyHeight * .55 / scale;
    let y = baselineY - bodyHeight * 1.43 / scale;
    let width = bodyHeight * 1.1 / scale;
    let height = bodyHeight * 1.53 / scale;
    if (thumbnail) {
        const left = Math.min(...parts.map(p => p.bounds.left));
        const right = Math.max(...parts.map(p => p.bounds.right));
        const top = Math.min(...parts.map(p => p.bounds.top));
        const bottom = Math.max(...parts.map(p => p.bounds.bottom));
        const size = Math.max(right - left, bottom - top) * 1.22;
        x = (left + right - size) / 2; y = (top + bottom - size) / 2; width = size; height = size;
    }
    return <svg role="img" aria-labelledby={titleId} viewBox={`${x} ${y} ${width} ${height}`} width="400" height="520" style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        <title id={titleId}>{label}</title>
        {parts.map(part => <image key={part.slot} href={part.image.url} width={part.image.width} height={part.image.height}
            x="0" y="0" onError={() => setFailedUrl(part.image.url)} data-builder-layer={part.slot} />)}
    </svg>;
}
