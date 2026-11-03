import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { localPdpComponentKits, readLocalComponentKits } from "@/lib/paper-doll/local-component-kits";

afterEach(() => vi.unstubAllEnvs());
describe("60 ml Elegant local reducer", () => {
    it("uses the 60 ml body master of its glass, the one every other 60 ml kit draws, on the product page and in the builder", () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("VERCEL", "");
        const skus = ["GBElg60RdcrBlkLthr", "GBElgFrst60RdcrBlkLthr"];
        const builder = readLocalComponentKits()!;
        const pdp = localPdpComponentKits("localhost:3010", undefined, skus.map(websiteSku => ({ websiteSku })));
        for (const [i, sku] of skus.entries()) {
            const sprayer = builder[["GBElg60SpryShnGl", "GBElgFrst60SpryShnBlk"][i]].parts.find(part => part.slot === "body")!;
            const body = builder[sku].parts.find(part => part.slot === "body")!;
            expect(body.image.url).toBe(sprayer.image.url);
            expect(body.box).toEqual(sprayer.box);
            expect(pdp[sku]).toEqual(builder[sku]);
            expect(builder[sku].parts.some(part => part.slot === "reducer")).toBe(true);
        }
    });
});
