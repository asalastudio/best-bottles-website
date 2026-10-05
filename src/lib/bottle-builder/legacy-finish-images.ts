import patches from "../../../data/migrations/legacy-finish-images-2026-10-02/patches.json";

const bySku = new Map(patches.map(entry => [entry.websiteSku, entry]));

/** Bridge the coordinated release's frontend/backend and cached-row interval.
 * Deploy only AFTER all Blob payloads pass hosted verification. Match both the
 * exact component identity and old URL; newer approved artwork always wins. */
export function migratedFinishImageUrl(websiteSku: string, currentUrl: string | null): string | null {
    const entry = bySku.get(websiteSku);
    return entry && entry.expectedUrl === currentUrl ? entry.imageUrl : currentUrl;
}
