import "server-only";

/**
 * Grace audit runner — the single source of truth for conversational audit
 * scenarios and their machine-checkable grading.
 *
 * Why this exists: the 2026-08-06 audit was graded by a human reading
 * transcripts. That cannot drive a dashboard. Every scenario here carries
 * explicit expectations, and ground truth is resolved LIVE from Convex at grade
 * time — hardcoding "$0.72" would silently rot the moment a price changed.
 *
 * Used by the executive-hub audit route (one scenario per request, so a run
 * never approaches the serverless timeout) and by the vitest live harness.
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { GRACE_REALTIME_INSTRUCTIONS } from "@/lib/grace/realtimeInstructions";
import { GRACE_OPENAI_TOOL_SPECS } from "@/lib/knowledge/toolSchemas";
import { executePublicGraceToolCall } from "@/lib/grace/publicToolCallServer";
import {
    GRACE_AUDIT_SCENARIOS,
    verdictFor,
    type AuditCheck,
    type AuditScenario,
    type AuditScenarioResult,
    type AuditToolCall,
    type AuditTurn,
} from "@/lib/grace/auditScenarios";

export * from "@/lib/grace/auditScenarios";

export const GRACE_AUDIT_MODEL = process.env.GRACE_AUDIT_MODEL ?? "gpt-5";

/** Client/UI tools — stubbed and recorded so an audit never mutates anything. */
const STUBBED_TOOLS = new Set([
    "navigateToPage", "showProducts", "showProductPresentation", "displayProductCard",
    "displayAnatomy", "displayFamilyCard", "displayCompatibility", "displayBuildKit",
    "displayComparison", "displayCatalogStrip", "displayShortlist", "compareProducts",
    "getCurrentPageContext", "getCartContents", "getBrowsingHistory",
    "proposeCartAdd", "proceedToCheckout", "prefillForm", "updateFormField",
    "submitForm", "setCatalogRefinements",
    "prepareQuoteRequest", "listGraceProjects", "proposeProjectSave",
]);

// ─── Execution ───────────────────────────────────────────────────────────────

function convex() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured.");
    return new ConvexHttpClient(url);
}

async function runTurns(turns: string[]): Promise<AuditTurn[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

    const tools = GRACE_OPENAI_TOOL_SPECS.map((s) => ({
        type: "function" as const,
        function: { name: s.name, description: s.description, parameters: s.parameters, strict: true },
    }));

    const messages: Array<Record<string, unknown>> = [
        { role: "system", content: GRACE_REALTIME_INSTRUCTIONS },
    ];
    const transcript: AuditTurn[] = [];

    for (const userText of turns) {
        messages.push({ role: "user", content: userText });
        const calls: AuditToolCall[] = [];
        let assistant = "";

        for (let i = 0; i < 8; i++) {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: GRACE_AUDIT_MODEL, reasoning_effort: "low", max_completion_tokens: 4096,
                    tools, tool_choice: "auto", messages,
                }),
            });
            if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
            const data = await res.json();
            const msg = data.choices[0].message;

            if (!msg.tool_calls?.length) {
                assistant = typeof msg.content === "string" ? msg.content : "";
                messages.push({ role: "assistant", content: assistant });
                break;
            }
            messages.push(msg);
            for (const tc of msg.tool_calls) {
                const name = tc.function.name as string;
                let args: Record<string, unknown> = {};
                try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* empty */ }
                let output: unknown;
                let executed: AuditToolCall["executed"];
                if (STUBBED_TOOLS.has(name)) {
                    executed = "stubbed";
                    output = { ok: true, note: `${name} runs in the customer's browser.` };
                } else {
                    executed = "live";
                    try {
                        output = await executePublicGraceToolCall({ tool_name: name, parameters: args }, `audit-${Date.now()}`);
                    } catch (e) {
                        executed = "error";
                        output = `Tool error: ${e instanceof Error ? e.message : String(e)}`;
                    }
                }
                const serialized = typeof output === "string" ? output : JSON.stringify(output);
                calls.push({ name, args, executed, outputPreview: (serialized ?? "").slice(0, 1000) });
                messages.push({ role: "tool", tool_call_id: tc.id, content: (serialized ?? "").slice(0, 12000) });
            }
        }
        transcript.push({ user: userText, assistant, toolCalls: calls });
    }
    return transcript;
}

// ─── Grading ─────────────────────────────────────────────────────────────────

// Folds typographic variants the model emits: curly quotes, and the Unicode
// hyphen family (U+2010–U+2015, incl. the non-breaking hyphen U+2011 that made
// "in‑stock" miss an ASCII "in-stock" phrase check).
const normalize = (s: string) => s.toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ");

/** Money/number tolerant match: "0.72" matches "$0.72", "0.72 each", "$ 0.72". */
function mentionsNumber(haystack: string, value: number): boolean {
    const fixed = value.toFixed(2);
    const trimmed = String(value);
    return haystack.includes(fixed) || haystack.includes(trimmed)
        || haystack.includes(fixed.replace(/\.00$/, ""));
}

export async function buildChecks(scenario: AuditScenario, transcript: AuditTurn[]): Promise<AuditCheck[]> {
    const checks: AuditCheck[] = [];
    const lastTurn = transcript[transcript.length - 1];
    const allText = normalize(transcript.map((t) => t.assistant).join("\n"));
    const finalText = normalize(lastTurn?.assistant ?? "");
    const allTools = transcript.flatMap((t) => t.toolCalls);
    const toolNames = new Set(allTools.map((c) => c.name));
    const e = scenario.expect;

    if (e.mustAnswer) {
        const answered = transcript.every((t) => (t.assistant ?? "").trim().length > 0);
        checks.push({
            label: "Produces a reply on every turn", passed: answered, severity: "critical",
            detail: answered ? "All turns answered." : "At least one turn returned an empty reply.",
        });
    }
    if (e.mustCallAnyTool?.length) {
        const hit = e.mustCallAnyTool.filter((t) => toolNames.has(t));
        checks.push({
            label: `Calls ${e.mustCallAnyTool.join(" or ")}`, passed: hit.length > 0, severity: "critical",
            detail: hit.length > 0 ? `Called ${hit.join(", ")}.` : `None called. Tools used: ${[...toolNames].join(", ") || "none"}.`,
        });
    }
    if (e.mustNotCallTool?.length) {
        const bad = e.mustNotCallTool.filter((t) => toolNames.has(t));
        checks.push({
            label: `Avoids ${e.mustNotCallTool.join(", ")}`, passed: bad.length === 0, severity: "critical",
            detail: bad.length === 0 ? "None called." : `Called forbidden tool(s): ${bad.join(", ")}.`,
        });
    }
    for (const phrase of e.mustIncludeAll ?? []) {
        const ok = allText.includes(normalize(phrase));
        checks.push({ label: `Mentions "${phrase}"`, passed: ok, severity: "critical", detail: ok ? "Present." : "Missing from the reply." });
    }
    if (e.mustIncludeAny?.length) {
        const hit = e.mustIncludeAny.find((p) => allText.includes(normalize(p)));
        checks.push({
            label: `Mentions one of: ${e.mustIncludeAny.slice(0, 4).join(" / ")}`, passed: Boolean(hit), severity: "critical",
            detail: hit ? `Matched "${hit}".` : "None of the accepted phrasings appeared.",
        });
    }
    for (const phrase of e.mustNotInclude ?? []) {
        const bad = finalText.includes(normalize(phrase));
        checks.push({
            label: `Never says "${phrase}"`, passed: !bad, severity: "critical",
            detail: bad ? `Reply contained the forbidden phrase "${phrase}".` : "Not present.",
        });
    }

    // ── Live ground truth ────────────────────────────────────────────────────
    if (e.skuFacts) {
        const client = convex();
        const found = await client.query(api.products.lookupSku, { sku: e.skuFacts.sku });
        const product = found?.product;
        if (!product) {
            checks.push({
                label: `Ground truth for ${e.skuFacts.sku}`, passed: false, severity: "critical",
                detail: "SKU is missing from the catalog — the audit expectation itself is stale.",
            });
        } else {
            for (const field of e.skuFacts.fields) {
                if (field === "price" && typeof product.webPrice1pc === "number") {
                    const ok = mentionsNumber(allText, product.webPrice1pc);
                    checks.push({
                        label: `Quotes live price for ${e.skuFacts.sku}`, passed: ok, severity: "critical",
                        detail: ok ? `Reply contains $${product.webPrice1pc.toFixed(2)}.` : `Expected $${product.webPrice1pc.toFixed(2)}; not present in the reply.`,
                    });
                }
                if (field === "thread" && product.neckThreadSize) {
                    const ok = allText.includes(normalize(product.neckThreadSize));
                    checks.push({
                        label: `Quotes neck thread for ${e.skuFacts.sku}`, passed: ok, severity: "critical",
                        detail: ok ? `Reply contains ${product.neckThreadSize}.` : `Expected ${product.neckThreadSize}; not present.`,
                    });
                }
                if (field === "capacity" && typeof product.capacityMl === "number") {
                    const ok = mentionsNumber(allText, product.capacityMl);
                    checks.push({
                        label: `Quotes capacity for ${e.skuFacts.sku}`, passed: ok, severity: "critical",
                        detail: ok ? `Reply contains ${product.capacityMl}ml.` : `Expected ${product.capacityMl}ml; not present.`,
                    });
                }
            }
        }
    }
    if (e.catalogTotals) {
        const stats = await convex().query(api.grace.getCatalogStats, {});
        const okVariants = allText.includes(String(stats.totalVariants)) || allText.includes(stats.totalVariants.toLocaleString("en-US"));
        const okGroups = allText.includes(String(stats.totalGroups));
        checks.push({
            label: "Quotes live catalog totals", passed: okVariants && okGroups, severity: "critical",
            detail: okVariants && okGroups
                ? `Matched ${stats.totalVariants} / ${stats.totalGroups}.`
                : `Expected ${stats.totalVariants} products and ${stats.totalGroups} groups.`,
        });
    }

    // ── Soft checks ──────────────────────────────────────────────────────────
    for (const phrase of e.soft?.mustIncludeAll ?? []) {
        const ok = allText.includes(normalize(phrase));
        checks.push({ label: `Ideally mentions "${phrase}"`, passed: ok, severity: "soft", detail: ok ? "Present." : "Not mentioned." });
    }
    if (typeof e.soft?.maxToolCalls === "number") {
        const ok = allTools.length <= e.soft.maxToolCalls;
        checks.push({
            label: `Uses at most ${e.soft.maxToolCalls} tool calls`, passed: ok, severity: "soft",
            detail: `${allTools.length} tool call(s) made.`,
        });
    }

    return checks;
}


export async function runAuditScenario(scenarioId: string): Promise<AuditScenarioResult> {
    const scenario = GRACE_AUDIT_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) throw new Error(`Unknown audit scenario: ${scenarioId}`);

    const started = Date.now();
    let transcript: AuditTurn[] = [];
    let checks: AuditCheck[] = [];
    let error: string | null = null;

    try {
        transcript = await runTurns(scenario.turns);
        checks = await buildChecks(scenario, transcript);
    } catch (e) {
        error = e instanceof Error ? e.message : String(e);
    }

    return {
        scenarioId: scenario.id,
        group: scenario.group,
        title: scenario.title,
        verdict: verdictFor(checks, error),
        checks,
        transcript,
        toolCallCount: transcript.reduce((n, t) => n + t.toolCalls.length, 0),
        durationMs: Date.now() - started,
        error,
    };
}
