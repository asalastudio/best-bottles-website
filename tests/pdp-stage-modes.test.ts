import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
const configuratorSource = readFileSync(
    resolve(process.cwd(), "src/components/products/ConfiguratorPdp.tsx"),
    "utf8",
);
const productDetailSource = readFileSync(
    resolve(process.cwd(), "src/app/products/[slug]/ProductDetailClient.tsx"),
    "utf8",
);

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

    it("wires Exploded capability to released kit truth rather than decoded presentation state", () => {
        expect(configuratorSource).toContain("const releasedKitAvailable = Boolean(kit?.parts?.length)");
        expect(configuratorSource).toContain("hasReleasedExplodedKit: releasedKitAvailable");
        expect(configuratorSource).not.toContain("hasReleasedExplodedKit: kitReady");
        expect(configuratorSource).not.toContain("api.productKits.forSku,");
        expect(productDetailSource).toContain("const selectedKitQuery = useQuery(");
        expect(productDetailSource).toContain("hasReleasedKit: Boolean(selectedKitQuery?.parts?.length)");
        expect(productDetailSource).toContain("kitQuery={selectedKitQuery}");
    });

    it("accepts approved 3D availability as a field from the focused rollout gate", () => {
        expect(configuratorSource).toContain("hasApproved3d = false");
        expect(configuratorSource).toContain("const has3d = hasApproved3d && Boolean(fam) && !fam?.photoOnly");
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

    it("uses pressed-button semantics for independently selectable stage views", () => {
        const html = renderToStaticMarkup(createElement(PdpStageModeDock, {
            modes: getPdpStageModes({ hasApprovedImageOrPlate: true, hasApprovedGeometry: true }),
            activeMode: "photo",
            onModeChange: vi.fn(),
        }));

        expect(html).not.toContain('role="tablist"');
        expect(html).not.toContain('role="tab"');
        expect(html).toContain('aria-pressed="true"');
        expect(html).toContain('aria-pressed="false"');
        expect(html).toContain("min-h-11");
        expect(html).toContain("motion-reduce:transition-none");
    });

    it("preserves the active mode across an in-intent variant change while it remains available", () => {
        const before: PdpStageMode = "3d";
        const nextModes = getPdpStageModes({ hasApprovedImageOrPlate: true, hasApprovedGeometry: true });
        expect(preservePdpStageMode(before, nextModes)).toBe("3d");
    });

    it("does not normalize Exploded away while released kit images are still decoding", () => {
        expect(configuratorSource).toContain("requestedStageMode === \"exploded\" && releasedKitAvailable");
        expect(configuratorSource).not.toMatch(/preservePdpStageMode\(requestedStageMode, modes\)[\s\S]{0,400}\[requestedStageMode, has3d, kitReady/);
    });

    it("falls back to Photo, then the first supported mode, when the active capability disappears", () => {
        expect(preservePdpStageMode("3d", getPdpStageModes({ hasApprovedImageOrPlate: true }))).toBe("photo");
        expect(preservePdpStageMode("3d", getPdpStageModes({ hasReleasedExplodedKit: true }))).toBe("exploded");
    });
});
