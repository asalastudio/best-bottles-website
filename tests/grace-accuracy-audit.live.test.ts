/**
 * Grace Accuracy + Tool-Execution Audit — LIVE harness.
 * Skipped unless GRACE_LIVE_AUDIT=1.
 *
 * Drives the SAME brain the storefront Realtime session uses
 * (GRACE_REALTIME_INSTRUCTIONS + GRACE_OPENAI_TOOL_SPECS) and records every
 * tool call (name, args, output) so tool-execution correctness is auditable.
 *
 * NON-DESTRUCTIVE by construction: read-only catalog tools execute for real
 * against Convex; every write/UI tool (cart, forms, checkout, navigation) is
 * STUBBED and merely recorded — nothing is submitted, ordered, or mutated.
 *
 * Run:
 *   GRACE_LIVE_AUDIT=1 npx vitest run tests/grace-accuracy-audit.live.test.ts
 */
import { describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { GRACE_REALTIME_INSTRUCTIONS } from "../src/lib/grace/realtimeInstructions";
import { GRACE_OPENAI_TOOL_SPECS } from "../src/lib/knowledge/toolSchemas";
import { executePublicGraceToolCall } from "../src/lib/grace/publicToolCallServer";
// Single source of truth — the dashboard runner and this harness must never
// drift apart, or a scenario added in one place silently never runs in the other.
import { GRACE_AUDIT_SCENARIOS } from "../src/lib/grace/auditScenarios";

const LIVE = process.env.GRACE_LIVE_AUDIT === "1";
const MODEL = process.env.GRACE_AUDIT_MODEL ?? "gpt-5";
const OUT_DIR = process.env.GRACE_AUDIT_OUT ?? "docs/reviews/audit-2026-08-06";

const STUBBED = new Set([
    "navigateToPage", "showProducts", "showProductPresentation", "displayProductCard",
    "displayAnatomy", "displayFamilyCard", "displayCompatibility", "displayBuildKit",
    "displayComparison", "displayCatalogStrip", "compareProducts",
    "getCurrentPageContext", "getCartContents", "getBrowsingHistory",
    "proposeCartAdd", "proceedToCheckout", "prefillForm", "updateFormField",
    "submitForm", "setCatalogRefinements",
    "saveShortlist", "shareShortlist", "prepareQuote", "confirmQuote",
    "createProject", "saveToProject", "uploadImage",
]);

type ToolCall = { name: string; args: Record<string, unknown>; executed: string; outputPreview: string };
type Turn = { user: string; assistant: string; toolCalls: ToolCall[] };

async function runConversation(turns: string[]): Promise<Turn[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY required");

    const tools = GRACE_OPENAI_TOOL_SPECS.map((s) => ({
        type: "function" as const,
        function: { name: s.name, description: s.description, parameters: s.parameters, strict: true },
    }));

    const messages: Array<Record<string, unknown>> = [
        { role: "system", content: GRACE_REALTIME_INSTRUCTIONS },
    ];
    const transcript: Turn[] = [];

    for (const userText of turns) {
        messages.push({ role: "user", content: userText });
        const calls: ToolCall[] = [];
        let finalText = "";

        for (let i = 0; i < 8; i++) {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: MODEL, reasoning_effort: "low", max_completion_tokens: 4096,
                    tools, tool_choice: "auto", messages,
                }),
            });
            if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
            const data = await res.json();
            const msg = data.choices[0].message;

            if (!msg.tool_calls?.length) {
                finalText = typeof msg.content === "string" ? msg.content : "";
                messages.push({ role: "assistant", content: finalText });
                break;
            }
            messages.push(msg);
            for (const tc of msg.tool_calls) {
                const name = tc.function.name as string;
                let args: Record<string, unknown> = {};
                try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* empty */ }
                let output: unknown;
                let executed: string;
                if (STUBBED.has(name)) {
                    executed = "stubbed";
                    output = { ok: true, note: `${name} runs in the customer's browser.` };
                } else {
                    executed = "live";
                    try {
                        output = await executePublicGraceToolCall(
                            { tool_name: name, parameters: args }, `audit-${Date.now()}-${i}`,
                        );
                    } catch (e) {
                        executed = "error";
                        output = `Tool error: ${e instanceof Error ? e.message : String(e)}`;
                    }
                }
                const serialized = typeof output === "string" ? output : JSON.stringify(output);
                calls.push({ name, args, executed, outputPreview: (serialized ?? "").slice(0, 1200) });
                messages.push({ role: "tool", tool_call_id: tc.id, content: (serialized ?? "").slice(0, 12000) });
            }
        }
        transcript.push({ user: userText, assistant: finalText, toolCalls: calls });
    }
    return transcript;
}

const SCENARIOS = GRACE_AUDIT_SCENARIOS;

describe.skipIf(!LIVE)("Grace accuracy + tool-execution audit (LIVE)", () => {
    it("runs all 21 scenarios and records evidence", { timeout: 3_600_000 }, async () => {
        mkdirSync(OUT_DIR, { recursive: true });
        const only = process.env.GRACE_AUDIT_ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
        const selected = only?.length ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS;
        const results: unknown[] = [];
        for (const sc of selected) {
            console.log(`[${sc.id}] running…`);
            try {
                const transcript = await runConversation(sc.turns);
                results.push({ ...sc, transcript, error: null });
            } catch (e) {
                results.push({ ...sc, transcript: null, error: String(e).slice(0, 400) });
                console.log(`[${sc.id}] ERROR ${String(e).slice(0, 200)}`);
            }
            writeFileSync(`${OUT_DIR}/audit-results.json`, JSON.stringify(results, null, 2));
        }
        expect(selected.length, `GRACE_AUDIT_ONLY matched no scenarios: ${only?.join(',')}`).toBeGreaterThan(0);
        expect(results.length).toBe(selected.length);
    });
});
