/**
 * Probe the ACTUAL production voice brain — gpt-realtime-2.1 over the
 * Realtime WebSocket API with GRACE_REALTIME_INSTRUCTIONS and the production
 * tool gateway. The chat-completions probe (grace_probe.mts) exercises gpt-5;
 * live sessions do not run gpt-5, and realtime-model tool behaviour differs.
 * This is the harness for reproducing "she couldn't find it" reports.
 *
 * Text-in/text-out (no audio): the model, instructions, and tools are the
 * production ones; only the input modality differs from a spoken session.
 *
 * Usage:
 *   NEXT_PUBLIC_CONVEX_URL=<prod> npx tsx scripts/grace_realtime_probe.mts "user message"
 */
import { GRACE_REALTIME_INSTRUCTIONS } from "../src/lib/grace/realtimeInstructions";
import { GRACE_REALTIME_MODEL } from "../src/lib/grace/openaiRealtimeConfig";
import { GRACE_OPENAI_TOOL_SPECS } from "../src/lib/knowledge/toolSchemas";
import { executePublicGraceToolCall } from "../src/lib/grace/publicToolCallServer";
import { getGraceRefineState, applyGraceRefinementRequest } from "../src/lib/grace/refineState";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY required");
const userText = process.argv[2];
if (!userText) throw new Error("usage: grace_realtime_probe.mts \"message\"");

const STUBBED = new Set([
    "navigateToPage", "showProducts", "showProductPresentation", "displayProductCard",
    "displayAnatomy", "displayFamilyCard", "displayCompatibility", "displayBuildKit",
    "displayComparison", "displayCatalogStrip", "compareProducts",
    "getCurrentPageContext", "getCartContents", "getBrowsingHistory",
    "proposeCartAdd", "proceedToCheckout", "prefillForm", "updateFormField",
    "submitForm", "setPaperDollSelection",
    "saveShortlist", "shareShortlist", "prepareQuote", "confirmQuote",
    "createProject", "saveToProject", "uploadImage",
]);

/**
 * Faithful headless setCatalogRefinements — mirrors GraceProvider's client
 * tool (proposal → applyGraceRefinementRequest → verified refineState search →
 * same return strings, including the zero-match rejection). The live "black
 * plug → colors:['Black'] → 0 groups → 'we don't carry it'" failure was
 * invisible while this tool was stubbed; never stub it again.
 */
async function runSetCatalogRefinements(params: Record<string, unknown>): Promise<string> {
    const asArray = (v: unknown): string[] | undefined => {
        if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
        if (typeof v !== "string") return undefined;
        return v.split(",").map((s) => s.trim()).filter(Boolean);
    };
    const proposal: Record<string, unknown> = {};
    for (const key of ["search", "category", "collection", "componentType"] as const) {
        if (typeof params[key] === "string") proposal[key] = params[key];
    }
    for (const key of ["priceMin", "priceMax"] as const) {
        if (typeof params[key] === "number") proposal[key] = params[key];
    }
    for (const key of ["applicators", "families", "colors", "capacities", "neckThreadSizes"] as const) {
        const arr = asArray(params[key]);
        if (arr) proposal[key] = arr;
    }
    const current = getGraceRefineState(new URLSearchParams());
    const next = applyGraceRefinementRequest(current, proposal, String(params.customerRequest ?? ""));
    const result = await executePublicGraceToolCall({
        tool_name: "searchCatalog",
        parameters: {
            searchTerm: next.filters.search || String(params.customerRequest ?? "catalog refinement"),
            categoryLimit: null, familyLimit: null, applicatorFilter: null,
            refineState: next, returnRaw: true,
        },
    }, "rt-probe-refine") as { totalCount?: number; items?: unknown[] } | null;
    const verifiedCount = result?.totalCount ?? result?.items?.length ?? 0;
    if (verifiedCount === 0) {
        return "Refine NOT applied: that filter combination matches 0 product groups, so the change was rejected to avoid showing an empty catalog. This is NOT evidence the product doesn't exist — one dimension is wrong (most often a cap/closure color placed in the glass-color facet). Drop the suspect dimension and call searchCatalog with a plain description instead; answer availability ONLY from those rows.";
    }
    return `Verified ${verifiedCount} matching product group${verifiedCount === 1 ? "" : "s"} and updated the visible Refine state.`;
}

const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${GRACE_REALTIME_MODEL}`, [
    "realtime",
    `openai-insecure-api-key.${apiKey}`,
]);

const send = (o: unknown) => ws.send(JSON.stringify(o));
let done = false;
const timeout = setTimeout(() => { console.error("TIMEOUT (120s)"); process.exit(2); }, 120_000);

ws.addEventListener("open", () => {
    send({
        type: "session.update",
        session: {
            type: "realtime",
            instructions: GRACE_REALTIME_INSTRUCTIONS,
            output_modalities: ["text"],
            tool_choice: "auto",
            tools: GRACE_OPENAI_TOOL_SPECS.map((s) => ({
                type: "function", name: s.name, description: s.description, parameters: s.parameters,
            })),
        },
    });
    send({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text: userText }] },
    });
    send({ type: "response.create" });
    console.log(`════ USER (${GRACE_REALTIME_MODEL}): ${userText}`);
});

ws.addEventListener("message", async (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.type === "error") {
        console.error("API ERROR:", JSON.stringify(msg.error ?? msg).slice(0, 400));
        process.exit(1);
    }
    if (msg.type !== "response.done") return;
    const outputs = msg.response?.output ?? [];
    const calls = outputs.filter((o: { type: string }) => o.type === "function_call");
    for (const o of outputs) {
        if (o.type === "message") {
            const text = (o.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
            if (text) { console.log(`GRACE: ${text}`); done = true; }
        }
    }
    if (calls.length === 0) {
        if (done) { clearTimeout(timeout); ws.close(); process.exit(0); }
        return;
    }
    for (const call of calls) {
        const args = JSON.parse(call.arguments || "{}");
        let output: unknown;
        if (call.name === "setCatalogRefinements") {
            output = await runSetCatalogRefinements(args);
            console.log(`  TOOL ${call.name}(${JSON.stringify(args)})`);
            console.log(`       → ${String(output).slice(0, 350)}`);
        } else if (STUBBED.has(call.name)) {
            output = { ok: true, stubbed: true };
            console.log(`  TOOL ${call.name}(${JSON.stringify(args)}) → [stubbed]`);
        } else {
            output = await executePublicGraceToolCall({ tool_name: call.name, parameters: args }, "rt-probe");
            const text = typeof output === "string" ? output : JSON.stringify(output);
            console.log(`  TOOL ${call.name}(${JSON.stringify(args)})`);
            console.log(`       → ${(text ?? "null").slice(0, 350)}`);
        }
        const serialized = typeof output === "string" ? output : JSON.stringify(output);
        send({
            type: "conversation.item.create",
            item: { type: "function_call_output", call_id: call.call_id, output: (serialized ?? "").slice(0, 12000) },
        });
    }
    send({ type: "response.create" });
});

ws.addEventListener("close", (e) => { if (!done) { console.error(`closed (${e.code}) before a reply`); process.exit(1); } });
