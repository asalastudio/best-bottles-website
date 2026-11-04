import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { BuilderKit } from "@/lib/bottle-builder/model";
import { isBuilderCandidate, type CatalogRow } from "@/lib/bottle-builder/model";
import { stageLayout } from "@/lib/products/pdp-redesign/stage";
import manifest from "@/lib/paper-doll/approved-kits.generated.json";
import index from "@/lib/paper-doll/approved-kit-index.json";
import { cylinderMasterSource } from "@/lib/products/cylinder-master";
vi.mock("server-only", () => ({}));
import { GET } from "@/app/api/bottle-masters/approved/route";
const source = JSON.parse(readFileSync("public/local-kits/small-sprayers-2026-10-31/kits.json", "utf8")).rows as Record<string, BuilderKit>;
const hosted = manifest.rows as unknown as Record<string, BuilderKit>;

describe("approved 3.3/4 ml sprayer publication", () => {
    it("pins all seven source layers to verified public hashes, including detached caps", () => {
        const receipt = JSON.parse(readFileSync("docs/reviews/hosted-small-sprayers-2026-11-01/asset-receipt.json", "utf8")) as Record<string, { file: string; sha256: string; bytes: number; url: string; verified: boolean }>;
        expect(Object.keys(receipt)).toHaveLength(7);
        for (const asset of Object.values(receipt)) {
            const bytes = readFileSync(asset.file);
            expect(bytes.length).toBe(asset.bytes);
            expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
            expect(asset.url).toContain(asset.sha256);
            expect(asset.verified).toBe(true);
        }
        for (const sku of Object.keys(source)) {
            for (const part of hosted[sku].parts) {
                expect(part.image.url).toBe(receipt[source[sku].parts.find(p => p.slot === part.slot)!.image.url].url);
                if (part.detached) expect(part.detached.image.url).toBe(part.image.url);
            }
        }
    });
    it("keeps small sprays excluded from the standalone builder", () => {
        for (const capacityMl of [3.3, 4]) expect(isBuilderCandidate({ family: "Cylinder", capacityMl } as CatalogRow)).toBe(false);
    });
    it("includes both finishes of both sizes in the hosted release", async () => {
        expect(Object.keys(source).sort()).toEqual(["GBSpry3mlClBlk", "GBSpry3mlClWht", "GBSpry4mlClBlk", "GBSpry4mlClWh"].sort());
        expect(Object.keys(hosted)).toHaveLength(1037);   // 463 + the 196 Elegant masters (2026-11-03) + 12 Vial masters (2026-11-04) + 179 Diva masters (2026-11-04) + 7 Pillar sprayers (2026-11-04) + 177 Empire/Grace/Diamond + 3 Pillar caps/rollers (2026-11-04)
        expect(index.skus).toEqual(Object.keys(hosted).sort());
        for (const sku of Object.keys(source)) {
            const response = await GET(new Request(`https://preview.vercel.app/api/bottle-masters/approved?sku=${sku}&v=${index.version}`));
            expect(response.status, sku).toBe(200);
            expect((await response.json()).kit).toEqual(hosted[sku]);
            expect(cylinderMasterSource(sku)).toEqual({ family: "approved", version: index.version });
        }
    });
    it("keeps corrected glass, tube length, shoulder seating and scale identical in every view", () => {
        for (const [sku, original] of Object.entries(source)) {
            const kit = hosted[sku];
            expect(kit, sku).toBeDefined();
            const restored = structuredClone(kit);
            restored.parts.forEach((part, i) => {
                part.image = original.parts[i].image;
                if (part.detached && original.parts[i].detached) part.detached.image = original.parts[i].detached!.image;
            });
            expect(restored).toEqual(original);
            expect(kit.parts.every(part => part.image.url.startsWith("https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/reviewed-master-media/"))).toBe(true);
            for (const view of ["sidecar", "capon", "exploded"] as const) {
                const before = stageLayout(original, view, { websiteSku: sku })!;
                const after = stageLayout(kit, view, { websiteSku: sku })!;
                const geometry = (part: typeof after.parts[number]) => ({ slot: part.slot, box: part.box, dxPct: part.dxPct, dyPct: part.dyPct });
                expect(after.parts.map(geometry)).toEqual(before.parts.map(geometry));
                expect(after.parts.filter(part => part.slot === "diptube")).toHaveLength(1);
                expect(after.parts.filter(part => part.slot === "overcap")).toHaveLength(1);
            }
        }
    });
});
