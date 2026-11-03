import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readFileSync } from "node:fs";
import { elegant15ReviewSku, ELEGANT15_MASTER_REVIEW_VERSION } from "../src/lib/products/elegant15-master";
import { localPdpComponentKits, readLocalComponentKits } from "../src/lib/paper-doll/local-component-kits";

const review = JSON.parse(readFileSync("public/local-kits/remaining-13-415-2026-11-01/kits.json", "utf8"));
afterEach(() => vi.unstubAllEnvs());
describe("15 ml Elegant local catalog masters", () => {
    it("covers only exact reviewed SKUs and matches their product page and builder bodies", () => {
        vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", "");
        expect(review.version).toBe(ELEGANT15_MASTER_REVIEW_VERSION);
        const candidates = Object.entries(review.rows).filter(([, kit]: [string, any]) => kit.register?.bodyId === "elegant-15ml-13-415");
        expect(candidates.length).toBe(69);
        const builder = readLocalComponentKits()!;
        const pdp = localPdpComponentKits("localhost:3010", undefined, candidates.map(([websiteSku]) => ({ websiteSku })));
        for (const [sku, source] of candidates as Array<[string, any]>) {
            expect(elegant15ReviewSku(sku.toLowerCase())).toBe(sku);
            expect(builder[sku]?.parts.find(part => part.slot === "body")?.image.url).toBe(source.parts.find((part: any) => part.slot === "body")?.image.url);
            expect(pdp[sku]).toEqual(builder[sku]);
        }
        // Added beside the frozen batch: the frosted body of its glass with its clear twin's cap, seated as the frosted kits seat it.
        const added = builder.GBElgFrst15BlkShSht;
        expect(elegant15ReviewSku("GBElgFrst15BlkShSht")).toBe("GBElgFrst15BlkShSht");
        expect(added.parts.find(part => part.slot === "body")).toEqual(review.rows.GBElgFrst15CuSht.parts.find((part: any) => part.slot === "body"));
        expect(added.parts.find(part => part.slot === "cap")?.image).toEqual(review.rows.GBElg15BlkShSht.parts.find((part: any) => part.slot === "cap").image);
        expect(localPdpComponentKits("localhost:3010", undefined, [{ websiteSku: "GBElgFrst15BlkShSht" }]).GBElgFrst15BlkShSht).toEqual(added);
        expect(elegant15ReviewSku("GBElg30GlCap")).toBeNull();
        expect(elegant15ReviewSku("GBElg15MadeUp")).toBeNull();
    });
});
