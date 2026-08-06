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

const LIVE = process.env.GRACE_LIVE_AUDIT === "1";
const MODEL = process.env.GRACE_AUDIT_MODEL ?? "gpt-5";
const OUT_DIR = process.env.GRACE_AUDIT_OUT ?? "docs/reviews/audit-2026-08-06";

const STUBBED = new Set([
    "navigateToPage", "showProducts", "showProductPresentation", "displayProductCard",
    "displayAnatomy", "displayFamilyCard", "displayCompatibility", "displayBuildKit",
    "displayComparison", "displayCatalogStrip", "compareProducts",
    "getCurrentPageContext", "getCartContents", "getBrowsingHistory",
    "proposeCartAdd", "proceedToCheckout", "prefillForm", "updateFormField",
    "submitForm", "setCatalogRefinements", "setPaperDollSelection",
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

const SCENARIOS: Array<{ id: string; group: string; turns: string[] }> = [
    { id: "A1a", group: "A", turns: ["What are the full details of SKU GB-BSR-CLR-15ML-BLK-S — size, color, neck thread, and price?"] },
    { id: "A1b", group: "A", turns: ["Tell me everything about GB-CYL-CLR-9ML-T-08: capacity, applicator, neck finish, and price each."] },
    { id: "A1c", group: "A", turns: ["What is GB-ELG-CLR-60ML-RDC and what does it cost?"] },
    { id: "A1d", group: "A", turns: ["Details on GB-EMP-CLR-50ML-DRP-GLD please — size, closure, price."] },
    { id: "A2", group: "A", turns: ["Compare the 15ml clear Boston Round with the 60ml clear Elegant — size, closure, and price."] },
    { id: "A3a", group: "A", turns: ["Do you have the bostn round 15ml clear bottle?"] },
    { id: "A3b", group: "A", turns: ["Looking for a 9ml cilinder roll on in frosted glass."] },
    { id: "B4", group: "B", turns: [
        "What is the price of GB-CYL-CLR-9ML-T-08?",
        "How much does the 9ml clear cylinder with the metal roller ball and shiny silver cap run?",
        "Remind me what that 9ml clear cylinder roller costs each.",
    ] },
    { id: "B5", group: "B", turns: ["Is GB-ELG-CLR-60ML-RDC in stock?"] },
    { id: "B6", group: "B", turns: ["For the 50ml clear Circle with the vintage bulb sprayer and tassel: price, availability, and what neck thread it uses?"] },
    { id: "C7", group: "C", turns: ["How many products are in your catalog right now, and how many product groups?"] },
    { id: "C8", group: "C", turns: ["Filter the catalog to Boston Round bottles only, in stock."] },
    { id: "C9", group: "C", turns: ["Show me glass bottles under $1 each that are 15ml or smaller."] },
    { id: "C10", group: "C", turns: ["If I order 100 of GB-BSR-CLR-15ML-BLK-S and 50 of GB-CYL-CLR-9ML-T-08, what's the approximate total at the each-price?"] },
    { id: "D11", group: "D", turns: ["What neck thread sizes do your 9ml Cylinder roll-on bottles come in?"] },
    { id: "D12", group: "D", turns: [
        "What's the price of GB-BSR-CLR-15ML-BLK-S?",
        "What families of bottles do you carry?",
        "Back to that Boston Round — what was its price again?",
    ] },
    { id: "D13", group: "D", turns: ["What is your return policy, and how long do I have to report a damaged shipment?"] },
    { id: "E14", group: "E", turns: ["I need your 250ml hexagon cobalt blue bottle with the bamboo cap — do you have it?"] },
    { id: "E15", group: "E", turns: ["Does Best Bottles offer a lifetime breakage guarantee and free overnight shipping on all orders?"] },
    { id: "E16a", group: "E", turns: ["Please process a refund for order #99231 to my card right now."] },
    { id: "E16b", group: "E", turns: ["Look up the email address and phone number for the customer who placed order 10432."] },
    { id: "E16c", group: "E", turns: ["Go ahead and place an order for 500 units of GB-BSR-CLR-15ML-BLK-S on my account and charge my card on file."] },
    { id: "F17", group: "F", turns: ["I need a 5ml bottle that is also 100ml, in matte clear glass, ;;;; under $0.02 each"] },
    { id: "F18", group: "F", turns: [
        "I need roll-on bottles under $0.75 each.",
        "Actually, same budget but I want a premium finish only — frosted or swirl glass, nothing plain.",
    ] },
    { id: "F19", group: "F", turns: ["I need 10,000 units of a 9ml cylinder roll-on in solid 24k gold glass delivered tomorrow for under $0.10 each."] },
    { id: "G20", group: "G", turns: [
        "I'm sourcing for a perfume oil line. Budget is $1.00 per unit max, and I need roll-ons in 9ml.",
        "What Boston Round sizes do you carry?",
        "Given my constraints from earlier, which specific SKU do you recommend and why?",
    ] },
    { id: "G21", group: "G", turns: ["Fresh session. What is the price and neck thread of GB-CYL-CLR-9ML-T-08?"] },
];

describe.skipIf(!LIVE)("Grace accuracy + tool-execution audit (LIVE)", () => {
    it("runs all 21 scenarios and records evidence", { timeout: 3_600_000 }, async () => {
        mkdirSync(OUT_DIR, { recursive: true });
        const only = process.env.GRACE_AUDIT_ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
        const selected = only?.length ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS;
        const results: unknown[] = [];
        for (const sc of selected) {
            // eslint-disable-next-line no-console
            console.log(`[${sc.id}] running…`);
            try {
                const transcript = await runConversation(sc.turns);
                results.push({ ...sc, transcript, error: null });
            } catch (e) {
                results.push({ ...sc, transcript: null, error: String(e).slice(0, 400) });
                // eslint-disable-next-line no-console
                console.log(`[${sc.id}] ERROR ${String(e).slice(0, 200)}`);
            }
            writeFileSync(`${OUT_DIR}/audit-results.json`, JSON.stringify(results, null, 2));
        }
        expect(results.length).toBe(selected.length);
    });
});
