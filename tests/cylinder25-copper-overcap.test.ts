import { describe, expect, it, vi } from "vitest";
import { CYLINDER25_COPPER_OVERCAP, withCylinder25CopperOvercap } from "@/lib/register/cylinder25-copper-overcap";
import { stageLayout, type KitLike } from "@/lib/products/pdp-redesign/stage";
import originals from "../docs/reviews/cylinder25-material-cleanup-2026-11-02/before-copper-kits.json";
import { displayDerivativeUrl } from "@/lib/products/display-derivative";
// The manifest is read on the server; importing the server module registers every source for this test.
import "@/lib/products/display-derivative.server";
vi.mock("server-only", () => ({}));

describe("25 ml copper overcap cleanup", () => {
    for (const sku of ["LBCyl25LtnCu", "GBcyl25SpryCu"] as const) {
        it(`registers visible copper and leaves all other parts unchanged for ${sku}`, () => {
            const before = structuredClone(originals.kits[sku]) as unknown as KitLike;
            before.glassSizing = { heightPct: 46.5, baselinePct: 91, landmarkY: 400.1461496350365 };
            const frozen = JSON.stringify(before);
            const parts = withCylinder25CopperOvercap(before.parts, before.register!.bodyId);
            const old = before.parts.find(p => p.slot === "overcap")!;
            const cap = parts.find(p => p.slot === "overcap")!;
            expect(parts.filter(p => p.slot !== "overcap")).toEqual(before.parts.filter(p => p.slot !== "overcap"));
            expect(cap.image).toEqual(CYLINDER25_COPPER_OVERCAP);
            expect(cap.bounds.right - cap.bounds.left).toBeCloseTo(328 * old.box!.width / old.image.width, 9);
            expect(cap.bounds.bottom).toBeCloseTo(old.box!.y + 635 / old.image.height * old.box!.height, 9);
            expect(cap.box!.width / cap.box!.height).toBeCloseTo(1008 / 1560, 10);
            expect(cap.bounds.top).toBeGreaterThan(old.bounds.top); // Detached white scraps no longer reserve space.
            const after = { ...before, parts };
            for (const view of ["sidecar", "capon", "exploded"] as const) {
                const oldLayout = stageLayout(before, view, { websiteSku: sku });
                const newLayout = stageLayout(after, view, { websiteSku: sku });
                expect(newLayout?.frame).toEqual(oldLayout?.frame);
                expect(newLayout?.parts.find(p => p.slot === "body")).toEqual(oldLayout?.parts.find(p => p.slot === "body"));
            }
            expect(withCylinder25CopperOvercap(parts, before.register!.bodyId)).toEqual(parts);
            expect(JSON.stringify(before)).toBe(frozen);
        });
    }

    it("does not alter another body, component, or a recut source", () => {
        const kit = structuredClone(originals.kits.LBCyl25LtnCu) as unknown as KitLike;
        expect(withCylinder25CopperOvercap(kit.parts, "cylinder-9ml-17-415")).toBe(kit.parts);
        const changed = kit.parts.map(p => p.slot === "overcap" ? { ...p, image: { ...p.image, url: "https://example.test/recut.png" } } : p);
        expect(withCylinder25CopperOvercap(changed, "cylinder-25ml-18-415")).toEqual(changed);
        expect(withCylinder25CopperOvercap(kit.parts.map(p => ({ ...p, componentId: "unknown" })), "cylinder-25ml-18-415"))
            .toEqual(kit.parts.map(p => ({ ...p, componentId: "unknown" })));
    });

    it("delivers lossless display sizes while retaining the source master", () => {
        for (const width of [128, 256, 640, 1200]) expect(displayDerivativeUrl(CYLINDER25_COPPER_OVERCAP.url, width)).toContain("/product-display/v1/" + CYLINDER25_COPPER_OVERCAP.sha256 + "/");
    });
});
