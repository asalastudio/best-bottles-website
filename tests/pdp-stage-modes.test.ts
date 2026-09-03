import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PdpStageModeDock from "../src/components/products/PdpStageModeDock";
import {
    getPdpStageModes,
    hasRealPdpDimensions,
    preservePdpStageMode,
    type PdpStageMode,
} from "../src/lib/products/pdp-stage-modes";

const modeIds = (input: Parameters<typeof getPdpStageModes>[0]) =>
    getPdpStageModes(input).map((mode) => mode.id);

describe("PDP stage mode capabilities", () => {
    it("offers Photo only when an approved image or plate exists", () => {
        expect(modeIds({ hasApprovedImageOrPlate: false })).not.toContain("photo");
        expect(modeIds({ hasApprovedImageOrPlate: true })).toContain("photo");
    });

    it("offers 3D only for approved geometry and never for photo-only or Diva groups", () => {
        expect(modeIds({ hasApprovedGeometry: true })).toContain("3d");
        expect(modeIds({ hasApprovedGeometry: true, photoOnly: true })).not.toContain("3d");
        expect(modeIds({ hasApprovedGeometry: true, productFamily: "Diva" })).not.toContain("3d");
    });

    it("offers Exploded only for a released kit", () => {
        expect(modeIds({ hasReleasedExplodedKit: false })).not.toContain("exploded");
        expect(modeIds({ hasReleasedExplodedKit: true })).toContain("exploded");
    });

    it("offers Dimensions only when at least one real dimension field is present", () => {
        expect(hasRealPdpDimensions({ heightWithCap: " ", heightWithoutCap: null, diameter: undefined })).toBe(false);
        expect(hasRealPdpDimensions({ heightWithCap: null, heightWithoutCap: "74 mm", diameter: null })).toBe(true);
        expect(modeIds({ dimensions: { heightWithCap: "87 mm", diameter: "21 mm" } })).toContain("dimensions");
    });

    it("omits unsupported modes from the dock instead of rendering disabled placeholders", () => {
        const html = renderToStaticMarkup(createElement(PdpStageModeDock, {
            modes: getPdpStageModes({
                hasApprovedImageOrPlate: true,
                dimensions: { diameter: "21 mm" },
            }),
            activeMode: "photo",
            onModeChange: vi.fn(),
        }));

        expect(html).toContain("Photo");
        expect(html).not.toContain("3D");
        expect(html).not.toContain("Exploded");
        expect(html).toContain("Dimensions");
        expect(html).not.toContain("disabled");
    });

    it("preserves the active mode across an in-intent variant change while it remains available", () => {
        const before: PdpStageMode = "3d";
        const nextModes = getPdpStageModes({ hasApprovedImageOrPlate: true, hasApprovedGeometry: true });
        expect(preservePdpStageMode(before, nextModes)).toBe("3d");
    });

    it("falls back to Photo, then the first supported mode, when the active capability disappears", () => {
        expect(preservePdpStageMode("3d", getPdpStageModes({ hasApprovedImageOrPlate: true }))).toBe("photo");
        expect(preservePdpStageMode("3d", getPdpStageModes({ hasReleasedExplodedKit: true }))).toBe("exploded");
    });
});
