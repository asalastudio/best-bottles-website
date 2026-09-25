import framingRows from "./catalog-cap-swap-framing.json";

/**
 * How a sibling cap's catalogue plate sits inside an approved hero's frame
 * (measured by scripts/catalog_cap_swap_framing.py).
 *
 * Heroes are one bone photograph per product group; plates are white, framed
 * tighter, and come capped or with the cap beside. For each hero the script
 * picked the plate layout that matches its composition and measured where the
 * hero SKU's own plate lands over the hero's bottle. Every cap in a group
 * shares that bottle and plate framing, so the same placement puts any sibling
 * cap exactly where the hero's stands. `shadow` is the hero's own contact
 * shadow on its own, so the swapped photo keeps it.
 *
 * A hero without an entry did not match its plates closely enough; the card
 * keeps the hero there rather than show a mismatched photograph.
 */
export type CapSwapFraming = {
    plate: "capOff" | "capped";
    /** Plate size as a fraction of the hero image. */
    scale: number;
    /** Plate top-left as a fraction of the hero image. */
    x: number;
    y: number;
    /** Outline correlation of the calibration (1 = identical). */
    match: number;
    shadow: string;
};

const FRAMING = framingRows as Record<string, Partial<CapSwapFraming>>;

export function capSwapFraming(heroUrl: string | null | undefined): CapSwapFraming | null {
    const row = heroUrl ? FRAMING[heroUrl] : undefined;
    if (!row?.shadow || !row.plate || !row.scale) return null;
    return row as CapSwapFraming;
}

/** The plate image the framing was measured on: cap beside, or capped. */
export function capSwapPlateUrl(
    framing: CapSwapFraming,
    plate: { image: string; imageCapOff: string | null } | null | undefined,
): string | null {
    if (!plate) return null;
    return framing.plate === "capOff" ? plate.imageCapOff : plate.image;
}

/** Position of the plate inside the hero image box, in percent. */
export function capSwapPlateBox(framing: CapSwapFraming) {
    return {
        left: `${framing.x * 100}%`,
        top: `${framing.y * 100}%`,
        width: `${framing.scale * 100}%`,
        height: `${framing.scale * 100}%`,
    };
}
