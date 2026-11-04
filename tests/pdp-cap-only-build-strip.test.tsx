import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PdpBuildStrip } from "../src/components/pdp/PdpSections";
import type { KitLike } from "../src/lib/products/pdp-redesign/stage";

vi.mock("../src/components/pdp/PdpStage", () => ({ useIsPdpMobile: () => false }));
vi.mock("../src/components/LocaleLink", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => createElement("a", { href }, children) }));

describe("cap-only vial builder introduction", () => {
    it("shows a bottle and its closure without advertising unlisted fitments", () => {
        const part = (slot: string) => ({ slot, bounds: { left: 10, top: 20, right: 60, bottom: 90 },
            image: { url: "/" + slot + ".webp", width: 100, height: 110 },
            assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: 0 }, zOrder: 0, explodeIndex: 0 });
        const kit = { sku: "GBVGreen2o4BlackCapSht", canvas: { width: 100, height: 110 }, parts: [part("body"), part("cap")] } as unknown as KitLike;
        const html = renderToStaticMarkup(createElement(PdpBuildStrip, { capacityLabel: "3 ml Vial", glassLabel: "Green", neck: "13-425",
            bodyKit: kit, groupKits: [kit], capKits: [kit], href: "/matrix?family=Vial" }));
        expect(html).toContain("Two steps.");
        expect(html).not.toContain('data-testid="pdp-build-fitment"');
        expect(html).toContain('data-testid="pdp-build-cap"');
        expect(html).not.toContain("Roller, spray, dropper or pump");
        expect(html).toContain("1 finish. Every cap shown fits.");
    });
});

describe("jumbo roller builder introduction", () => {
    it("shows two shared roller types for four cap combinations and describes only those fitments", () => {
        const part = (slot: string, name: string) => ({ slot, bounds: { left: 10, top: 20, right: 60, bottom: 90 },
            image: { url: "/" + name + ".webp", width: 100, height: 110 },
            assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: 0 }, zOrder: 0, explodeIndex: 0 });
        const kits = ["metal", "plastic"].flatMap(roller => ["black", "white"].map(cap => ({
            sku: roller + cap, canvas: { width: 100, height: 110 },
            parts: [part("body", "body"), part("roller", roller), part("cap", cap)],
        } as unknown as KitLike)));
        const html = renderToStaticMarkup(createElement(PdpBuildStrip, { capacityLabel: "28 ml Cylinder", glassLabel: "Clear", neck: "16mm",
            bodyKit: kits[0], groupKits: kits, capKits: [kits[0], kits[1]], href: "/matrix?family=Cylinder" }));
        expect(html).toContain("Metal and plastic roller balls");
        expect(html).not.toContain("Roller, spray, dropper or pump");
        expect(html).toContain('data-entry-count="2"');
    });
});

describe("60 ml Elegant dropper builder introduction", () => {
    it.each(["Clear", "Frosted"])("shows complete %s droppers only in step 03", glass => {
        const part = (slot: string, name: string) => ({ slot, bounds: { left: 10, top: 20, right: 60, bottom: 90 },
            image: { url: "/" + name + ".webp", width: 100, height: 110 },
            assembled: { x: 0, y: 0 }, exploded: { dx: 0, dy: 0 }, zOrder: 0, explodeIndex: 0 });
        const kits = ["copper", "gold", "silver"].map(finish => ({
            sku: `GBElg${glass === "Frosted" ? "Frst" : ""}60Drp${finish}`,
            register: { bodyId: "elegant-60ml-18-415" }, canvas: { width: 100, height: 110 },
            parts: [part("body", "body"), part("pipette", "pipette"), part("fitment", finish)],
        } as unknown as KitLike));
        const html = renderToStaticMarkup(createElement(PdpBuildStrip, { capacityLabel: "60 ml Elegant", glassLabel: glass, neck: "18-415",
            bodyKit: kits[0], groupKits: kits, capKits: kits, href: "/matrix?family=Elegant" }));
        const fitment = html.split('data-testid="pdp-build-fitment"')[1].split('data-testid="pdp-build-cap"')[0];
        const cap = html.split('data-testid="pdp-build-cap"')[1];
        expect(fitment).toContain('data-entry-count="0"');
        expect(fitment).not.toContain("Roller, spray, dropper or pump");
        expect(cap).toContain('data-entry-count="3"');
        for (const finish of ["copper", "gold", "silver"]) expect(cap).toContain(finish + ".webp");
    });
});
