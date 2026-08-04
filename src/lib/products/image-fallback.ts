export function resolveImageWithFallback(
    preferredUrl: string | null | undefined,
    failedUrls: ReadonlySet<string>,
    fallbackUrl?: string | null,
): string | null {
    if (preferredUrl && !failedUrls.has(preferredUrl)) return preferredUrl;
    if (fallbackUrl && !failedUrls.has(fallbackUrl)) return fallbackUrl;
    return null;
}
