import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readFileSync } from "node:fs";
import { elegant60100ReviewSku, ELEGANT60_100_MASTER_REVIEW_VERSION } from "../src/lib/products/elegant60-100-master";
import { cylinderMasterSource } from "../src/lib/products/cylinder-master";
import { localPdpComponentKits, readLocalComponentKits } from "../src/lib/paper-doll/local-component-kits";

const review = JSON.parse(readFileSync("public/local-kits/elegant60-100-masters-2026-11-03/kits.json", "utf8"));
const entries = Object.entries(review.rows) as Array<[string, any]>;
const part = (kit: any, slot: string) => kit.parts.find((p: any) => p.slot === slot);
afterEach(() => vi.unstubAllEnvs());
describe("60 ml and 100 ml Elegant local masters", () => {
    it("draws one body per size and glass across the product page, builder and catalog", () => {
        vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", "");
        expect(review.version).toBe(ELEGANT60_100_MASTER_REVIEW_VERSION);
        expect(entries.length).toBe(182);
        const builder = readLocalComponentKits()!;
        const pdp = localPdpComponentKits("localhost:3010", undefined, entries.map(([websiteSku]) => ({ websiteSku })));
        const bodies = new Map<string, Set<string>>();
        for (const [sku, kit] of entries) {
            const body = part(kit, "body");
            const key = kit.register.plateKey;
            bodies.set(key, (bodies.get(key) ?? new Set()).add(JSON.stringify([body.image.url, body.box])));
            // Neck top on the rim datum, foot on the baseline, centred on the axis.
            expect(body.bounds.top, sku).toBe(kit.register.datum.seatY);
            expect(body.bounds.bottom, sku).toBe(kit.register.datum.baselineY);
            expect((body.bounds.left + body.bounds.right) / 2, sku).toBeCloseTo(kit.register.datum.axisX, 0);
            expect(body.image.url, sku).not.toContain("gpt-r5");
            expect(elegant60100ReviewSku(sku.toLowerCase())).toBe(sku);
            expect(cylinderMasterSource(sku)).toEqual({ family: "elegant60-100", version: review.version });
            expect(builder[sku]).toEqual(kit);
            expect(pdp[sku]).toEqual(kit);
        }
        // The 60 ml clear master is the Sunburst r3 regeneration, not the white-filled candidate.
        expect(part(review.rows.GBElg60SpryCu, "body").image.url).toContain("body-elegant-60ml-18-415-clear.");
        expect(review.rows.GBElg60SpryCu.plateSha256).not.toBe(review.rows.GBElg100SpryCu.plateSha256);
        expect([...bodies.keys()].sort()).toEqual(["elegant-100ml-18-415|Clear", "elegant-100ml-18-415|Frosted", "elegant-60ml-18-415|Clear", "elegant-60ml-18-415|Frosted"]);
        for (const [key, set] of bodies) expect(set.size, key).toBe(1);
    });

    it("sizes every kit by its scaler entry", async () => {
        const scale = JSON.parse(readFileSync("src/lib/register/catalog-scale.generated.json", "utf8"));
        const { pdpReviewedGlassFrame } = await import("../src/lib/products/pdp-stage-frame");
        for (const [sku, kit] of entries) {
            const target = scale[kit.register.bodyId];
            expect(kit.glassSizing, sku).toMatchObject({ heightPct: target.targetPct, baselinePct: target.baselinePct });
            const body = part(kit, "body");
            const frame = pdpReviewedGlassFrame(body.bounds, kit.anchors.axisX, kit.glassSizing, kit.canvas.width, kit.canvas.height)!;
            expect((body.bounds.bottom - kit.glassSizing.landmarkY) * frame.scale / kit.canvas.height * 100).toBeCloseTo(target.targetPct, 6);
            expect(frame.y + body.bounds.bottom * frame.scale / kit.canvas.height * 100).toBeCloseTo(target.baselinePct, 6);
        }
    });

    it("draws the PSD dip tube of each size and fitment, one image per pair, multiplying into the glass", () => {
        const tubes = JSON.parse(readFileSync("public/local-kits/elegant60-100-masters-2026-11-03/tubes/tubes.json", "utf8"));
        const urls = new Map<string, Set<string>>();
        for (const [sku, kit] of entries) {
            const fitment = kit.parts.find((p: any) => ["sprayer", "pump"].includes(p.slot));
            const parts = kit.parts.filter((p: any) => p.slot === "diptube");
            if (!fitment) { expect(parts, sku).toHaveLength(0); continue; }
            expect(parts, sku).toHaveLength(1);
            const [tube] = parts;
            const kind = tube.derivation.replace("psd-tube:", "");
            expect(kind, sku).toBe(fitment.slot === "pump" ? "lotion" : /AnSp/.test(sku) ? "atomizer" : "spray");
            const key = `${kit.register.bodyId.split("-")[1].replace("ml", "")}-${kind}`;
            urls.set(key, (urls.get(key) ?? new Set()).add(tube.image.url));
            // Placed by the PSD's own geometry: fractions of the neck-top-to-foot height from the neck top and axis.
            const { axisX, seatY, baselineY } = kit.register.datum, H = baselineY - seatY;
            expect(tube.box.x, sku).toBeCloseTo(axisX + tubes[key].left * H, 2);
            expect(tube.box.y, sku).toBeCloseTo(seatY + tubes[key].top * H, 2);
            expect(tube.box.height, sku).toBeCloseTo(tubes[key].height * H, 2);
            expect(tube.box.width / tube.box.height, sku).toBeCloseTo(tube.image.width / tube.image.height, 2);
            expect(tube.blendMode, sku).toBe("multiply");
            expect(tube.explodeIndex, sku).toBe(fitment.explodeIndex);
            // EXPLODED groups a head and its tube by component: one unit, the tube hanging from the pump.
            expect(tube.componentId ?? null, sku).toBe(fitment.componentId ?? null);
            expect(tube.views, sku).toEqual(kit.register.glass === "Frosted" ? ["exploded"] : undefined);
        }
        expect([...urls.keys()].sort()).toEqual(["100-atomizer", "100-lotion", "100-spray", "60-atomizer", "60-lotion", "60-spray"]);
        for (const [key, set] of urls) expect(set.size, key).toBe(1);
    });

    it("builds the four white treatment pumps with clear overcap from their PSDs", () => {
        for (const [sku, template] of [["LBElg60WhtClOvrCp", "LBElg60LtnClrOvrCap"], ["LBElgFrst60WhtClOvrCp", "LBElgFrst60LtnClOvrCap"],
            ["LBElg100WhtClOvrCp", "LBElg100LtnClOvrCap"], ["LBElgFrst100WhtClOvrCp", "LBElgFrst100LtnClOvrCap"]]) {
            const kit = review.rows[sku], base = review.rows[template];
            expect(kit.source.template, sku).toBe(template);
            expect(part(kit, "body"), sku).toEqual(part(base, "body"));
            expect(kit.glassSizing, sku).toEqual(base.glassSizing);
            for (const slot of ["pump"]) {
                expect(part(kit, slot).image.url, `${sku} ${slot}`).toContain("/white-lotion/");
                expect(part(kit, slot).source, `${sku} ${slot}`).toContain("WhtClOvrCp.psd");
            }
            expect(part(kit, "diptube").derivation, sku).toBe("psd-tube:lotion");
            // Seated and parked, the overcap is its own empty square cover: the cap-on photograph over the
            // pump layer printed the pump twice, and the template's round cover is another component.
            expect(part(kit, "overcap").image.url, sku).toContain("/white-lotion/cover-empty-");
            expect(part(kit, "overcap").detached.image.url, sku).toBe(part(kit, "overcap").image.url);
            expect(part(kit, "overcap").blendMode ?? null, sku).toBe(null);
            expect(review.defaultPdpSkus).toContain(sku);
            expect(elegant60100ReviewSku(sku)).toBe(sku);
        }
    });

    it("gives every reducer kit its reducer, so cap off and exploded are offered", async () => {
        const { availableViews } = await import("../src/lib/products/pdp-redesign/stage");
        const reducers = entries.filter(([sku]) => sku.includes("Rdcr"));
        expect(reducers).toHaveLength(48);
        for (const [sku, kit] of reducers) {
            const parts = kit.parts.filter((p: any) => p.slot === "reducer");
            expect(parts.map((p: any) => p.views), sku).toEqual([["sidecar", "capon"], ["exploded"]]);
            expect(availableViews(kit, { family: "Elegant", applicator: "Reducer", websiteSku: sku } as any), sku).toEqual(expect.arrayContaining(["sidecar", "capon", "exploded"]));
        }
    });

    it("keeps every tassel assembly on the stage, the 60 ml tassels drawn from their own PSDs", async () => {
        const { pdpReviewedGlassFrame } = await import("../src/lib/products/pdp-stage-frame");
        const tassels = entries.filter(([sku]) => sku.includes("AnSpTsl"));
        expect(tassels).toHaveLength(36);
        for (const [sku, kit] of tassels) {
            const sprayer = part(kit, "sprayer"), body = part(kit, "body");
            if (sku.includes("60")) expect(sprayer.source, sku).toMatch(/GBElg60AnSpTsl\w+\.psd/);
            expect(kit.glassSizing.axisPct, sku).toBeGreaterThan(50);
            const frame = pdpReviewedGlassFrame(body.bounds, kit.anchors.axisX, kit.glassSizing, kit.canvas.width, kit.canvas.height)!;
            const pct = (x: number) => frame.x + x * frame.scale / kit.canvas.width * 100;
            expect(pct(sprayer.box.x), sku).toBeGreaterThan(-1);          // the box's transparent margin may graze the edge
            expect(pct(body.bounds.right), sku).toBeLessThanOrEqual(97.01);
            // On the floor, not hanging below the glass's foot (a tassel lying in front of the glass sits a
            // little lower in the picture, as in its PSD: up to 2.5 mm).
            expect(sprayer.box.y + sprayer.box.height, sku).toBeLessThan(kit.anchors.baselineY + 2.5 * kit.anchors.pxPerMm);
        }
        for (const [sku, kit] of entries.filter(([sku]) => !sku.includes("AnSpTsl"))) expect(kit.glassSizing.axisPct, sku).toBeUndefined();
    });

    it("lifts the complete 18-415 dropper in EXPLODED, its frosted pipette hidden while seated", async () => {
        const { availableViews, stageLayout } = await import("../src/lib/products/pdp-redesign/stage");
        const droppers = entries.filter(([sku]) => /Drp/.test(sku));
        expect(droppers).toHaveLength(6);
        for (const [sku, kit] of droppers) {
            const ctx = { websiteSku: sku, applicator: "Dropper", family: "Elegant" } as any;
            expect(availableViews(kit, ctx), sku).toEqual(["capon", "exploded"]);
            const whole = kit.parts.filter((p: any) => p.slot === "fitment" && p.views?.[0] === "exploded");
            expect(whole, sku).toHaveLength(2);                                   // bulb and collar, and the multiplied pipette
            for (const p of whole) expect(p.source, sku).toMatch(/29\. 18-415 Droppers\/Drp18-415(Cu|Gl|Sl)\.psd/);
            const seated = stageLayout(kit, "capon", ctx)!.parts.map((p: any) => p.url);
            for (const p of whole) expect(seated, sku).not.toContain(p.image.url);
            const exploded = stageLayout(kit, "exploded", ctx)!.parts.filter((p: any) => p.slot === "fitment");
            expect(exploded, sku).toHaveLength(2);
            expect(exploded[0].dyPct, sku).toBe(exploded[1].dyPct);              // one unit
            expect(exploded[0].dxPct, sku).toBe(exploded[1].dxPct);
            // Every finish the same size: one stage scale for the one physical dropper.
            const width = (sku: string) => review.rows[sku].parts.find((p: any) => p.slot === "fitment" && p.views?.[0] === "exploded").box.height;
            expect(Math.abs(width(sku) - width("GBElg60DrpSl")), sku).toBeLessThan(4);
            if (kit.register.glass === "Frosted") expect(part(kit, "pipette").zOrder, sku).toBeLessThan(part(kit, "body").zOrder);
        }
    });

    it("gives every bulb and tassel kit a close-up swatch, matched by colour, also on the catalog dots", async () => {
        const map = JSON.parse(readFileSync("src/lib/products/local-cap-close-ups.json", "utf8"));
        const bulbs = entries.filter(([sku]) => /AnSp/.test(sku));
        expect(bulbs).toHaveLength(72);
        for (const [sku, kit] of bulbs) {
            const [, kind, colour] = sku.match(/(AnSpTsl|AnSp)(\w+)$/)!;
            expect(kit.capCloseUp.url, sku).toMatch(new RegExp(`/caps/${kind}-${colour}-[0-9a-f]{12}\\.png$`));
            expect(map[sku], sku).toBe(kit.capCloseUp.url);
        }
        for (const [sku, kit] of entries.filter(([sku]) => !/AnSp/.test(sku))) expect(kit.capCloseUp, sku).toBeUndefined();
    });

    it("rests every closure on its glass's rounded shoulder, where the glass is as wide as its collar", () => {
        let seated = 0;
        for (const [sku, kit] of entries) {
            const head = kit.parts.find((p: any) => ["sprayer", "pump"].includes(p.slot));
            for (const p of kit.parts.filter((p: any) => ["sprayer", "pump", "fitment", "overcap", "cap"].includes(p.slot))) {
                // An overcap travels with its head, keeping the register's registration of the head inside it.
                if (p.slot === "overcap" && head) { expect(p.seatWith, sku).toBe(head.slot); continue; }
                if (p.views?.length === 1 && p.views[0] === "exploded") continue;   // the complete dropper, lifted only
                expect(p.seatBottomY - kit.glassShoulderY, `${sku} ${p.slot}`).toBeGreaterThanOrEqual(1);
                expect(p.seatBottomY - kit.glassShoulderY, `${sku} ${p.slot}`).toBeLessThanOrEqual(6);
                seated++;
            }
        }
        expect(seated).toBeGreaterThan(150);
    });
});
