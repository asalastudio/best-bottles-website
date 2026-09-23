/** Only proxy sources verified in both local Next and deployed Vercel. The
 * public Blob plates are already compact WebP files, and local Next rejects
 * their remote URL even though the deployed proxy accepts it. Unknown hosts
 * stay direct instead of breaking the PDP when an optimizer differs. */
export function isOptimizableImageUrl(value: string): boolean {
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname === "cdn.shopify.com";
    } catch {
        return false;
    }
}

/** Registered paper-doll layers must remain plain img/SVG image elements so
 * their pixel canvas and alpha compositing stay unchanged. Give their decode
 * preload and painted element the same resized URL to avoid fetching both the
 * original and optimized bytes. Widths come from Next's default deviceSizes. */
export function displayImageUrl(value: string, width: 640 | 828 | 1200 = 1200): string {
    if (!isOptimizableImageUrl(value)) return value;
    return `/_next/image?url=${encodeURIComponent(value)}&w=${width}&q=75`;
}
