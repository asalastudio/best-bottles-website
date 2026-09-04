import { describe, expect, it } from "vitest";
import { formatGraceMemoryLines, normalizeRememberNoteKind } from "../src/lib/grace/memoryNotes";
import { buildGraceSiteCapabilities } from "../src/lib/grace/siteCapabilities";
import {
    AMBER_ROLLER_EVAL_SCRIPT,
    evaluateGraceSessionTrace,
    selectEvalScriptsForTrace,
} from "../src/lib/grace/sessionTraceEval";
import {
    GRACE_MERCHANDISER_TOOL_NAMES,
    GRACE_NAVIGATOR_TOOL_NAMES,
    splitToolsForGraceRole,
} from "../src/lib/grace/realtimeAgents";
import { GRACE_OPENAI_TOOL_SPECS } from "../src/lib/knowledge/toolSchemas";

describe("Grace memory, capabilities, and closed-loop evals", () => {
    it("formats profile, last correction, and last destination", () => {
        const lines = formatGraceMemoryLines({
            profile: "Scaling oil brand, 9ml rollers",
            lastCorrection: { text: "Not the fine mist — amber roller", at: 1 },
            lastDestination: {
                href: "/products/cylinder-9ml-amber-17-415-rollon",
                title: "Amber Cylinder roll-on",
                sku: "GB-CYL-AMB-9ML",
                at: 2,
            },
            updatedAt: 2,
        });
        expect(lines.join("\n")).toContain("Profile: Scaling oil brand");
        expect(lines.join("\n")).toContain("Last correction: Not the fine mist");
        expect(lines.join("\n")).toContain("/products/cylinder-9ml-amber-17-415-rollon");
        expect(normalizeRememberNoteKind("correction")).toBe("correction");
        expect(normalizeRememberNoteKind("nope")).toBeNull();
    });

    it("says plate swaps work on a PDP and glass changes require navigation", () => {
        const onPdp = buildGraceSiteCapabilities({ pageType: "pdp", companionMode: "agentic" });
        expect(onPdp.canSwapCapOnCurrentPdp).toBe(true);
        expect(onPdp.canChangeGlassOrApplicatorWithoutNavigation).toBe(false);
        expect(onPdp.kitsPublished).toBe(false);
        expect(onPdp.agenticFollowAlong).toBe(true);
        expect(onPdp.notes.some((note) => note.includes("different product URLs"))).toBe(true);
    });

    it("splits merchandiser and navigator tools on the same session", () => {
        const merch = splitToolsForGraceRole(GRACE_OPENAI_TOOL_SPECS, "merchandiser").map((tool) => tool.name);
        const nav = splitToolsForGraceRole(GRACE_OPENAI_TOOL_SPECS, "navigator").map((tool) => tool.name);
        expect(merch).toEqual(expect.arrayContaining([...GRACE_MERCHANDISER_TOOL_NAMES]));
        expect(nav).toEqual(expect.arrayContaining([...GRACE_NAVIGATOR_TOOL_NAMES]));
        expect(merch).toContain("searchCatalog");
        expect(merch).not.toContain("navigateToPage");
        expect(nav).toContain("navigateToPage");
        expect(merch).toContain("configureCurrentProduct");
        expect(nav).toContain("configureCurrentProduct");
        expect(nav).not.toContain("searchCatalog");
    });

    it("fails the amber/roller script when Grace only dropped a chat card", () => {
        const failed = evaluateGraceSessionTrace({
            sessionId: "s1",
            companionMode: "product",
            lastPageUrl: "/products/fine-mist",
            tools: [{ name: "displayProductCard", at: 1, ok: true }],
            destinations: [],
            metrics: { toolsCalled: 1, cartItemsAdded: 0, navigations: 0 },
        }, AMBER_ROLLER_EVAL_SCRIPT);
        expect(failed.passed).toBe(false);
        expect(failed.checks.find((check) => check.id === "navigated")?.passed).toBe(false);

        const passed = evaluateGraceSessionTrace({
            sessionId: "s2",
            companionMode: "agentic",
            lastPageUrl: "/products/cylinder-9ml-amber-17-415-rollon",
            tools: [
                { name: "searchCatalog", at: 1, ok: true, summary: "amber roller" },
                { name: "navigateToPage", at: 2, ok: true },
            ],
            destinations: [{ href: "/products/cylinder-9ml-amber-17-415-rollon", at: 2 }],
            metrics: { toolsCalled: 2, cartItemsAdded: 0, navigations: 1 },
        }, AMBER_ROLLER_EVAL_SCRIPT);
        expect(passed.passed).toBe(true);
        expect(selectEvalScriptsForTrace({
            sessionId: "s2",
            companionMode: "agentic",
            lastPageUrl: "/products/cylinder-9ml-amber-17-415-rollon",
            tools: [{ name: "navigateToPage", at: 1, ok: true }],
            destinations: [{ href: "/products/cylinder-9ml-amber-17-415-rollon", at: 1 }],
            metrics: { toolsCalled: 1, cartItemsAdded: 0, navigations: 1 },
        }).map((script) => script.id)).toContain("amber-roller-from-fine-mist");
    });
});
