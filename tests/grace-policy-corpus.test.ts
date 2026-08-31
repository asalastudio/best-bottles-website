/**
 * Drift guard for Grace's policy corpus (audit P0-2).
 *
 * The corpus is a verbatim copy of the customer-facing policy pages. If a page
 * is edited and the corpus is not, Grace would quote stale terms with total
 * confidence — the exact failure mode the 2026-08-06 audit caught ("2 business
 * days" vs the published 7 days). These tests fail loudly instead.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
    GRACE_POLICY_SECTIONS,
    buildPolicyToolResult,
    selectPolicySections,
} from "../src/lib/grace/policyCorpus";

/** Normalize JSX source the way the corpus stores it (entities + whitespace). */
function normalizePageSource(path: string): string {
    return readFileSync(path, "utf8")
        .replace(/&ndash;/g, "–")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ");
}

describe("Grace policy corpus stays in sync with the published pages", () => {
    it("every corpus statement still appears verbatim in its source page", () => {
        for (const section of GRACE_POLICY_SECTIONS) {
            // The support-contact line is composed for Grace rather than lifted
            // from a single page sentence; assert its address instead.
            if (section.topic === "Support contact") {
                expect(normalizePageSource(section.sourcePath)).toContain("sales@nematinternational.com");
                continue;
            }
            const page = normalizePageSource(section.sourcePath);
            const expected = section.text.replace(/\s+/g, " ");
            expect(page, `policy drift in "${section.topic}" — ${section.sourcePath} no longer contains this text`)
                .toContain(expected);
        }
    });

    it("pins the two windows Grace previously hallucinated", () => {
        const damage = GRACE_POLICY_SECTIONS.find((s) => s.topic.startsWith("Damaged"));
        const returns = GRACE_POLICY_SECTIONS.find((s) => s.topic.startsWith("Returns"));
        expect(damage?.text).toContain("within 7 days of delivery");
        expect(returns?.text).toContain("within 30 days of delivery");
        // Guard against the specific fabrication observed in the audit.
        for (const s of GRACE_POLICY_SECTIONS) {
            expect(s.text).not.toContain("2 business days");
        }
    });

    it("routes damage and return questions to the right sections", () => {
        expect(selectPolicySections("my order arrived damaged, what do I do?")
            .some((s) => s.text.includes("within 7 days of delivery"))).toBe(true);
        expect(selectPolicySections("what is your return policy?")
            .some((s) => s.text.includes("within 30 days of delivery"))).toBe(true);
        expect(selectPolicySections("how long does shipping take?")
            .some((s) => s.text.includes("1–3 business days"))).toBe(true);
    });

    it("declares the topics with no published policy so Grace cannot invent them", () => {
        const result = buildPolicyToolResult("do you offer a lifetime breakage guarantee?");
        expect(result.noPublishedPolicyFor.join(" ")).toContain("warranty or breakage guarantee");
        expect(result.guidance).toContain("never round");
    });
});
