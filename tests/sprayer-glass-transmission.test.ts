import { describe, expect, it } from "vitest";
import manifest from "@/lib/paper-doll/approved-kits.generated.json";
import { stageLayout, type KitLike } from "@/lib/products/pdp-redesign/stage";
import { sprayerPlugMask } from "@/lib/products/sprayer-glass-transmission";

const rows = Object.values(manifest.rows) as unknown as KitLike[];
const affected = rows.filter(kit => ["tulip-6ml-13-415", "sleek-8ml-13-415"].includes(kit.register?.bodyId ?? "")
    && kit.register?.glass === "Clear" && kit.parts.some(part => part.slot === "sprayer"));

describe("clear sprayer plug transmission", () => {
    it("softens only the seated chamber for all fifteen finishes and keeps the natural exploded part", () => {
        expect(affected).toHaveLength(15);
        for (const kit of affected) {
            const before = structuredClone(kit);
            for (const view of ["sidecar", "capon", "exploded"] as const) {
                const layout = stageLayout(kit, view, { websiteSku: kit.sku })!;
                const tube = layout.parts.find(part => part.slot === "diptube")!;
                const source = kit.parts.find(part => part.slot === "diptube" && part.views?.includes(view))!;
                expect(tube.url).toBe(source.image.url);
                if (view === "exploded") {
                    expect(tube.maskImage).toBeUndefined();
                    expect(tube.opacity).toBeUndefined();
                    expect(tube.blendMode).toBeUndefined();
                } else {
                    expect(tube.maskImage, kit.sku).toContain("linear-gradient");
                    expect(tube.maskImage).toMatch(/black [\d.]+%, black 100%\)$/);
                    expect(tube.opacity).toBe(0.4);
                    expect(layout.parts.findIndex(part => part.slot === "diptube"))
                        .toBeLessThan(layout.parts.findIndex(part => part.slot === "body"));
                }
            }
            expect(kit).toEqual(before);
        }
    });

    it("leaves other bodies, amber, frosted, lotion mechanisms and all external hardware unchanged", () => {
        let count = 0;
        for (const kit of rows) for (const part of kit.parts) {
            if (sprayerPlugMask(kit, part, "capon")) {
                count++;
                expect(affected).toContain(kit);
                expect(part.slot).toBe("diptube");
                expect(part.views).toEqual(["sidecar", "capon"]);
            }
        }
        expect(count).toBe(15);
        const kit = affected[0], part = kit.parts.find(part => part.slot === "diptube")!;
        for (const glass of ["Amber", "Frosted", "Cobalt Blue"]) {
            expect(sprayerPlugMask({ ...kit, register: { ...kit.register!, glass } }, part, "capon")).toBeUndefined();
        }
        expect(sprayerPlugMask(kit, { ...part, image: { ...part.image, url: "/new-unreviewed-tube.png" } }, "capon")).toBeUndefined();
    });
});
