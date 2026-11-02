import type { CSSProperties } from "react";

// Native chamber endpoints, measured on the two existing registered tube images.
// A different source needs its own registration before receiving this treatment.
const CHAMBERS: Record<string, { source: string; bottom: number }> = {
    "tulip-6ml-13-415": { source: "fedeba5153ac107e87aadebd466100f24bcd87f42d46978944ee63fb36fd8f8f.png", bottom: 376 },
    "sleek-8ml-13-415": { source: "066ac9a0ee66d24f4494bf20c50b1149e3ea649b1a7700e6ec8a763fa2cb9201.svg", bottom: 376 },
};

// Source-specific registration for the remaining Cylinder review layers.
// Both fitment families keep their own chamber shape and one shared shaft
// width. The exposed plastic is never attenuated in EXPLODED.
const CYLINDER_CHAMBERS: Record<string, Array<{ source: string; bottom: number }>> = {
    "cylinder-50ml-18-415": [
        { source: "lotion-tube.cad1b0cae24a.webp", bottom: 278 },
        { source: "spray-tube.1d7b75dddaa9.webp", bottom: 376 },
    ],
    "cylinder-100ml-18-415": [
        { source: "lotion-tube.4c935884bdfa.webp", bottom: 278 },
        { source: "spray-tube.175e68a53415.webp", bottom: 376 },
    ],
};

type GlassKit = { register?: { bodyId: string; glass: string } | null };
type InternalPart = { slot: string; image: { url: string; height: number }; views?: string[] };

/** Reduce the chamber's contrast beneath clear glass; keep the narrow shaft at
 * its existing opacity. Source pixels, placement and detached plastic stay intact. */
export function sprayerPlugMask(kit: GlassKit, part: InternalPart, view: string = "capon"): string | undefined {
    const bodyId = kit.register?.bodyId ?? "";
    const chamber = CHAMBERS[bodyId] ?? CYLINDER_CHAMBERS[bodyId]?.find(entry => part.image.url.endsWith("/" + entry.source));
    if (!chamber || kit.register?.glass !== "Clear" || view === "exploded" || part.slot !== "diptube"
        || !part.views?.includes(view) || part.views.includes("exploded")
        || !part.image.url.endsWith("/" + chamber.source) || part.image.height <= chamber.bottom) return undefined;
    const bottom = chamber.bottom / part.image.height * 100;
    return `linear-gradient(to bottom, rgba(0,0,0,.28) 0%, rgba(0,0,0,.38) ${(bottom * .8).toFixed(3)}%, black ${(bottom + 3).toFixed(3)}%, black 100%)`;
}

/** fill-box makes SVG images use their own bounds, as the HTML image does. */
export function plugMaskStyle(maskImage?: string): CSSProperties | undefined {
    return maskImage ? {
        maskImage, WebkitMaskImage: maskImage, maskMode: "alpha",
        maskOrigin: "fill-box", maskClip: "fill-box",
        maskSize: "100% 100%", maskRepeat: "no-repeat",
    } : undefined;
}
