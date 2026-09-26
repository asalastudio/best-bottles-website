"use client";

/**
 * Several kit layers shown together as one cut-out at a given height: a
 * sprayer's head on its collar for the cap rail, so the finish reads rather
 * than the overcap that hides it. Each layer is cropped against the stack's
 * shared rectangle, so they keep their registration.
 */
import PdpKitPartImage from "./PdpKitPartImage";
import { partCrop, unionBounds, type KitPartLike } from "@/lib/products/pdp-redesign/stage";

export default function PdpKitStackImage({
    parts, canvas, height, alt = "", className,
}: {
    parts: KitPartLike[];
    canvas: { width: number; height: number };
    height: number;
    alt?: string;
    className?: string;
}) {
    if (parts.length === 0) return null;
    if (parts.length === 1) return <PdpKitPartImage part={parts[0]} canvas={canvas} height={height} alt={alt} className={className} />;
    const bounds = unionBounds(parts);
    const outer = partCrop(parts[0], canvas, height, bounds);
    return (
        <span
            className={className}
            style={{ position: "relative", display: "block", overflow: "hidden", width: outer.width, height: outer.height, flex: "none" }}
            role={alt ? "img" : undefined}
            aria-label={alt || undefined}
            data-kit-stack={parts.map((part) => part.slot).join("+")}
        >
            {parts.map((part, index) => (
                <PdpKitPartImage
                    key={`${part.slot}-${index}`}
                    part={part}
                    canvas={canvas}
                    height={height}
                    bounds={bounds}
                    className="pdp-stack-layer"
                    style={{ position: "absolute", left: 0, top: 0 }}
                />
            ))}
        </span>
    );
}
