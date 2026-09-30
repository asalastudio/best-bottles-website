import { ConvexHttpClient } from "convex/browser";
import {
    getFunctionName,
    type FunctionReference,
    type FunctionReturnType,
    type OptionalRestArgs,
} from "convex/server";

/**
 * Server-side Convex HTTP client that survives the two network failures seen in
 * production and on developer machines during the 2026-09-25 Grace audit:
 *
 * - "fetch failed … other side closed" (UND_ERR_SOCKET): Convex closed an idle
 *   keep-alive socket and undici reused it. Nothing was processed, so an
 *   idempotent read can simply be repeated.
 * - Connect-phase failures (UND_ERR_CONNECT_TIMEOUT, ENOTFOUND, EAI_AGAIN,
 *   ECONNREFUSED): the request never left the process, so any call is safe to
 *   repeat once.
 *
 * Queries retry on both. Mutations retry only on connect-phase failures: a
 * mutation whose socket died mid-flight may already have committed.
 *
 * Queries also retry Convex's own "try again" answers, the JSON body of a 5xx
 * that never reached a function: `ServiceUnavailable` ("Service temporarily
 * unavailable (Code: 04)", homepage revalidation 2026-09-29) and
 * `InternalServerError` ("Your request couldn't be completed. Try again later.",
 * four product-page reads in one second on 2026-09-29). A query only reads, so
 * repeating it is safe; a mutation is never repeated on these.
 */

const CONNECT_PHASE_CODES = new Set([
    "UND_ERR_CONNECT_TIMEOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH",
]);
const MID_FLIGHT_CODES = new Set([
    "UND_ERR_SOCKET", "ECONNRESET", "EPIPE", "UND_ERR_BODY_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT",
]);

const RETRYABLE_SERVER_CODES = new Set(["ServiceUnavailable", "InternalServerError"]);

export type ConvexNetworkFailure = "connect" | "mid-flight";

function errorChain(error: unknown): unknown[] {
    const chain: unknown[] = [];
    let current: unknown = error;
    for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
        chain.push(current);
        current = (current as { cause?: unknown }).cause;
    }
    return chain;
}

function errorCode(error: unknown): string | null {
    for (const entry of errorChain(error)) {
        const code = (entry as { code?: unknown }).code;
        if (typeof code === "string" && code) return code;
    }
    return null;
}

function errorText(error: unknown): string {
    return errorChain(error)
        .map((entry) => (entry as { message?: unknown }).message)
        .filter((message): message is string => typeof message === "string")
        .join(" | ")
        .toLowerCase();
}

/** Which transient network failure this is, or null for anything else (validation errors, thrown business errors, HTTP 4xx/5xx bodies). */
export function classifyConvexNetworkError(error: unknown): ConvexNetworkFailure | null {
    const code = errorCode(error);
    if (code && CONNECT_PHASE_CODES.has(code)) return "connect";
    if (code && MID_FLIGHT_CODES.has(code)) return "mid-flight";
    const text = errorText(error);
    if (text.includes("other side closed") || text.includes("socket hang up")) return "mid-flight";
    if (!code && text.includes("fetch failed")) return "connect";
    return null;
}

/** True for Convex's "try again later" HTTP answers (the thrown message is the
 * response body, `{"code":"ServiceUnavailable",…}`). A function's own error
 * ("[Request ID: …] Server Error") and every 4xx body are not. */
export function isRetryableConvexServerError(error: unknown): boolean {
    for (const entry of errorChain(error)) {
        const message = (entry as { message?: unknown }).message;
        if (typeof message !== "string" || !message.startsWith("{")) continue;
        try {
            const code = (JSON.parse(message) as { code?: unknown }).code;
            if (typeof code === "string" && RETRYABLE_SERVER_CODES.has(code)) return true;
        } catch {
            // Not a Convex HTTP error body.
        }
    }
    return false;
}

export async function withConvexRetry<T>(
    operation: () => Promise<T>,
    options: { retryMidFlight: boolean; retryServerErrors?: boolean; attempts?: number; delayMs?: number; label?: string },
): Promise<T> {
    const attempts = Math.max(1, options.attempts ?? 2);
    const delayMs = options.delayMs ?? 150;
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            const network = classifyConvexNetworkError(error);
            const server = !network && options.retryServerErrors === true && isRetryableConvexServerError(error);
            const retryable = network === "connect" || (network === "mid-flight" && options.retryMidFlight) || server;
            if (!retryable || attempt === attempts) throw error;
            console.warn(`[convex] transient ${network ?? "server"} failure${options.label ? ` in ${options.label}` : ""}; retrying`);
            // A busy or restarting backend needs longer than a dropped socket.
            await new Promise((resolve) => setTimeout(resolve, delayMs * attempt * (server ? 4 : 1)));
        }
    }
    throw lastError;
}

export class ResilientConvexHttpClient extends ConvexHttpClient {
    override query<Query extends FunctionReference<"query">>(
        query: Query,
        ...args: OptionalRestArgs<Query>
    ): Promise<FunctionReturnType<Query>> {
        return withConvexRetry(() => super.query(query, ...args), {
            retryMidFlight: true,
            retryServerErrors: true,
            attempts: 3,
            label: getFunctionName(query),
        });
    }

    override mutation<Mutation extends FunctionReference<"mutation">>(
        mutation: Mutation,
        ...args: OptionalRestArgs<Mutation>
    ): Promise<FunctionReturnType<Mutation>> {
        return withConvexRetry(() => super.mutation(mutation, ...args), {
            retryMidFlight: false,
            label: getFunctionName(mutation),
        });
    }
}

export function createResilientConvexHttpClient(url: string): ResilientConvexHttpClient {
    return new ResilientConvexHttpClient(url);
}
