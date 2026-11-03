import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { BuilderKit } from "@/lib/bottle-builder/model";
import index from "@/lib/products/cylinder9-master-index.json";
import { pdpReviewedGlassViewport } from "@/lib/products/pdp-stage-frame";
vi.mock("server-only", () => ({}));
import { localPdpComponentKits } from "@/lib/paper-doll/local-component-kits";
import { approvedComponentKit } from "@/lib/paper-doll/approved-component-kits";
import { GET } from "@/app/api/bottle-masters/cylinder9/route";
const library = JSON.parse(readFileSync(index.kitFile, "utf8")) as { version: string; rows: Record<string, BuilderKit> };
afterEach(() => vi.unstubAllEnvs());

describe("approved Cylinder 9 ml master reuse", () => {
    it("uses one byte-verified master per glass across every component configuration", () => {
        expect(Object.keys(library.rows)).toHaveLength(145);
        expect(library.version).toBe(index.version);
        const frames = new Set<string>();
        for (const [sku, kit] of Object.entries(library.rows)) {
            const identity = index.skus[sku as keyof typeof index.skus];
            const body = kit.parts.filter(part => part.slot === "body");
            expect(body).toHaveLength(1);
            expect(body[0].image.url).toBe(index.assets[(`body-${identity.glass}`) as keyof typeof index.assets].url);
            frames.add(JSON.stringify(pdpReviewedGlassViewport(body[0].bounds, kit.anchors.axisX, kit.glassSizing!, 1000, 1100)));
        }
        expect(frames.size).toBe(1);
        for (const asset of Object.values(index.assets)) {
            const bytes = readFileSync("public" + asset.url);
            expect(bytes.length).toBe(asset.bytes);
            expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
        }
    });
    it("reuses the actuator, overcap and internal mechanism across 30 fine-mist combinations", () => {
        const sprays = Object.entries(library.rows).filter(([sku]) => index.skus[sku as keyof typeof index.skus].fitment === "Fine Mist Sprayer");
        expect(sprays).toHaveLength(30);
        for (const [sku, kit] of sprays) {
            for (const [slot, key] of [["sprayer", "actuator"], ["overcap", "overcap"], ["diptube", "tube-fitted"]] as const) {
                expect(kit.parts.find(part => part.slot === slot)?.image.url).toBe(index.assets[key].url);
            }
            const tube = kit.parts.find(part => part.slot === "diptube")!;
            expect(tube.views).toEqual(index.skus[sku as keyof typeof index.skus].glass === "clear" ? undefined : ["exploded"]);
        }
    });
    it("selects the same exact-SKU kits for normal localhost PDP navigation", () => {
        vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", "");
        const variants = [...Object.keys(library.rows), "unrelated-product"].map(websiteSku => ({ websiteSku }));
        const selected = localPdpComponentKits("localhost:3010", undefined, variants);
        expect(Object.keys(selected)).toHaveLength(145);
        expect(selected.GBCylAmb9SpryGl).toEqual(approvedComponentKit("GBCylAmb9SpryGl"));
        expect(selected.GBCylAmb9SpryGl.parts.find(part => part.slot === "body")?.image.url).toBe("/images/cylinder9-masters-2026-11-02/amber.webp");
        expect(selected["unrelated-product"]).toBeUndefined();
        expect(localPdpComponentKits("example.com", "kits", variants)).toEqual({});
    });
    it("serves catalog previews only on development localhost and refuses unknown SKUs", async () => {
        vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", "");
        const response = await GET(new Request("http://localhost:3010/api/bottle-masters/cylinder9?sku=GBCylAmb9SpryGl"));
        expect(response.status).toBe(200);
        expect((await response.json()).kit).toEqual(library.rows.GBCylAmb9SpryGl);
        expect((await GET(new Request("http://localhost:3010/api/bottle-masters/cylinder9?sku=not-a-sku"))).status).toBe(404);
        expect((await GET(new Request("http://example.com/api/bottle-masters/cylinder9?sku=GBCylAmb9SpryGl"))).status).toBe(404);
        vi.stubEnv("VERCEL", "1");
        expect((await GET(new Request("http://localhost/api/bottle-masters/cylinder9?sku=GBCylAmb9SpryGl"))).status).toBe(404);
        expect(localPdpComponentKits("localhost", "kits", [{ websiteSku: "GBCylAmb9SpryGl" }])).toEqual({});
        vi.stubEnv("VERCEL", ""); vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("BUILDER_LOCAL_KITS", "");
        expect((await GET(new Request("http://localhost/api/bottle-masters/cylinder9?sku=GBCylAmb9SpryGl"))).status).toBe(404);
        expect(localPdpComponentKits("localhost", undefined, [{ websiteSku: "GBCylAmb9SpryGl" }])).toEqual({});
    });
});
