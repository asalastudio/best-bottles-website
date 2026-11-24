import { describe, expect, it, vi } from "vitest";
import seated from "@/lib/paper-doll/seated-dip-tubes.generated.json";
import { stageLayout } from "@/lib/products/pdp-redesign/stage";
import { assembledKit, partBoxTransform, type RegisterKit } from "@/lib/register/stage-kit";
vi.mock("server-only", () => ({}));
import { approvedComponentKit, approvedComponentKits } from "@/lib/paper-doll/approved-component-kits";

const groups = seated.groups as Record<string, { bodyId: string; glass: string; kind: string; sourcePxPerMm: number; seated: { url: string; width: number; height: number } }>;
const skus = seated.skus as Record<string, { group: string; dy: number }>;
const internal = (kind: string) => kind === "pipette" ? "pipette" : "diptube";
const holderSlot = (kind: string) => ({ spray: "sprayer", bulb: "sprayer", lotion: "pump", pipette: "fitment" })[kind]!;

describe("real dip tubes and pipettes in the capped glass (24 Nov 2026 parts audit)", () => {
    it("covers every confirmed family", () => {
        const kits = approvedComponentKits();
        const count = (pattern: RegExp) => Object.keys(skus).filter(sku => pattern.test(kits[sku]?.register?.bodyId ?? "")).length;
        // Finding 1 (220 clear sprayers and pumps), finding 2 (6 droppers), finding 3 (Sleek 50/100 sprayers, 18 with tassels).
        expect(Object.keys(skus).filter(sku => groups[skus[sku].group].glass === "Clear"
            && /^(diva|empire|diamond|grace)-/.test(groups[skus[sku].group].bodyId) && groups[skus[sku].group].kind !== "pipette")).toHaveLength(220);
        expect(Object.keys(skus).filter(sku => groups[skus[sku].group].kind === "pipette").sort())
            .toEqual(["GBDiva46DrpCu", "GBDiva46DrpGl", "GBDiva46DrpSl", "GBEmp50DrpCu", "GBEmp50DrpGl", "GBEmp50DrpSl"]);
        expect(Object.keys(skus).filter(sku => /^GBSlk(?:50|100)AnSpTsl/.test(sku))).toHaveLength(18);
        for (const body of ["diva-30ml", "diva-46ml", "diva-100ml", "empire-50ml", "empire-100ml", "diamond-60ml", "grace-55ml", "sleek-50ml", "sleek-100ml"]) {
            expect(count(new RegExp(`^${body}-18-415$`)), body).toBeGreaterThan(0);
        }
    });

    it("draws exactly one photographed tube or pipette in CAP ON and SIDECAR, inside the glass and under its head", () => {
        for (const [sku, entry] of Object.entries(skus)) {
            const group = groups[entry.group];
            const kit = approvedComponentKit(sku)!;
            const slot = internal(group.kind);
            const body = kit.parts.find(part => part.slot === "body")!;
            const holder = kit.parts.find(part => part.slot === holderSlot(group.kind) && (!part.views || part.views.includes("capon")))!;
            const mm = kit.anchors.pxPerMm!;
            for (const view of ["capon", "sidecar"] as const) {
                const drawn = stageLayout(kit, view, { websiteSku: sku })!.parts.filter(part => part.slot === slot);
                expect(drawn, `${sku} ${view}`).toHaveLength(1);
                expect(drawn[0].url, sku).toBe(group.seated.url);
            }
            const tube = kit.parts.find(part => part.slot === slot && part.views?.includes("capon"))!;
            // Undistorted: the box keeps the photographed tube's proportions.
            expect(tube.box!.width / tube.box!.height, sku).toBeCloseTo(tube.image.width / tube.image.height, 2);
            // Sane proportions: drawn at physical size (the PSD's px/mm over the kit's), never widened or thinned,
            // reaching well into the glass.
            expect(tube.box!.width / tube.image.width, sku).toBeCloseTo(mm / group.sourcePxPerMm, 3);
            expect((tube.bounds.right - tube.bounds.left) / mm, sku).toBeLessThan(slot === "pipette" ? 11 : 9);
            const glassHeight = body.bounds.bottom - body.bounds.top;
            expect((tube.bounds.bottom - body.bounds.top) / glassHeight, sku).toBeGreaterThan(slot === "pipette" ? 0.6 : 0.7);
            expect(tube.bounds.bottom, sku).toBeLessThan(kit.anchors.baselineY - 10);
            expect(tube.bounds.left, sku).toBeGreaterThan(body.bounds.left);
            expect(tube.bounds.right, sku).toBeLessThan(body.bounds.right);
            // It starts inside its sprayer, pump or dropper (no glass between them) and is drawn under it, over the glass.
            expect(tube.bounds.top, sku).toBeLessThanOrEqual(holder.bounds.bottom + 1);
            expect(tube.zOrder, sku).toBeGreaterThan(body.zOrder);
            expect(tube.zOrder, sku).toBeLessThan(holder.zOrder);
            expect(tube.image.url, sku).toMatch(/^\/images\/approved-masters\/dip-tube-/);
        }
    });

    it("treats each glass: clear as photographed, frosted at 30 %, fluted Diva and Diamond in slivers", () => {
        for (const [sku, entry] of Object.entries(skus)) {
            const group = groups[entry.group];
            const tube = approvedComponentKit(sku)!.parts.find(part => part.slot === internal(group.kind) && part.views?.includes("capon"))!;
            expect(tube.opacity ?? 1, sku).toBe(group.glass === "Frosted" ? 0.3 : 0.9);
            const fluted = group.glass === "Clear" && /^(diva|diamond)-/.test(group.bodyId);
            expect(tube.image.url.includes("-slivers."), sku).toBe(fluted);
        }
    });

    it("lifts the same tube, whole, with its head in EXPLODED; a dropper keeps its complete dropper", () => {
        for (const [sku, entry] of Object.entries(skus)) {
            const group = groups[entry.group];
            const kit = approvedComponentKit(sku)!;
            if (group.kind === "pipette") {
                expect(kit.parts.filter(part => part.slot === "fitment" && part.views?.length === 1 && part.views[0] === "exploded").length, sku).toBeGreaterThan(0);
                continue;
            }
            const exploded = stageLayout(kit, "exploded", { websiteSku: sku })!.parts.filter(part => part.slot === "diptube");
            expect(exploded, sku).toHaveLength(1);
            expect(exploded[0].url, sku).not.toContain("-slivers.");
            const tube = kit.parts.find(part => part.slot === "diptube" && part.views?.includes("exploded"))!;
            const head = kit.parts.find(part => part.slot === holderSlot(group.kind) && (!part.views || part.views.includes("exploded")))!;
            expect(tube.explodeIndex, sku).toBe(head.explodeIndex);
            expect(tube.componentId, sku).toBe(head.componentId);
        }
    });

    it("Build Your Bottle draws the seated tube with the assembled bottle", () => {
        for (const sku of ["GBDiva46SpryMtGl", "LBEmp100LtnMtGl", "GBDmnd2ozAnSpBlk", "GBGrce55AnSpTslBlk", "GBDiva46DrpCu", "GBSlk50AnSpTslBlk"]) {
            const kit = assembledKit(approvedComponentKit(sku)! as unknown as RegisterKit);
            const tubes = kit.parts.filter(part => part.slot === "diptube" || part.slot === "pipette");
            expect(tubes, sku).toHaveLength(1);
            expect((tubes[0] as unknown as { image: { url: string } }).image.url, sku).toMatch(/^\/images\/approved-masters\/dip-tube-/);
        }
    });

    it("the Sleek tassel sprayers draw a full tube, as long as their plain bulb twins", () => {
        for (const size of ["50", "100"]) for (const colour of ["Blk", "Gl", "IvyGl", "IvySl", "Lvn", "MtSl", "Pnk", "Red", "Wht"]) {
            const length = (sku: string) => {
                const tube = approvedComponentKit(sku)!.parts.find(part => part.slot === "diptube" && part.views?.includes("capon"))!;
                return tube.bounds.bottom - tube.bounds.top;
            };
            const tassel = length(`GBSlk${size}AnSpTsl${colour}`);
            expect(tassel, `${size} ${colour}`).toBeGreaterThan(500);
            expect(Math.abs(tassel - length(`GBSlk${size}AnSp${colour}`)), `${size} ${colour}`).toBeLessThan(8);
        }
    });
});

describe("Build Your Bottle draws a boxed part inside its box (Sleek 50 ml tube through the foot)", () => {
    it("stretches a part whose box has other proportions than its image, as the product page does", () => {
        const part = { box: { x: 480, y: 360, width: 33, height: 590 }, image: { width: 53, height: 1415 } };
        expect(partBoxTransform(part)).toBe(`translate(480 360) scale(${33 / 53} ${590 / 1415})`);
        const proportional = { box: { x: 10, y: 20, width: 50, height: 100 }, image: { width: 100, height: 200 } };
        expect(partBoxTransform(proportional)).toBe("translate(10 20) scale(0.5)");
    });
});

describe("Elegant 30 ml clear sprayers seat on the shoulder", () => {
    it("records the seat where the sprayer stands, like the frosted sprayers and the caps", () => {
        for (const sku of ["GBElg30SpryBlk", "GBElg30SpryMattGl", "GBElg30SpryMattSl", "GBElg30SpryShGl", "GBElg30SpryShnSl"]) {
            const kit = approvedComponentKit(sku)!;
            const sprayer = kit.parts.find(part => part.slot === "sprayer")!;
            expect(kit.anchors.seatY, sku).toBe(sprayer.bounds.bottom);
            expect(kit.anchors.seatY, sku).toBeLessThan(500);
        }
    });
});
