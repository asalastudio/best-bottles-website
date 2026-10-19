"use client";

import { displayImageUrl } from "@/lib/products/optimizable-image";

type ExplodedPart = {
    slot: string;
    zOrder: number;
    variantKey?: string | null;
    image: { url: string; width: number; height: number };
    exploded: { dx: number; dy: number };
};

/**
 * Classic PDP exploded kit. Loaded only after the customer picks exploded view,
 * so the first product paint does not download this module.
 */
export default function ExplodedViewer({
    parts,
    groupTitle,
}: {
    parts: ExplodedPart[];
    groupTitle: string;
}) {
    return (
        <>
            {parts.map((part) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    key={part.slot}
                    src={displayImageUrl(part.image.url)}
                    alt={part.slot === "body" ? `${groupTitle} bottle` : `${part.slot} — ${part.variantKey ?? ""}`}
                    width={part.image.width}
                    height={part.image.height}
                    decoding="async"
                    style={{
                        zIndex: part.zOrder,
                        transform: `translate(${(part.exploded.dx / 10).toFixed(2)}%, ${(part.exploded.dy / 11).toFixed(2)}%)`,
                    }}
                    className="absolute inset-0 h-full w-full object-contain"
                />
            ))}
        </>
    );
}
