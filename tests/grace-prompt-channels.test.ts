import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GRACE_TEXT_CHANNEL_TOOLS, buildSystemPrompt } from "../convex/gracePrompt";
import { GRACE_TOOLS } from "../convex/graceToolDefs";

const BROWSER_ONLY_TOOLS = [
    "showProducts",
    "showProductPresentation",
    "navigateToPage",
    "displayProductCard",
    "configureCurrentProduct",
    "getCurrentPageContext",
    "getCartContents",
    "prefillForm",
    "updateFormField",
    "submitForm",
    "proposeCartAdd",
];

describe("Grace prompt channels", () => {
    it("names exactly the six tools askGrace really has", () => {
        const defined = GRACE_TOOLS
            .map((tool) => (tool.type === "function" ? tool.function.name : null))
            .filter((name): name is string => Boolean(name))
            .sort();
        expect([...GRACE_TEXT_CHANNEL_TOOLS].sort()).toEqual(defined);
    });

    it("gives the text channel links instead of browser tools it does not have", () => {
        const text = buildSystemPrompt({ channel: "text" });
        for (const tool of BROWSER_ONLY_TOOLS) {
            expect(text, `text prompt still mentions ${tool}`).not.toContain(tool);
        }
        expect(text).toContain("TEXT CHAT — your tools and how to share products");
        expect(text).toContain("[{itemName}](/products/{slug}?sku={websiteSku})");
        expect(text).toContain("[Request a quote](/request-quote)");
        expect(text).toContain("[Build Your Bottle](/matrix)");
        expect(text).toContain("run searchCatalog with ONE term");
        expect(text).toContain("a page_context block");
        // The catalogue tools and the constitution are unchanged.
        for (const tool of GRACE_TEXT_CHANNEL_TOOLS) expect(text).toContain(tool);
        expect(text).toContain("## CONSTITUTION");
    });

    it("keeps the browser channel as the default with its navigation guidance", () => {
        const browser = buildSystemPrompt();
        expect(browser).toBe(buildSystemPrompt({ channel: "browser" }));
        expect(browser).toContain("### showProducts / Navigation — Single Search Terms Only");
        expect(browser).toContain("call **navigateToPage** with **path**");
        // showProducts takes `family`, not searchCatalog's `familyLimit`.
        expect(browser).toContain('family: "Vial" plus "1ml"');
        expect(browser).not.toContain('familyLimit: "Vial"');
        expect(browser).toContain("available via getCurrentPageContext");
        expect(browser).not.toContain("TEXT CHAT — your tools");
    });

    it("wires askGrace and the Jev eval to the text channel", () => {
        expect(readFileSync("convex/grace.ts", "utf8")).toContain('buildSystemPrompt({ channel: "text" })');
        expect(readFileSync("scripts/grace-jev-intent-eval.mts", "utf8")).toContain('buildSystemPrompt({ channel: "text" })');
    });
});
