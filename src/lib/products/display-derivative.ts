import manifest from "./display-images.generated.json";
import reviewManifest from "./review-display-images.generated.json";

type DisplaySources = Record<string, Record<"128" | "256" | "640" | "1200", string>>;
// Local candidates retain their original master URLs in the kits. Their
// delivery entries are reached only by explicitly gated localhost recipes.
const sources = { ...manifest.sources, ...reviewManifest.sources } as DisplaySources;
const aliases = manifest.aliases as Record<string, string>;
const pixelWidths = { ...manifest.pixelWidths, ...reviewManifest.pixelWidths } as Record<string, Record<string, number>>;

/** Immutable, lossless delivery copies of the exact approved sources. This
 * changes download bytes only. Keep the original source identity, registered
 * box, aspect ratio, alpha masks and anchor data on every kit part. */
export function displayDerivativeUrl(source: string, width: number): string | null {
    const canonical = Object.hasOwn(aliases, source) ? aliases[source] : source;
    if (!Object.hasOwn(sources, canonical)) return null;
    const size = width <= 128 ? "128" : width <= 256 ? "256" : width <= 640 ? "640" : "1200";
    return sources[canonical][size];
}

export function displayDerivativeSrcSet(source: string): string | undefined {
    if (!displayDerivativeUrl(source, 640)) return undefined;
    const canonical = Object.hasOwn(aliases, source) ? aliases[source] : source;
    const candidates = new Map<number, string>();
    for (const width of [128, 256, 640, 1200]) {
        const actualWidth = pixelWidths[canonical][width];
        // Sources are never enlarged. A 50px native cap remains one 50w
        // candidate, rather than being advertised as a fictitious 1200px copy.
        if (!candidates.has(actualWidth)) candidates.set(actualWidth, displayDerivativeUrl(source, width)!);
    }
    return [...candidates].map(([width, url]) => `${url} ${width}w`).join(", ");
}

/** The canvas cannot exceed the full viewport on mobile or its 55% desktop
 * column. Use the registered width and uniform frame scale, including zoom.
 * This describes delivery resolution without changing the painted CSS box. */
export function registeredImageSizes(widthPct: number, frameScale: number, zoom = 1): string {
    const mobile = Math.ceil(widthPct * frameScale * zoom * 100) / 100;
    const desktop = Math.ceil(mobile * .55 * 100) / 100;
    return `(max-width: 767px) ${mobile}vw, ${desktop}vw`;
}
