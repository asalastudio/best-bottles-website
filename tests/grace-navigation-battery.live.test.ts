/**
 * Grace navigation-accuracy battery — LIVE test, skipped unless
 * GRACE_LIVE_BATTERY=1. Drives the same brain the OpenAI Realtime session
 * uses (GRACE_REALTIME_INSTRUCTIONS + GRACE_OPENAI_TOOL_SPECS): catalog tools
 * execute for real against Convex through the public tool gateway; client-side
 * display/navigation tools are stubbed and RECORDED so we can assert Grace
 * navigates to the RIGHT slug, not just plausible text.
 *
 * Run:
 *   GRACE_LIVE_BATTERY=1 npx vitest run tests/grace-navigation-battery.live.test.ts
 * (requires OPENAI_API_KEY and NEXT_PUBLIC_CONVEX_URL in the environment)
 */
import { describe, expect, it } from "vitest";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { GRACE_REALTIME_INSTRUCTIONS } from "../src/lib/grace/realtimeInstructions";
import { GRACE_OPENAI_TOOL_SPECS } from "../src/lib/knowledge/toolSchemas";
import { executePublicGraceToolCall } from "../src/lib/grace/publicToolCallServer";

const LIVE = process.env.GRACE_LIVE_BATTERY === "1";
const MODEL = "gpt-5";

// Tools that run in the browser in production — stubbed here, but every call
// is recorded with its arguments for assertion.
const CLIENT_STUBS = new Set([
    "navigateToPage", "showProducts", "showProductPresentation",
    "getCurrentPageContext", "getCartContents", "getBrowsingHistory",
    "proposeCartAdd", "proceedToCheckout", "prefillForm", "updateFormField",
    "submitForm", "setCatalogRefinements",
]);

type RecordedCall = { name: string; args: Record<string, unknown> };

async function runGraceTurn(
    userMessage: string,
    options?: { pageContext?: string; stubResults?: Record<string, unknown> },
): Promise<{ finalText: string; calls: RecordedCall[] }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY required for live battery");

    const tools = GRACE_OPENAI_TOOL_SPECS.map((spec) => ({
        type: "function" as const,
        function: {
            name: spec.name,
            description: spec.description,
            parameters: spec.parameters,
            strict: true,
        },
    }));

    let system = GRACE_REALTIME_INSTRUCTIONS;
    if (options?.pageContext) {
        system += `\n\nCURRENT PAGE CONTEXT (authoritative):\n${options.pageContext}`;
    }

    const messages: Array<Record<string, unknown>> = [
        { role: "system", content: system },
        { role: "user", content: userMessage },
    ];
    const calls: RecordedCall[] = [];

    for (let i = 0; i < 8; i++) {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: MODEL,
                reasoning_effort: "low",
                max_completion_tokens: 4096,
                tools,
                tool_choice: "auto",
                messages,
            }),
        });
        if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const msg = data.choices[0].message;
        if (!msg.tool_calls?.length) {
            return { finalText: typeof msg.content === "string" ? msg.content : "", calls };
        }
        messages.push(msg);
        for (const tc of msg.tool_calls) {
            const name = tc.function.name as string;
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* keep empty */ }
            calls.push({ name, args });
            let result: unknown;
            if (CLIENT_STUBS.has(name)) {
                result = options?.stubResults?.[name]
                    ?? { ok: true, note: `${name} executed in the customer's browser.` };
            } else {
                try {
                    result = await executePublicGraceToolCall(
                        { tool_name: name, parameters: args },
                        `battery-${Date.now()}-${i}`,
                    );
                } catch (e) {
                    result = `Tool error: ${e instanceof Error ? e.message : String(e)}`;
                }
            }
            messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: typeof result === "string" ? result : JSON.stringify(result).slice(0, 12_000),
            });
        }
    }
    return { finalText: "", calls };
}

function convex() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL required for live battery");
    return new ConvexHttpClient(url);
}

async function slugExists(slug: string): Promise<boolean> {
    const group = await convex().query(api.products.getProductGroup, { slug });
    return group !== null && group !== undefined;
}

function navigationTargets(calls: RecordedCall[]): string[] {
    return calls
        .filter((c) => c.name === "navigateToPage")
        .map((c) => String(c.args.path ?? ""));
}

describe.skipIf(!LIVE)("Grace navigation-accuracy battery (LIVE)", () => {
    it("navigates to a real product slug for an exact product request", { timeout: 120_000 }, async () => {
        const { calls } = await runGraceTurn(
            "Take me to the product page for your 15ml amber Boston Round with the black cap.",
        );
        const productPaths = navigationTargets(calls).filter((p) => p.startsWith("/products/"));
        const showCalls = calls.filter((c) => c.name === "showProducts");
        expect(productPaths.length + showCalls.length).toBeGreaterThan(0);
        for (const path of productPaths) {
            const slug = path.replace("/products/", "").split("?")[0];
            expect(await slugExists(slug), `navigated to nonexistent slug: ${slug}`).toBe(true);
        }
        // A raw navigateToPage path must be verified by a prior catalog search;
        // showProducts verifies internally, so no separate search is required.
        if (productPaths.length > 0) {
            expect(calls.some((c) => c.name === "searchCatalog")).toBe(true);
        }
    });

    it("moves to the 9ml clear cylinder roll-on with a verified slug", { timeout: 120_000 }, async () => {
        const { calls } = await runGraceTurn("Show me the 9ml clear cylinder roll-on bottle page.");
        const productPaths = navigationTargets(calls).filter((p) => p.startsWith("/products/"));
        const showCalls = calls.filter((c) => c.name === "showProducts" || c.name === "showProductPresentation");
        expect(productPaths.length + showCalls.length).toBeGreaterThan(0);
        for (const path of productPaths) {
            const slug = path.replace("/products/", "").split("?")[0];
            expect(await slugExists(slug), `navigated to nonexistent slug: ${slug}`).toBe(true);
        }
    });

    it("uses canonical Refine buckets when filtering the catalog", { timeout: 120_000 }, async () => {
        const { calls } = await runGraceTurn(
            "Filter the catalog to cobalt blue fine mist sprayers.",
        );
        const refine = calls.find((c) => c.name === "setCatalogRefinements");
        const nav = navigationTargets(calls).find((p) => p.startsWith("/catalog"));
        expect(refine ?? nav, "expected setCatalogRefinements or catalog navigation").toBeTruthy();
        if (refine) {
            const applicators = JSON.stringify(refine.args.applicators ?? "").toLowerCase();
            expect(applicators).toContain("finemist");
            // Canonical URL buckets, never customer-facing labels, in the filter dimension.
            expect(applicators).not.toContain("fine mist sprayer");
            expect(JSON.stringify(refine.args.colors ?? "").toLowerCase()).toContain("cobalt");
        }
    });

    it("refuses to navigate to a product that does not exist", { timeout: 120_000 }, async () => {
        const { finalText, calls } = await runGraceTurn(
            "Take me to the product page for your 10ml Boston Round.",
        );
        const productPaths = navigationTargets(calls).filter((p) => p.startsWith("/products/"));
        for (const path of productPaths) {
            const slug = path.replace("/products/", "").split("?")[0];
            expect(await slugExists(slug), `navigated to nonexistent slug for a nonexistent product: ${slug}`).toBe(true);
        }
        // Whatever she did, the reply must not confirm a 10ml Boston Round exists.
        expect(finalText.toLowerCase()).not.toMatch(/here('| i)s the 10\s*ml boston/);
    });

    it("answers from page context without re-navigating when asked about the current page", { timeout: 120_000 }, async () => {
        const pageContext = [
            "pageType: product",
            "path: /products/cylinder-9ml-clear-17-415-rollon",
            "product: Cylinder 9ml Clear Roll-On (17-415 neck)",
            "family: Cylinder | capacity: 9ml | color: Clear | applicators: Metal Roller Ball, Plastic Roller Ball",
        ].join("\n");
        const { finalText, calls } = await runGraceTurn(
            "What page am I looking at right now, and what would you pair with it?",
            {
                pageContext,
                stubResults: {
                    getCurrentPageContext: {
                        pageType: "product",
                        pathname: "/products/cylinder-9ml-clear-17-415-rollon",
                        currentProduct: {
                            name: "Cylinder 9ml Clear Roll-On",
                            family: "Cylinder",
                            capacityMl: 9,
                            neckThreadSize: "17-415",
                        },
                    },
                },
            },
        );
        expect(navigationTargets(calls)).toHaveLength(0);
        expect(finalText.toLowerCase()).toContain("9");
        expect(finalText.toLowerCase()).toContain("cylinder");
    });
});
