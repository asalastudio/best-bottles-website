import type { ProductSlugLookup } from "./route-status";

export type ProductSlugIndexOptions = {
    /** Every product group slug in the catalogue. */
    loadAllSlugs: () => Promise<Iterable<string>>;
    /** Whether one slug has a product group (catches groups added since the last load). */
    lookupSlug: (slug: string) => Promise<boolean>;
    now?: () => number;
    /** How long a loaded slug list is trusted before a background reload. */
    ttlMs?: number;
    /** How long to wait after a failed load before trying again. */
    retryMs?: number;
    /** Upper bound on any single catalogue read; slower reads count as "could not tell". */
    timeoutMs?: number;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
        promise.then(
            (value) => { clearTimeout(timer); resolve(value); },
            (error: unknown) => { clearTimeout(timer); reject(error); },
        );
    });
}

/**
 * Answers "does a product page exist for this slug?" for the proxy without a
 * catalogue read per request: one slug list per server instance, reloaded in
 * the background after `ttlMs`. A slug missing from the list gets one direct
 * lookup before it is called unknown, so a group created a minute ago still
 * opens. Any failure answers null, and the proxy lets the page decide.
 */
export function createProductSlugIndex(options: ProductSlugIndexOptions): { exists: ProductSlugLookup } {
    const now = options.now ?? Date.now;
    const ttlMs = options.ttlMs ?? 5 * 60_000;
    const retryMs = options.retryMs ?? 30_000;
    const timeoutMs = options.timeoutMs ?? 2_500;

    let slugs: Set<string> | null = null;
    let loadedAt = 0;
    let lastAttemptAt = Number.NEGATIVE_INFINITY;
    let loading: Promise<void> | null = null;

    function reload(): Promise<void> {
        if (loading) return loading;
        lastAttemptAt = now();
        loading = withTimeout(options.loadAllSlugs(), timeoutMs)
            .then((list) => {
                slugs = new Set(list);
                loadedAt = now();
            })
            .catch(() => undefined)
            .finally(() => {
                loading = null;
            });
        return loading;
    }

    return {
        async exists(slug) {
            if (!slugs) {
                if (now() - lastAttemptAt >= retryMs) await reload();
            } else if (now() - loadedAt >= ttlMs) {
                void reload();
            }
            if (slugs?.has(slug)) return true;
            try {
                const found = await withTimeout(options.lookupSlug(slug), timeoutMs);
                if (found) slugs?.add(slug);
                return found;
            } catch {
                return null;
            }
        },
    };
}
