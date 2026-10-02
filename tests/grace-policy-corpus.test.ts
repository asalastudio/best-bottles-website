import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { FAQ_POLICY_ENTRIES, FAQ_POLICY_SOURCE, buildFaqPolicyPrompt } from "../src/lib/faqPolicy";
import { buildSystemPrompt, SALES_FLOW, VOICE_MODE_ADDENDUM } from "../convex/gracePrompt";
import { GRACE_TOOLS } from "../convex/graceToolDefs";
import { GRACE_REALTIME_INSTRUCTIONS } from "../src/lib/grace/realtimeInstructions";
import { buildPolicyToolResult, selectPolicySections } from "../src/lib/grace/policyCorpus";
import { executeGraceServerTool } from "../src/lib/grace/toolGatewayServer";

vi.mock("../src/lib/convexServerClient", () => ({
    createResilientConvexHttpClient: () => ({ query: () => { throw new Error("Policy must not query live data"); } }),
}));

const answer = (id: string) => FAQ_POLICY_ENTRIES.find((entry) => entry.id === id)!.a;
const source = gunzipSync(readFileSync(FAQ_POLICY_SOURCE.snapshotPath)).toString("utf8");
const sourceText = source.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("approved FAQ evidence and critical terms", () => {
    it("pins the dated user-designated source and the downloaded evidence", () => {
        expect(FAQ_POLICY_SOURCE.url).toBe("https://www.bestbottles.com/faq.php");
        expect(FAQ_POLICY_SOURCE.verifiedOn).toBe("2026-10-02");
        expect(createHash("sha256").update(source).digest("hex"))
            .toBe("a91b5b436e285ac9afb0e612fbee86f18c352ffac704957d96ab0a5f463bebbd");
        for (const entry of FAQ_POLICY_ENTRIES) expect(sourceText).toContain(entry.sourceQuestion);
    });

    it("requires returned goods to arrive within 15 days, with the published fees and exclusions", () => {
        expect(answer("returns")).toContain("received back within 15 days");
        for (const term of ["unused", "condition received", "15%", "return freight", "rush", "packing list", "tracking", "Personalized", "international"])
            expect(answer("returns")).toContain(term);
        expect(sourceText).toContain("The products must be returned to us within 15 days of receiving them.");
        expect(sourceText).toContain("A restocking fee of 15% will be charged.");
        for (const term of ["3 business days", "7 business days", "2–10 business days", "original payment method"])
            expect(answer("refund-timing")).toContain(term);
    });

    it("separates damage/defect from missing items and preserves the conflicting general wording", () => {
        expect(answer("damaged-defective")).toContain("damage or defect claims within 7 business days");
        expect(answer("damaged-defective")).toContain("pictures and a description");
        expect(answer("damaged-defective")).toContain("original packaging until the claim is settled");
        for (const term of ["Check every carton", "separately", "within 48 hours", "6–8 business days", "refunded or replaced", "7 business days"])
            expect(answer("missing-items")).toContain(term);
        expect(sourceText).toContain("damaged, defective or missing product(s) must be filed");
        expect(sourceText).toContain("within 7 business days of receiving your order");
        expect(sourceText).toContain("within 48 hours of receiving your order");
    });

    it("preserves both processing statements, seasonality, pickup wording, and the published PST label", () => {
        for (const term of ["2–3 business days", "1–5 business days", "September–December", "4–5 business days", "1–3 days", "statements differ"])
            expect(answer("lead-times")).toContain(term);
        for (const term of ["800-936-3628", "not accepted by email", "before 11:00am PST", "$15", "international", "personalized", "Saturday/Sunday/holiday", "some large, oversize, or special-order"])
            expect(answer("same-day")).toContain(term);
        expect(answer("pickup")).toContain("at least 1 day ahead");
        expect(answer("pickup")).toContain("10:30am–3:00pm");
        expect(answer("pickup")).not.toContain("1 business day");
    });

    it("preserves minimum/sample eligibility, payment conditions, duties, and order-change limits", () => {
        expect(answer("minimum-order")).toContain("$50.00, excluding shipping");
        for (const term of ["verified businesses", "item codes", "sales@nematinternational.com", "invoice"])
            expect(answer("samples")).toContain(term);
        for (const term of ["PayPal", "Visa", "Mastercard", "American Express", "Discover", "business checks", "check clears", "registered billing address", "bank wire"])
            expect(answer("payments")).toContain(term);
        expect(answer("international-payment")).toContain("when the order is ready for shipping");
        expect(answer("international-shipping")).toContain("duties, taxes, brokerage fees");
        for (const term of ["Email", "order name", "order number", "not shipped", "not guaranteed", "1–3 days", "2–3 business days"])
            expect(answer("order-changes")).toContain(term);
    });
});

describe("policy parity across Grace channels", () => {
    it.each([
        ["returns and refunds", ["returns", "refund-timing"]],
        ["my bottle arrived damaged", ["damaged-defective"]],
        ["a cap is missing", ["damaged-defective", "missing-items"]],
        ["shipping processing time", ["lead-times", "order-changes"]],
        ["sample below the minimum", ["minimum-order", "samples"]],
        ["international card payment", ["payments", "international-payment", "international-shipping"]],
        ["pickup hours", ["pickup", "contact"]],
    ])("routes %s without losing associated terms", (question, ids) => {
        const selected = selectPolicySections(question).map((entry) => entry.text);
        for (const id of ids) expect(selected).toContain(answer(id));
    });

    it("returns the contract through the actual Realtime server tool without a live policy query", async () => {
        vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://ci-placeholder.convex.cloud");
        try {
            const result = await executeGraceServerTool({ toolName: "getPolicy", parameters: { question: "" } });
            expect(result).toEqual(buildPolicyToolResult(""));
        } finally { vi.unstubAllEnvs(); }
        const result = buildPolicyToolResult("");
        expect(result.sections.map((entry) => entry.policyText)).toEqual(FAQ_POLICY_ENTRIES.map((entry) => entry.a));
        for (const section of result.sections) expect(section.source).toBe(FAQ_POLICY_SOURCE.url);
    });

    it("embeds all the same answers in both prompt channels without adding a nonexistent fallback tool", () => {
        for (const channel of ["text", "browser"] as const) {
            const prompt = buildSystemPrompt({ channel });
            expect(prompt.split(buildFaqPolicyPrompt())).toHaveLength(2);
            expect(prompt).toContain("Never present fitment information as a commercial guarantee.");
            for (const entry of FAQ_POLICY_ENTRIES) expect(prompt).toContain(entry.a);
            for (const stale of ["within 30 days", "POLICY FACTS — MEMORISE", "POLICIES & LOGISTICS", "ONLY fall back to sample", "there's no unit minimum", "System Guarantee", "GUARANTEED to fit", "9.98mm to 10.04mm", "will seat perfectly", "every closure perfectly matches"])
                expect(prompt).not.toContain(stale);
        }
        expect(GRACE_TOOLS.filter((tool) => tool.type === "function").map((tool) => tool.function.name)).not.toContain("getPolicy");
        expect(buildSystemPrompt({ channel: "text" })).not.toContain("call getPolicy");
        expect(readFileSync("src/app/api/grace/chat/route.ts", "utf8")).toContain("api.grace.askGrace");
        expect(readFileSync("convex/grace.ts", "utf8")).toContain('buildSystemPrompt({ channel: "text" })');
        expect(SALES_FLOW).not.toContain("No unit minimums");
    });

    it("allows requested verified sample item codes in every prompt mode without inventing decoration minimums", () => {
        for (const prompt of [buildSystemPrompt({ channel: "text" }), buildSystemPrompt({ channel: "browser" }), VOICE_MODE_ADDENDUM]) {
            expect(prompt).toContain("Only when the customer requests item codes for a sample-order email");
            expect(prompt).toContain("exact websiteSku values from verified catalog tool rows");
            expect(prompt).toContain("If a websiteSku is unavailable, ask the team to verify the item code");
            for (const stale of ["No SKU codes", "NEVER say SKU codes", "1,000+ unit minimum", "50–100 units"])
                expect(prompt).not.toContain(stale);
        }
        const text = buildSystemPrompt({ channel: "text" });
        expect(text).toContain("Screen printing: ask the team to confirm");
        expect(text).toContain("Digital printing: ask the team to confirm");
    });

    it("requires Realtime lookup for all policy topics and leaves real gaps explicit", () => {
        for (const topic of ["minimum orders", "samples", "payments", "pickup", "missing items", "order changes"])
            expect(GRACE_REALTIME_INSTRUCTIONS).toContain(topic);
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("MUST call getPolicy first");
        const result = buildPolicyToolResult("free shipping and net terms");
        expect(result.noPublishedPolicyFor.join(" ")).toContain("free-shipping thresholds");
        expect(result.noPublishedPolicyFor.join(" ")).toContain("net terms");
        expect(result.noPublishedPolicyFor).not.toContain("minimum order value");
        expect(result.guidance).toContain("never round");
    });
});
