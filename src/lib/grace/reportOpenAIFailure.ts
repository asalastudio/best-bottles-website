/**
 * Server-side reporting for a failed Grace call to OpenAI: one greppable log
 * line plus a Sentry event through the existing reportError helper, tagged so
 * the Platform Health panel can tell an out-of-credit account from a busy
 * spell. Never logs the key, the prompt or anything the shopper typed.
 */
import { reportError } from "@/lib/observability/report";
import {
    GRACE_OPENAI_FAILURE_LOG_TAG,
    graceOpenAILogFields,
    type GraceTextFailureReason,
} from "./openaiFailure";

export class GraceOpenAIFailureError extends Error {
    constructor(readonly fields: Record<string, string | number | null>) {
        super(
            `${GRACE_OPENAI_FAILURE_LOG_TAG} ` +
                Object.entries(fields).map(([key, value]) => `${key}=${value ?? "none"}`).join(" "),
        );
        this.name = "GraceOpenAIFailureError";
    }
}

export function reportGraceOpenAIFailure(
    failure: { reason: GraceTextFailureReason; status: number | null; code: string | null; type: string | null },
    context: { route: string; model: string; attempts?: number },
): void {
    const fields = graceOpenAILogFields(failure, context);
    reportError(new GraceOpenAIFailureError(fields), {
        area: "grace-openai",
        tags: {
            route: context.route,
            reason: failure.reason,
            status: failure.status,
            code: failure.code,
        },
        extra: fields,
    });
}
