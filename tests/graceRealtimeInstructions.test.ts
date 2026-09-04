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
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("in-chat cards and links");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("cannot flip the live PDP");
    });
});
