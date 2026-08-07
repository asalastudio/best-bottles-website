/**
 * One-shot Grace conversation probe — the same brain the storefront uses
 * (GRACE_REALTIME_INSTRUCTIONS + GRACE_OPENAI_TOOL_SPECS + the production
 * tool gateway), driven by chat.completions. Prints every tool call with its
 * args and a result digest, then the reply. For tracing live misbehaviour.
 *
 * Usage:
 *   NEXT_PUBLIC_CONVEX_URL=<prod> npx tsx scripts/grace_probe.mts "user message" ["second turn" ...]
 */
import OpenAI from "openai";
import { GRACE_REALTIME_INSTRUCTIONS } from "../src/lib/grace/realtimeInstructions";
import { GRACE_OPENAI_TOOL_SPECS } from "../src/lib/knowledge/toolSchemas";
import { executePublicGraceToolCall } from "../src/lib/grace/publicToolCallServer";

const turns = process.argv.slice(2);
if (turns.length === 0) throw new Error("usage: grace_probe.mts \"message\" ...");

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

const client = new OpenAI();
const tools = GRACE_OPENAI_TOOL_SPECS.map((s) => ({
    type: "function" as const,
    function: { name: s.name, description: s.description, parameters: s.parameters, strict: true },
}));

const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: GRACE_REALTIME_INSTRUCTIONS },
];

for (const userText of turns) {
    messages.push({ role: "user", content: userText });
    console.log(`\n════ USER: ${userText}`);
    for (let i = 0; i < 8; i++) {
        const res = await client.chat.completions.create({ model: process.env.GRACE_PROBE_MODEL ?? "gpt-5", messages, tools });
        const msg = res.choices[0].message;
        messages.push(msg);
        if (!msg.tool_calls?.length) {
            console.log(`GRACE: ${msg.content}`);
            break;
        }
        for (const tc of msg.tool_calls) {
            if (tc.type !== "function") continue;
            const args = JSON.parse(tc.function.arguments || "{}");
            let output: unknown;
            if (STUBBED.has(tc.function.name)) {
                output = { ok: true, stubbed: true };
                console.log(`  TOOL ${tc.function.name}(${JSON.stringify(args)}) → [stubbed]`);
            } else {
                output = await executePublicGraceToolCall({ tool_name: tc.function.name, parameters: args }, `probe-${i}`);
                const text = typeof output === "string" ? output : JSON.stringify(output);
                console.log(`  TOOL ${tc.function.name}(${JSON.stringify(args)})`);
                console.log(`       → ${(text ?? "null").slice(0, 400)}`);
            }
            const serialized = typeof output === "string" ? output : JSON.stringify(output);
            messages.push({ role: "tool", tool_call_id: tc.id, content: (serialized ?? "").slice(0, 12000) });
        }
    }
}
