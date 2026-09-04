import { describe, expect, it } from "vitest";
import { GRACE_REALTIME_INSTRUCTIONS } from "../src/lib/grace/realtimeInstructions";

describe("Grace Realtime instructions", () => {
    it("encodes the production shopping and safety contract", () => {
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("supplier, not the manufacturer");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("Call a catalog tool before");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("explicit confirmation");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("active Refine state");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("9 mL 13-415");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("9 mL 17-415");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("Never start speaking proactively");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("40 words");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("in-chat cards");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("configureCurrentProduct");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("move them immediately");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("CATALOG HINT");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("getProductMeasurements");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("getSiteCapabilities");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("Hand off to Navigator");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain(
            "Use configureCurrentProduct for current-PDP cap, roller, or cap-on/off plate swaps",
        );
        expect(GRACE_REALTIME_INSTRUCTIONS).not.toContain(
            "Stay on merchandising for catalog facts and this-page",
        );
    });
});
