import manifest from "./display-images.generated.json";

type DisplaySources = Record<string, Record<"128" | "256" | "640" | "1200", string>>;
const sources = manifest.sources as DisplaySources;
const aliases = manifest.aliases as Record<string, string>;

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
    return [128, 256, 640, 1200].map(width => `${displayDerivativeUrl(source, width)} ${width}w`).join(", ");
}

/** The canvas cannot exceed the full viewport on mobile or its 55% desktop
 * column. Use the registered width and uniform frame scale, including zoom.
 * This describes delivery resolution without changing the painted CSS box. */
export function registeredImageSizes(widthPct: number, frameScale: number, zoom = 1): string {
    const mobile = Math.ceil(widthPct * frameScale * zoom * 100) / 100;
    const desktop = Math.ceil(mobile * .55 * 100) / 100;
    return `(max-width: 767px) ${mobile}vw, ${desktop}vw`;
}
