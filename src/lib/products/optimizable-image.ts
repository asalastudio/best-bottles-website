/** Only proxy sources verified in both local Next and deployed Vercel. The
 * public Blob plates are already compact WebP files, and local Next rejects
 * their remote URL even though the deployed proxy accepts it. Unknown hosts
 * stay direct instead of breaking the PDP when an optimizer differs. */
export function isOptimizableImageUrl(value: string): boolean {
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    if (isRegisterAssetUrl(value)) return true;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname === "cdn.shopify.com";
    } catch {
        return false;
    }
}

const REGISTER_BLOB_HOST = "yzy7l20k4yt6znzz.public.blob.vercel-storage.com";

/** The component register's plates and layers are PNG masters at native
 * resolution (a 768 × 2304 plate is 0.7–1.5 MB). They are served through the
 * optimizer, which the Blob host is allowed for, so a page fetches a
 * display-sized WebP instead; the published kit layers are already compact
 * WebP files and stay direct. */
export function isRegisterAssetUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname === REGISTER_BLOB_HOST && url.pathname.startsWith("/register/");
    } catch {
        return false;
    }
}

export type DisplayImageWidth = 256 | 384 | 640 | 828 | 1200;

/** Registered paper-doll layers must remain plain img/SVG image elements so
 * their pixel canvas and alpha compositing stay unchanged. Give their decode
 * preload and painted element the same resized URL to avoid fetching both the
 * original and optimized bytes. Widths come from Next's default deviceSizes. */
export function displayImageUrl(value: string, width: DisplayImageWidth = 1200): string {
    if (!isOptimizableImageUrl(value)) return value;
    return `/_next/image?url=${encodeURIComponent(value)}&w=${width}&q=75`;
}
