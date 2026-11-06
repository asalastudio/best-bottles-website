import "server-only";
import manifest from "./display-images.generated.json";
import reviewManifest from "./review-display-images.generated.json";
import {
    registerDisplayDerivatives,
    type DisplayDerivativeEntry,
    type DisplayDerivativeMap,
    type DisplayDerivativeSize,
} from "./display-derivative";

/**
 * The only module that reads the generated display manifests. Importing it
 * registers every source for this server process, so server components, API
 * routes and the PDP preloads resolve exactly as before. It also builds the
 * per-page subset that is sent to the browser (`collectDisplayDerivatives`).
 */
type Sizes = Record<DisplayDerivativeSize, string>;
type Widths = Record<DisplayDerivativeSize, number>;

function build(): DisplayDerivativeMap {
    // Local candidates retain their original master URLs in the kits. Their
    // delivery entries are reached only by explicitly gated localhost recipes.
    const sources = { ...manifest.sources, ...reviewManifest.sources } as Record<string, Sizes>;
    const widths = { ...manifest.pixelWidths, ...reviewManifest.pixelWidths } as Record<string, Widths>;
    const aliases = manifest.aliases as Record<string, string>;
    const map: DisplayDerivativeMap = {};
    for (const [source, urls] of Object.entries(sources)) {
        const entry: DisplayDerivativeEntry = { urls, widths: widths[source] };
        map[source] = entry;
    }
    for (const [alias, canonical] of Object.entries(aliases)) {
        if (map[canonical]) map[alias] = map[canonical];
    }
    return map;
}

/** Every known source, alias included. Frozen after the first build. */
export const ALL_DISPLAY_DERIVATIVES: Readonly<DisplayDerivativeMap> = build();

registerDisplayDerivatives(ALL_DISPLAY_DERIVATIVES);

/** The entries for an explicit list of source URLs. Unknown URLs are skipped. */
export function displayDerivativesFor(sources: Iterable<string>): DisplayDerivativeMap {
    const out: DisplayDerivativeMap = {};
    for (const source of sources) {
        const entry = ALL_DISPLAY_DERIVATIVES[source];
        if (entry) out[source] = entry;
    }
    return out;
}

/**
 * Walk any serialisable value (a PDP payload, a kit map, an API response) and
 * return the entries for every string in it that names a known source. The
 * subset is complete by construction: whatever URL a client component can read
 * out of that value is resolvable once the client registers the result.
 */
export function collectDisplayDerivatives(value: unknown): DisplayDerivativeMap {
    const out: DisplayDerivativeMap = {};
    const seen = new Set<object>();
    const walk = (node: unknown) => {
        if (typeof node === "string") {
            const entry = ALL_DISPLAY_DERIVATIVES[node];
            if (entry) out[node] = entry;
            return;
        }
        if (!node || typeof node !== "object") return;
        if (seen.has(node)) return;
        seen.add(node);
        if (Array.isArray(node)) {
            for (const item of node) walk(item);
            return;
        }
        for (const item of Object.values(node as Record<string, unknown>)) walk(item);
    };
    walk(value);
    return out;
}
