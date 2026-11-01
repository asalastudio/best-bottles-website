import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { BuilderKit } from "@/lib/bottle-builder/model";
import index from "@/lib/products/cylinder5-master-index.json";
vi.mock("server-only", () => ({}));
import { localGpt13ComponentKits, localPdpComponentKits, readLocalComponentKits } from "@/lib/paper-doll/local-component-kits";
const before = JSON.parse(readFileSync("docs/reviews/cylinder5-cobalt-material-2026-11-01/before-kits.json", "utf8")).rows as Record<string, BuilderKit>;
const current = JSON.parse(readFileSync(index.kitFile, "utf8")).rows as Record<string, BuilderKit>;
afterEach(() => vi.unstubAllEnvs());
describe("one 5 ml cobalt material master", () => {
    it("changes only the body artwork on all 35 cobalt configurations", () => {
        expect(index.cobaltSkus).toHaveLength(35);
        expect(Object.keys(current)).toHaveLength(71);
        const bodies = new Set<string>();
        for (const [sku, kit] of Object.entries(current)) {
            if (!index.cobaltSkus.includes(sku)) { expect(kit).toEqual(before[sku]); continue; }
            const original = before[sku].parts.find(p => p.slot === "body")!;
            const body = kit.parts.find(p => p.slot === "body")!;
            bodies.add(body.image.url);
            expect({ ...body, image: original.image, image2x: original.image2x }).toEqual(original);
            expect(kit.parts.filter(p => p.slot !== "body")).toEqual(before[sku].parts.filter(p => p.slot !== "body"));
            expect(kit.anchors).toEqual(before[sku].anchors);
            expect(kit.glassSizing).toEqual(before[sku].glassSizing);
        }
        expect([...bodies]).toEqual([index.body.url]);
    });
    it("uses the same source in normal navigation, old gpt13 bookmarks, and the builder", () => {
        vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", ""); vi.stubEnv("BUILDER_LOCAL_KITS", "");
        const builder = readLocalComponentKits()!;
        const pilot = localGpt13ComponentKits("localhost:3010", "gpt13");
        for (const sku of index.skus) {
            expect(builder[sku]).toEqual(current[sku]);
            expect(pilot[sku]).toEqual(current[sku]);
            for (const flag of [undefined, "gpt13"]) expect(localPdpComponentKits("localhost:3010", flag, [{ websiteSku: sku }])[sku]).toEqual(current[sku]);
        }
    });
});

describe("5 ml catalog master source", () => {
    it("serves the same exact kit and refuses unknown or hosted requests", async () => {
        const { GET } = await import("@/app/api/bottle-masters/cylinder5/route");
        vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", "");
        for (const sku of ["GBCyl5SpryGlMatt", "GBCylBlu5SprySlSh", "GBCylBlu5RollSlMatt", "GBCylBlu5Gl"]) {
            const response = await GET(new Request(`http://localhost:3010/api/bottle-masters/cylinder5?sku=${sku}`));
            expect(response.status).toBe(200);
            expect((await response.json()).kit).toEqual(current[sku]);
        }
        expect((await GET(new Request("http://localhost:3010/api/bottle-masters/cylinder5?sku=GBCylBlu9SpryGl"))).status).toBe(404);
        expect((await GET(new Request("http://example.com/api/bottle-masters/cylinder5?sku=GBCylBlu5Gl"))).status).toBe(404);
        vi.stubEnv("VERCEL", "1");
        expect((await GET(new Request("http://localhost:3010/api/bottle-masters/cylinder5?sku=GBCylBlu5Gl"))).status).toBe(404);
    });
    it("routes 5 ml and 9 ml previews to separate exact-SKU sources", async () => {
        const { cylinderMasterSource } = await import("@/lib/products/cylinder-master");
        expect(cylinderMasterSource("GBCylBlu5Gl")).toEqual({ family: "cylinder5", version: index.version });
        expect(cylinderMasterSource("GBCylBlu9SpryGl")?.family).toBe("cylinder9");
        expect(cylinderMasterSource("GBSleek5SpryGlSh")).toBeNull();
    });
});
