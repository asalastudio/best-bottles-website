/**
 * One reading of an OpenAI failure, shared by every place Grace calls OpenAI
 * for a shopper: the text reply (convex/grace.ts) and the voice token route
 * (src/app/api/openai/realtime-token).
 *
 * The distinction that matters: an account out of credit (HTTP 429 with
 * `insufficient_quota`) or a bad or missing key (401/403) fails every request
 * until someone fixes billing or the key. Retrying cannot help, and telling
 * the shopper "high demand" is untrue. An ordinary rate limit (429
 * `rate_limit_exceeded`), a 5xx or a dropped connection usually passes within
 * seconds, so a short retry is worth it there.
 *
 * Pure TypeScript with no Node, Next.js or Sentry imports: Convex bundles this
 * file too. Nothing here reads or returns keys, prompts or shopper messages.
 */

export type GraceOpenAIFailureReason = "quota" | "auth" | "rate_limit" | "upstream";

export type GraceOpenAIFailure = {
    reason: GraceOpenAIFailureReason;
    /** HTTP status from OpenAI; null when no response came back (network, timeout, missing key). */
    status: number | null;
    /** OpenAI's error code, e.g. "insufficient_quota", or our own "network" / "timeout" / "missing_api_key". */
    code: string | null;
    /** OpenAI's error type, e.g. "insufficient_quota", "invalid_request_error". */
    type: string | null;
    /** True when trying again soon can succeed. Never true for quota or auth. */
    retryable: boolean;
    /** How long OpenAI asked us to wait before retrying, when it said. */
    retryAfterMs: number | null;
};

/** Stable codes the routes return so the UI can show a system notice instead of a Grace reply. */
export type GraceFailureCode = "grace_unavailable" | "grace_busy" | "grace_error";

/** The text reply's failure reasons: OpenAI's, plus an unexpected error in our own code. */
export type GraceTextFailureReason = GraceOpenAIFailureReason | "internal";

export type GraceTextFailure = {
    code: GraceFailureCode;
    reason: GraceTextFailureReason;
    status: number | null;
    openaiCode: string | null;
    type: string | null;
    model: string;
    attempts: number;
};

export type GraceTextReply = {
    message: string;
    /** Present only when the turn failed. */
    failure?: GraceTextFailure;
};

// Same contact line as the approved FAQ and the site footer.
export const GRACE_UNAVAILABLE_NOTICE =
    "Grace is unavailable right now. You can keep browsing the catalog and use search, or contact our team at sales@nematinternational.com or 1-800-936-3628.";
export const GRACE_BUSY_NOTICE = "Grace is busy right now. Please try again in a few seconds.";
export const GRACE_ERROR_NOTICE =
    "Grace ran into a problem just now. Please try again in a moment, or contact our team at sales@nematinternational.com if it keeps happening.";

/** Longest we wait between attempts; if OpenAI asks for longer, we stop and say Grace is busy. */
export const GRACE_OPENAI_MAX_RETRY_WAIT_MS = 8_000;

const QUOTA_CODES = new Set([
    "insufficient_quota",
    "credit_balance_exhausted",
    "billing_hard_limit_reached",
    "billing_not_active",
    "quota_exceeded",
]);

const AUTH_CODES = new Set([
    "invalid_api_key",
    "missing_api_key",
    "account_deactivated",
    "organization_deactivated",
    "invalid_organization",
    "no_organization",
    "unsupported_country_region_territory",
]);

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function readHeader(headers: unknown, name: string): string | null {
    if (!headers) return null;
    if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name);
    const value = record(headers)?.[name];
    return typeof value === "string" ? value : null;
}

function readNonNegativeNumber(headers: unknown, name: string): number | null {
    const raw = readHeader(headers, name)?.trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
}

/** `retry-after-ms` (OpenAI's own) or `retry-after` in seconds; HTTP-date forms are ignored. */
function readRetryAfterMs(headers: unknown): number | null {
    const ms = readNonNegativeNumber(headers, "retry-after-ms");
    if (ms !== null) return ms;
    const seconds = readNonNegativeNumber(headers, "retry-after");
    return seconds === null ? null : seconds * 1000;
}

// The SDK's own connection error, and what undici / edge fetch throw when a socket drops.
const CONNECTION_MESSAGE = /^(connection error\.?|fetch failed|terminated)$|network|socket|econn/;

/**
 * Classify anything thrown by the OpenAI SDK, or a plain description of a
 * failed fetch (`{ status, error: { code, type, message }, headers }`).
 */
export function classifyOpenAIFailure(error: unknown): GraceOpenAIFailure {
    const outer = record(error);
    const inner = record(outer?.error);
    const status = typeof outer?.status === "number" ? outer.status : null;
    const code = text(outer?.code) ?? text(inner?.code);
    const type = text(outer?.type) ?? text(inner?.type);
    const message = (text(inner?.message) ?? (error instanceof Error ? error.message : text(outer?.message)) ?? "").toLowerCase();
    const retryAfterMs = readRetryAfterMs(outer?.headers);
    const tokens = [code, type].filter((token): token is string => Boolean(token)).map((token) => token.toLowerCase());

    const failure = (reason: GraceOpenAIFailureReason, retryable: boolean, overrideCode?: string): GraceOpenAIFailure => ({
        reason,
        status,
        code: overrideCode ?? code,
        type,
        retryable,
        retryAfterMs,
    });

    const namedRateLimit = tokens.includes("rate_limit_exceeded");
    if (
        status === 402 ||
        tokens.some((token) => QUOTA_CODES.has(token)) ||
        (status === 429 && !namedRateLimit && /quota|billing|credit balance/.test(message))
    ) {
        return failure("quota", false);
    }
    if (status === 401 || status === 403 || tokens.some((token) => AUTH_CODES.has(token))) {
        return failure("auth", false);
    }
    if (status === 429) return failure("rate_limit", true);
    if (status !== null) {
        // 408 request timeout, 409 lock timeout and every 5xx (including
        // 529 overloaded) pass on their own. Other 4xx mean our request is
        // wrong and will fail the same way again.
        return failure("upstream", status === 408 || status === 409 || status >= 500);
    }

    // No HTTP response at all: the SDK's connection or timeout errors, a
    // fetch that never connected, or an abort.
    const name = error instanceof Error ? error.name : text(outer?.name) ?? "";
    if (/timeout/i.test(name) || /timed out/.test(message)) return failure("upstream", true, code ?? "timeout");
    if (name === "AbortError") return failure("upstream", false, code ?? "aborted");
    if (CONNECTION_MESSAGE.test(message)) return failure("upstream", true, code ?? "network");
    return failure("upstream", false);
}

/** Read a failed OpenAI fetch response without exposing its body: only code, type and headers. */
export async function classifyOpenAIResponseFailure(response: Response): Promise<GraceOpenAIFailure> {
    let body: unknown = null;
    try {
        body = await response.json();
    } catch {
        // Not JSON; the status alone decides.
    }
    return classifyOpenAIFailure({
        status: response.status,
        error: record(body)?.error ?? null,
        headers: response.headers,
    });
}

/** The shopper-facing line and stable code for a failure reason. */
export function graceFailureNotice(reason: GraceTextFailureReason): { code: GraceFailureCode; message: string } {
    if (reason === "quota" || reason === "auth") return { code: "grace_unavailable", message: GRACE_UNAVAILABLE_NOTICE };
    if (reason === "rate_limit") return { code: "grace_busy", message: GRACE_BUSY_NOTICE };
    return { code: "grace_error", message: GRACE_ERROR_NOTICE };
}

export function isGraceFailureCode(value: unknown): value is GraceFailureCode {
    return value === "grace_unavailable" || value === "grace_busy" || value === "grace_error";
}

/**
 * The fields we log for a failure. Deliberately small: status, codes, model,
 * route and attempt count. Never the key, the prompt or the shopper's words.
 */
export function graceOpenAILogFields(
    failure: { reason: GraceTextFailureReason; status: number | null; code: string | null; type: string | null },
    context: { route: string; model: string; attempts?: number },
): Record<string, string | number | null> {
    return {
        route: context.route,
        reason: failure.reason,
        status: failure.status,
        code: failure.code,
        type: failure.type,
        model: context.model,
        ...(context.attempts !== undefined ? { attempts: context.attempts } : {}),
    };
}

/** Grep for this tag in Convex and Vercel logs to find every failed Grace call to OpenAI. */
export const GRACE_OPENAI_FAILURE_LOG_TAG = "grace:openai_unavailable";

export type OpenAICallResult<T> =
    | { ok: true; value: T; attempts: number }
    | { ok: false; failure: GraceOpenAIFailure; attempts: number };

/**
 * Call OpenAI, retrying only what can pass on its own (rate limits, 5xx,
 * dropped connections). Quota and auth failures return after the first
 * attempt. Backoff is 2 s then 4 s unless OpenAI names a wait; a requested
 * wait longer than 8 s ends the retries instead of holding the shopper.
 */
export async function callOpenAIWithRetry<T>(
    call: () => Promise<T>,
    {
        retries = 2,
        sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
        onRetry,
    }: {
        retries?: number;
        sleep?: (ms: number) => Promise<void>;
        onRetry?: (failure: GraceOpenAIFailure, attempt: number, waitMs: number) => void;
    } = {},
): Promise<OpenAICallResult<T>> {
    for (let attempt = 1; ; attempt++) {
        try {
            return { ok: true, value: await call(), attempts: attempt };
        } catch (error) {
            const failure = classifyOpenAIFailure(error);
            const waitMs = failure.retryAfterMs ?? Math.min(2000 * 2 ** (attempt - 1), GRACE_OPENAI_MAX_RETRY_WAIT_MS);
            if (!failure.retryable || attempt > retries || waitMs > GRACE_OPENAI_MAX_RETRY_WAIT_MS) {
                return { ok: false, failure, attempts: attempt };
            }
            onRetry?.(failure, attempt, waitMs);
            await sleep(waitMs);
        }
    }
}

/** Accept the structured reply, or the plain string an older Convex deployment returns. */
export function normalizeGraceTextReply(value: unknown): GraceTextReply | null {
    if (typeof value === "string") return value ? { message: value } : null;
    const reply = record(value);
    if (!reply || typeof reply.message !== "string" || !reply.message) return null;
    const failure = record(reply.failure);
    if (!failure || !isGraceFailureCode(failure.code)) return { message: reply.message };
    return { message: reply.message, failure: failure as unknown as GraceTextFailure };
}
