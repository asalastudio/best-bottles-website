/**
 * The shapes a Grace owner key can take (see graceOwnerKey.ts):
 * - a signed-in customer: `user:` + the Clerk user id;
 * - an anonymous visitor: the UUID from crypto.randomUUID, or the
 *   `anon-<base36>-<base36>` fallback when that API is missing.
 *
 * Pure, so server routes can validate the header without importing the
 * browser-only key store.
 */
const OWNER_KEY_MAX = 160;
const OWNER_KEY_PATTERNS = [
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    /^anon-[a-z0-9-]{8,}$/i,
    /^user:[A-Za-z0-9_-]{6,128}$/,
];

export function isValidGraceOwnerKey(value: string | null | undefined): value is string {
    const key = value?.trim() ?? "";
    if (!key || key.length > OWNER_KEY_MAX) return false;
    return OWNER_KEY_PATTERNS.some((pattern) => pattern.test(key));
}
