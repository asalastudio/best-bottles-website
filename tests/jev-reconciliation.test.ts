import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import pilot from "../data/reconciliation/jev-pilot.json";
import { reconciliationCaseSchema, reconciliationState, reconciliationResponseSchema,
    reconciliationVerdict, evidenceKey, reviewReconciliation, RECONCILIATION_MODEL,
    RECONCILIATION_ENDPOINT } from "../src/lib/catalog/jev-reconciliation";

const rows = reconciliationCaseSchema.array().parse(pilot);
const supported = { type: "choice" as const, choice: "supported" as const, confidence: .99,
    probabilities: { supported: .99, contradicted: .005, insufficient: .005 } };
const answer = () => ({ model: RECONCILIATION_MODEL as typeof RECONCILIATION_MODEL,
    answers: { identity: structuredClone(supported), mechanism: structuredClone(supported), finish: structuredClone(supported) },
    usage: { input_tokens: 100, output_tokens: 20 } });

describe("advisory Jev bottle/component evidence review", () => {
    it("keeps exact source bytes for every catalog evidence record", () => {
        for (const row of rows.filter(r => r.kind === "catalog")) {
            for (const source of [row.assemblySource, row.componentSource]) {
                if (!source) continue;
                const raw = gunzipSync(readFileSync(`docs/reviews/jev-reconciliation-2026-09-23/source-html/${source.sha256}.html.gz`));
                expect(createHash("sha256").update(raw).digest("hex")).toBe(source.sha256);
                expect(raw.toString()).toContain(source.itemSku);
            }
        }
    });
    it("never sends benchmark labels, notes, Shopify IDs or credentials in model state", () => {
        const row = reconciliationCaseSchema.parse({ ...rows[0], expected: "review", note: "secret label", shopifyVariantId: "private" });
        const state = reconciliationState(row);
        expect(Object.keys(state).sort()).toEqual(["assemblySource", "bottle", "componentSource", "mode", "proposed"]);
        expect(JSON.stringify(state)).not.toMatch(/secret label|shopifyVariantId|expected/);
    });
    it("cannot let even unanimous model approval override exact identity, neck or category errors", () => {
        for (const id of ["wrong-neck", "wrong-source-sku", "missing-source", "assembled-as-loose-part"]) {
            expect(reconciliationVerdict(rows.find(r => r.id === `control-${id}`)!, answer()).status).toBe("review_required");
        }
    });
    it("holds an unavailable model instead of reporting a passing audit", () => {
        expect(reconciliationVerdict(rows[0], null).status).toBe("not_evaluated");
        expect(reconciliationVerdict(rows[0], answer()).status).toBe("evidence_aligned");
    });
    it("checks literal family, glass and capacity disagreements even when the model misses them", () => {
        expect(reconciliationVerdict(rows.find(r => r.id === "control-round-instead-of-circle")!, answer()).issues).toContain("source_family_mismatch");
        expect(reconciliationVerdict(rows.find(r => r.id === "control-clear-instead-of-frosted")!, answer()).issues).toContain("source_glass_mismatch");
        expect(reconciliationVerdict(rows.find(r => r.id === "GBCyl5SpryGlMatt")!, answer()).issues).toContain("source_capacity_mismatch");
    });
    it("holds disagreement and uncertain answers for human review", () => {
        const response = answer(); response.answers.finish.confidence = .6;
        expect(reconciliationVerdict(rows[0], response).issues).toContain("finish_uncertain");
        const insufficient = reconciliationResponseSchema.parse({ ...answer(), answers: { ...answer().answers,
            mechanism: { type: "choice", choice: "insufficient", confidence: .95,
                probabilities: { supported: .025, contradicted: .025, insufficient: .95 } } } });
        expect(reconciliationVerdict(rows[0], insufficient).issues).toContain("mechanism_insufficient");
    });
    it("invalidates cached judgments when source evidence or the proposed component changes", () => {
        const changed = structuredClone(rows[0]); changed.proposed.name = "Silver dropper";
        expect(evidenceKey(changed)).not.toBe(evidenceKey(rows[0]));
        changed.proposed = rows[0].proposed; changed.assemblySource!.description += " corrected";
        expect(evidenceKey(changed)).not.toBe(evidenceKey(rows[0]));
        expect(evidenceKey({ ...rows[0], expected: "review" })).toBe(evidenceKey(rows[0]));
    });
    it("rejects incomplete, unpinned or inconsistent model responses", () => {
        expect(reconciliationResponseSchema.safeParse({ ...answer(), model: "jev-latest" }).success).toBe(false);
        expect(reconciliationResponseSchema.safeParse({ ...answer(), answers: {} }).success).toBe(false);
        const bad = answer(); bad.answers.identity.probabilities.supported = .1;
        expect(reconciliationResponseSchema.safeParse(bad).success).toBe(false);
    });
    it("uses only the fixed API endpoint and does not leak error response text", async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(answer()), { status: 200 }));
        await expect(reviewReconciliation(rows[0], "test-key", fetcher)).resolves.toEqual(answer());
        expect(fetcher.mock.calls[0][0]).toBe(RECONCILIATION_ENDPOINT);
        const payload = JSON.parse(String(fetcher.mock.calls[0][1]!.body));
        expect(payload.model).toBe(RECONCILIATION_MODEL);
        expect(payload.state).toEqual(reconciliationState(rows[0]));
        fetcher.mockResolvedValue(new Response("sensitive server details", { status: 401 }));
        await expect(reviewReconciliation(rows[0], "test-key", fetcher)).rejects.toThrow(/^Jev HTTP 401$/);
    });
});
