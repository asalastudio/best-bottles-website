import { describe, it, expect } from "vitest";
import { csvCell, reconciliationCsv } from "../src/lib/catalog/reconciliation-csv";
import { reconciliationCaseSchema, reconciliationVerdict, evidenceKey } from "../src/lib/catalog/jev-reconciliation";
import { componentSearchText, componentMechanismKey } from "../convex/componentVocabulary";
import pilot from "../data/reconciliation/jev-pilot.json";

describe("stakeholder reconciliation CSV", () => {
    it("quotes delimiters and neutralizes spreadsheet formulas", () => {
        expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
        for (const value of ["=1+1", " +SUM(1)", "@SUM(1)", "-1+2", "\tcmd"]) expect(csvCell(value)).toContain("'");
    });
    it("never turns deliberately corrupted controls into stakeholder findings", () => {
        const rows = reconciliationCaseSchema.array().parse(pilot);
        const results = rows.map(row => ({ id: row.id, kind: row.kind, inputSha256: evidenceKey(row), response: null, ...reconciliationVerdict(row, null) }));
        const csv = reconciliationCsv(rows, results, "2026-09-23T00:00:00.000Z", true);
        expect(csv).not.toContain("control-"); expect(csv).toContain("not_evaluated");
        expect(csv).toContain("Stakeholder decision"); expect(csv).toContain("Supporting source URL");
        expect(csv).toContain("GBCrclFrst50DrpGl");
    });
    it("finds familiar names without collapsing distinct mechanisms", () => {
        expect(componentSearchText("Gold", "Sprayer", "A")).toContain("spray top");
        expect(componentSearchText("Metal", "Roller", "B")).toContain("roller ball");
        expect(componentMechanismKey("Sprayer", "Bulb with tassel", "AnSpTsl")).not.toBe(componentMechanismKey("Sprayer", "Fine mist", "Spry"));
    });
});
