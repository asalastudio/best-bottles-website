import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { approvedComponentKit, originalApprovedComponentKit } from "@/lib/paper-doll/approved-component-kits";
import { updatedCylinderKitVersion } from "@/lib/paper-doll/approved-kit-index";
import { stageLayout } from "@/lib/products/pdp-redesign/stage";

describe("9 ml lotion physical-reference review", () => {
    it("updates the actuator and tube for each available color while preserving collar and cover", () => {
        for (const sku of ["LBCyl9LtnBlk", "LBCylAmb9LtnBlk", "LBCylBlu9LtnBlk", "LBCylFrst9LtnBlk", "LBCylSwrl9LtnBlk"]) {
            const kit = approvedComponentKit(sku)!;
            const prior = originalApprovedComponentKit(sku)!;
            expect(updatedCylinderKitVersion(sku)).toContain("lotion9-physical-reference");
            expect(kit.parts.find(part => part.slot === "pump")!.image.url).toContain("lotion9-actuator-");
            expect(kit.parts.find(part => part.slot === "collar")!.image.url).toBe(prior.parts.find(part => part.slot === "collar")!.image.url);
            expect(kit.parts.find(part => part.slot === "overcap")!.image.url).toBe(prior.parts.find(part => part.slot === "overcap")!.image.url);
            for (const view of ["sidecar", "capon", "exploded"] as const) {
                const parts = stageLayout(kit, view, { websiteSku: sku, applicator: "Lotion Pump" })!.parts;
                expect(parts.find(part => part.slot === "pump")!.url).toContain("lotion9-actuator-");
                if (view === "exploded" || sku === "LBCyl9LtnBlk") expect(parts.find(part => part.slot === "diptube")!.url).toContain("lotion9-mechanism-");
            }
        }
    });
});
