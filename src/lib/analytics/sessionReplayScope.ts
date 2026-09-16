/**
 * Which pages may be recorded.
 *
 * Session replay captures the rendered DOM, so the question is not "is this
 * page interesting" but "what is on it". The storefront is a public catalogue —
 * every slug and price on it is already served to anyone who asks, and the
 * pageview URLs PostHog already receives carry the same slugs. There is
 * nothing there to protect.
 *
 * The authenticated surfaces are a different matter. The portal carries
 * shipping addresses, billing emails, order values and seller's-permit
 * numbers; /team carries the certificate queue with uploaded documents;
 * /executive carries the business figures. None of that should reach a
 * recording, and input masking does not help, because most of it is rendered
 * text rather than form values.
 *
 * Evaluated fail-closed: anything unparseable or unexpected returns false, so a
 * new authenticated route is not recorded merely because nobody remembered to
 * add it here.
 */
const NEVER_RECORD = [
    "/portal",
    "/team",
    "/executive",
    "/studio",
    "/sign-in",
    "/sign-up",
    // The public Grace workspace takes free-text prompts, which people use to
    // describe their own unreleased products.
    "/grace-workspace",
] as const;

export function mayRecordSession(pathname: string | null | undefined): boolean {
    if (typeof pathname !== "string" || pathname.length === 0) return false;

    let normalized: string;
    try {
        // Accept a full URL or a bare path; anything unparseable is not recorded.
        normalized = pathname.startsWith("http") ? new URL(pathname).pathname : pathname;
    } catch {
        return false;
    }

    if (!normalized.startsWith("/")) return false;

    // Strip the query and hash before matching. Without this "/portal?x=1"
    // does not equal "/portal" and does not start with "/portal/", so it falls
    // through the deny list and gets recorded — which is the exact failure this
    // module exists to prevent, and it is completely silent.
    const lower = normalized.split(/[?#]/, 1)[0].toLowerCase();

    return !NEVER_RECORD.some((prefix) => lower === prefix || lower.startsWith(`${prefix}/`));
}

export const NEVER_RECORD_PREFIXES: readonly string[] = NEVER_RECORD;
