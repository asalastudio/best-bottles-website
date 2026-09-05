import { describe, expect, it } from "vitest";
import { reconcilePdpEditorialDescriptions } from "@/lib/products/pdp-editorial-description";
import type { PdpBlock } from "@/components/PdpBlocks";

const description = (text: string): PdpBlock => ({
    _type: "pdpRichDescription", _key: "about", heading: "About this bottle",
    body: [{ _type: "block", _key: "p", children: [{ _type: "span", _key: "s", text, marks: [] }], markDefs: [] }],
});

describe("PDP editorial product identity", () => {
    it("replaces stale sprayer copy with the selected roll-on description", () => {
        const blocks = [description("A 9ml bottle built for fine mist sprayers.")];
        const result = reconcilePdpEditorialDescriptions(blocks, ["Metal Roller Ball"], "A 9ml roll-on for perfume oil.");
        expect(JSON.stringify(result)).toContain("A 9ml roll-on for perfume oil.");
        expect(JSON.stringify(result)).not.toContain("fine mist");
        expect(JSON.stringify(blocks)).toContain("fine mist");
    });

    it("preserves valid editorial formatting and unrelated blocks", () => {
        const blocks = [description("A roll-on for perfume oil."), { _type: "pdpTrustBadges", _key: "trust", badges: [] } as PdpBlock];
        expect(reconcilePdpEditorialDescriptions(blocks, ["Metal Roller Ball"], "Fallback")).toEqual(blocks);
    });

    it("omits contradictory copy when no compatible fallback exists", () => {
        const blocks = [description("Fine mist spray bottle.")];
        expect(reconcilePdpEditorialDescriptions(blocks, ["Metal Roller Ball"], null)).toEqual([]);
        expect(reconcilePdpEditorialDescriptions(blocks, ["Metal Roller Ball"], "Fine mist bottle.")).toEqual([]);
    });

    it("keeps spray descriptions for spray products", () => {
        const blocks = [description("A fine mist bottle.")];
        expect(reconcilePdpEditorialDescriptions(blocks, ["Fine Mist Sprayer"], null)).toEqual(blocks);
    });
});
