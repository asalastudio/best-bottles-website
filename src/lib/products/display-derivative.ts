/**
 * Immutable, lossless delivery copies of the exact approved sources (128, 256,
 * 640 and 1200 px WebP on Vercel Blob). They change download bytes only: the
 * source identity, registered box, aspect ratio, alpha masks and anchor data
 * stay on every kit part.
 *
 * The manifest that maps a source to its copies is 733 KB of JSON. It used to
 * be imported here, which put it in the client JavaScript of every page. It is
 * now read only on the server (`display-derivative.server.ts`), which hands
 * each page the handful of entries its kits use; those arrive as a prop or
 * inside an API response and are registered below before the components that
 * need them render. Server renders see the whole manifest, so a server and
 * its hydrating client resolve the same source to the same copy.
 */
export type DisplayDerivativeSize = "128" | "256" | "640" | "1200";

export type DisplayDerivativeEntry = {
    /** Delivery copy per size bucket. */
    urls: Record<DisplayDerivativeSize, string>;
    /** Real pixel width of each copy; a 50 px native cap is never advertised as 1200 px. */
    widths: Record<DisplayDerivativeSize, number>;
};

/** Source URL (or a local alias of one) → its delivery copies. */
export type DisplayDerivativeMap = Record<string, DisplayDerivativeEntry>;

const registry = new Map<string, DisplayDerivativeEntry>();

/** Make a page's or a response's entries resolvable. Idempotent, safe to call during render. */
export function registerDisplayDerivatives(entries: DisplayDerivativeMap | null | undefined): void {
    if (!entries) return;
    for (const [source, entry] of Object.entries(entries)) {
        if (entry && entry.urls && entry.widths) registry.set(source, entry);
    }
}

export function hasDisplayDerivative(source: string): boolean {
    return registry.has(source);
}

/** Number of sources currently resolvable (tests and diagnostics). */
export function registeredDisplayDerivativeCount(): number {
    return registry.size;
}

export function displayDerivativeSize(width: number): DisplayDerivativeSize {
    return width <= 128 ? "128" : width <= 256 ? "256" : width <= 640 ? "640" : "1200";
}

export function displayDerivativeUrl(source: string, width: number): string | null {
    const entry = registry.get(source);
    if (!entry) return null;
    return entry.urls[displayDerivativeSize(width)];
}

export function displayDerivativeSrcSet(source: string): string | undefined {
    const entry = registry.get(source);
    if (!entry) return undefined;
    const candidates = new Map<number, string>();
    for (const size of ["128", "256", "640", "1200"] as const) {
        const actualWidth = entry.widths[size];
        // Sources are never enlarged. A 50px native cap remains one 50w
        // candidate, rather than being advertised as a fictitious 1200px copy.
        if (!candidates.has(actualWidth)) candidates.set(actualWidth, entry.urls[size]);
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
