/**
 * Closed-loop evals over persisted storefront traces.
 * No full transcripts — tool names, destinations, and compact summaries only.
 */

export type GraceTraceTool = {
    name: string;
    at: number;
    ok: boolean;
    summary?: string;
};

export type GraceTraceDestination = {
    href: string;
    at: number;
};

export type GraceSessionTrace = {
    sessionId: string;
    companionMode: string;
    lastPageUrl?: string;
    tools: GraceTraceTool[];
    destinations: GraceTraceDestination[];
    metrics: {
        toolsCalled: number;
        cartItemsAdded: number;
        navigations: number;
    };
};

export type GraceEvalCheck = {
    id: string;
    passed: boolean;
    detail: string;
};

export type GraceEvalScript = {
    id: string;
    title: string;
    grade: (trace: GraceSessionTrace) => GraceEvalCheck[];
};

export const AMBER_ROLLER_SCRIPT_ID = "amber-roller-from-fine-mist";

function toolNames(trace: GraceSessionTrace): string[] {
    return trace.tools.map((tool) => tool.name);
}

function destinationsJoined(trace: GraceSessionTrace): string {
    return [...(trace.destinations ?? []).map((row) => row.href), trace.lastPageUrl ?? ""].join(" ").toLowerCase();
}

export const AMBER_ROLLER_EVAL_SCRIPT: GraceEvalScript = {
    id: AMBER_ROLLER_SCRIPT_ID,
    title: "Fine-mist PDP → voice take me to amber roll-on",
    grade(trace) {
        const names = toolNames(trace);
        const dest = destinationsJoined(trace);
        const moved = names.includes("navigateToPage") || names.includes("showProducts");
        const stayedOnChatCard = !moved && names.includes("displayProductCard") && trace.metrics.navigations === 0;
        return [
            {
                id: "navigated",
                passed: moved && !stayedOnChatCard,
                detail: moved
                    ? "Trace moved with navigateToPage or showProducts."
                    : "Trace never navigated — this is the live amber/roller failure.",
            },
            {
                id: "amber-or-roller-destination",
                passed: /amber|roll/.test(dest),
                detail: dest.trim()
                    ? `Destination context: ${dest.slice(0, 160)}`
                    : "No destination href was recorded.",
            },
            {
                id: "did-not-plate-swap-glass",
                passed: !names.includes("configureCurrentProduct") || moved,
                detail: "configureCurrentProduct is allowed after the move, not as a substitute for amber glass or a roller.",
            },
        ];
    },
};

export const GRACE_PRODUCTION_EVAL_SCRIPTS: GraceEvalScript[] = [AMBER_ROLLER_EVAL_SCRIPT];

export function evaluateGraceSessionTrace(
    trace: GraceSessionTrace,
    script: GraceEvalScript,
): { scriptId: string; passed: boolean; checks: GraceEvalCheck[] } {
    const checks = script.grade(trace);
    return {
        scriptId: script.id,
        passed: checks.every((check) => check.passed),
        checks,
    };
}

export function selectEvalScriptsForTrace(trace: GraceSessionTrace): GraceEvalScript[] {
    const dest = destinationsJoined(trace);
    const names = toolNames(trace).join(" ");
    const looksLikeAmberRoller = /amber|roll/.test(`${dest} ${names}`);
    return looksLikeAmberRoller ? [AMBER_ROLLER_EVAL_SCRIPT] : [];
}
