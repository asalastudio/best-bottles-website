/**
 * Normalize Grace client-tool parameters before Convex calls.
 *
 * ElevenLabs / LLMs sometimes send `query` or `q` instead of `searchTerm`.
 * Convex validators require exact field names — map aliases here so queries never fail validation.
 */

export function resolveSearchCatalogParameters(
    parameters: Record<string, unknown>
): {
    searchTerm: string;
    categoryLimit?: string;
    familyLimit?: string;
    applicatorFilter?: string;
} {
    const asTrimmedString = (v: unknown): string | undefined => {
        if (v === undefined || v === null) return undefined;
        if (typeof v === "string") return v.trim();
        if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
        return undefined;
    };

    const searchTerm =
        asTrimmedString(parameters.searchTerm) ??
        asTrimmedString(parameters.query) ??
        asTrimmedString(parameters.q) ??
        "";

    const categoryLimit = asTrimmedString(parameters.categoryLimit);
    const familyLimit = asTrimmedString(parameters.familyLimit);
    const applicatorFilter = asTrimmedString(parameters.applicatorFilter);

    return {
        searchTerm,
        ...(categoryLimit ? { categoryLimit } : {}),
        ...(familyLimit ? { familyLimit } : {}),
        ...(applicatorFilter ? { applicatorFilter } : {}),
    };
}
