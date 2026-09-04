import { describe, expect, it } from "vitest";
import { resolveFocusedPdpCapabilities } from "../src/lib/products/focused-pdp-rollout";

describe("focused PDP rollout capabilities", () => {
    it("treats the 9 mL clear Cylinder 17-415 Roll-On as an acceptance fixture, not an eligibility allowlist", () => {
        expect(resolveFocusedPdpCapabilities({
            hasVariants: true,
            hasApprovedPhoto: true,
            hasPlate: false,
            hasApproved3d: true,
            hasReleasedKit: true,
            hasDimensions: true,
        })).toMatchObject({
            canRenderFocusedShell: true,
            isPurchasable: true,
            hasPhotoMode: true,
            has3dMode: true,
            hasExplodedMode: true,
            hasDimensionsMode: true,
            requiresFinderContext: false,
        });
    });

    it("activates the shared shell for any real group with an approved photo or plate", () => {
        expect(resolveFocusedPdpCapabilities({
            hasVariants: true,
            hasApprovedPhoto: false,
            hasPlate: true,
            hasApproved3d: false,
            hasReleasedKit: false,
            hasDimensions: false,
        })).toMatchObject({
            canRenderFocusedShell: true,
            isPurchasable: true,
            hasPhotoMode: true,
            has3dMode: false,
            hasExplodedMode: false,
        });
    });

    it("keeps photo-backed groups in the focused shell when optional 3D and kit media are absent", () => {
        expect(resolveFocusedPdpCapabilities({
            hasVariants: true,
            hasApprovedPhoto: true,
            hasPlate: false,
            hasApproved3d: false,
            hasReleasedKit: false,
            hasDimensions: false,
        })).toMatchObject({
            canRenderFocusedShell: true,
            isPurchasable: true,
            hasPhotoMode: true,
            has3dMode: false,
            hasExplodedMode: false,
            hasDimensionsMode: false,
        });
    });

    it("does not hide a real purchasable group only because all optional media is incomplete", () => {
        expect(resolveFocusedPdpCapabilities({
            hasVariants: true,
            hasApprovedPhoto: false,
            hasPlate: false,
            hasApproved3d: false,
            hasReleasedKit: false,
            hasDimensions: false,
        })).toMatchObject({
            canRenderFocusedShell: false,
            isPurchasable: true,
            requiresFinderContext: false,
        });
    });

    it("leaves invalid or empty groups non-purchasable", () => {
        expect(resolveFocusedPdpCapabilities({
            hasVariants: false,
            hasApprovedPhoto: true,
            hasPlate: true,
            hasApproved3d: true,
            hasReleasedKit: true,
            hasDimensions: true,
        })).toMatchObject({
            canRenderFocusedShell: false,
            isPurchasable: false,
        });
    });
});
