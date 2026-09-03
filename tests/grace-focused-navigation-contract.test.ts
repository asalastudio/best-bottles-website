import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GRACE_REALTIME_INSTRUCTIONS } from "../src/lib/grace/realtimeInstructions";

describe("Grace focused PDP navigation contract", () => {
    it("does not advertise a Paper Doll or unified builder customer flow", () => {
        const provider = readFileSync(new URL("../src/components/grace/GraceProvider.tsx", import.meta.url), "utf8");
        expect(provider).not.toContain("setPaperDollSelection");
        expect(provider).not.toContain("bottle builder");
        expect(GRACE_REALTIME_INSTRUCTIONS).not.toContain("setPaperDollSelection");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("focused finder");
        expect(GRACE_REALTIME_INSTRUCTIONS).toContain("canonical PDP");
    });
});
