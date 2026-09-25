"use client";

/**
 * One kit layer shown as a cut-out at a given height: the cap on the rail, the
 * bare body in the glass lineup, the parts in the Build Your Bottle tiles.
 *
 * Kit layers are full-canvas alpha images (1000×1100) registered to the plate,
 * so the crop is the layer scaled until its bounds fill the box and shifted so
 * the bounds sit at the origin. No blend mode, no background: the alpha is the
 * cut-out. A plain <img>, like every registered paper-doll layer on the site.
 */
import { partCrop, type KitPartLike } from "@/lib/products/pdp-redesign/stage";
import { displayImageUrl } from "@/lib/products/optimizable-image";

export default function PdpKitPartImage({
    part, canvas, height, alt = "", className,
}: {
    part: KitPartLike;
    canvas: { width: number; height: number };
    height: number;
    alt?: string;
    className?: string;
}) {
    const crop = partCrop(part, canvas, height);
    return (
        <span
            className={className}
            style={{ position: "relative", display: "block", overflow: "hidden", width: crop.width, height: crop.height, flex: "none" }}
            data-kit-slot={part.slot}
        >
            {/* Kit layers and plates stay plain <img>: their pixel canvas and alpha must not change. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={displayImageUrl(part.image.url, 640)}
                alt={alt}
                draggable={false}
                decoding="async"
                style={{ position: "absolute", left: crop.left, top: crop.top, width: crop.imgWidth, height: crop.imgHeight, maxWidth: "none", display: "block" }}
            />
        </span>
    );
}
