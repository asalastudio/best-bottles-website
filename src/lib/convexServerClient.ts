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
 */

const CONNECT_PHASE_CODES = new Set([
    "UND_ERR_CONNECT_TIMEOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH",
]);
const MID_FLIGHT_CODES = new Set([
    "UND_ERR_SOCKET", "ECONNRESET", "EPIPE", "UND_ERR_BODY_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT",
]);

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

export async function withConvexRetry<T>(
    operation: () => Promise<T>,
    options: { retryMidFlight: boolean; attempts?: number; delayMs?: number; label?: string },
): Promise<T> {
    const attempts = Math.max(1, options.attempts ?? 2);
    const delayMs = options.delayMs ?? 150;
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            const kind = classifyConvexNetworkError(error);
            const retryable = kind === "connect" || (kind === "mid-flight" && options.retryMidFlight);
            if (!retryable || attempt === attempts) throw error;
            console.warn(`[convex] transient ${kind} failure${options.label ? ` in ${options.label}` : ""}; retrying`);
            await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
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
