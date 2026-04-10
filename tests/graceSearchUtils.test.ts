import { describe, expect, it } from "vitest";
import { detectApplicatorIntent, normalizeSearchTerm } from "../convex/graceSearchUtils";

describe("detectApplicatorIntent", () => {
    it("returns a single intent when only one applicator family is mentioned", () => {
        expect(detectApplicatorIntent("9ml cylinder roll-on")).toBe("rollon");
        expect(detectApplicatorIntent(normalizeSearchTerm("9ml roll-on bottle") || "")).toBe("rollon");
        expect(detectApplicatorIntent("30ml fine mist sprayer")).toBe("spray");
        expect(detectApplicatorIntent("lotion pump bottle")).toBe("pump");
    });

    it("returns null when multiple applicator types are named (e.g. 9ml roll + spray + pump)", () => {
        expect(
            detectApplicatorIntent(
                "9ml bottle roll-on fine mist sprayer and lotion pump",
            ),
        ).toBeNull();
        expect(
            detectApplicatorIntent(
                normalizeSearchTerm("9ml roll-on sprayer lotion pump") || "",
            ),
        ).toBeNull();
    });
});
