import { describe, expect, it, vi } from "vitest";
import { approvedComponentKit, approvedComponentKits, isCylinder28RollOnSku } from "@/lib/paper-doll/approved-component-kits";
import { approvedMasterSku, APPROVED_KIT_VERSION, CYLINDER28_KIT_VERSION, updatedCylinderKitVersion } from "@/lib/paper-doll/approved-kit-index";
import { cylinderMasterSku, cylinderMasterSource } from "@/lib/products/cylinder-master";
vi.mock("server-only", () => ({}));
import { GET } from "@/app/api/bottle-masters/approved/route";
import { CYLINDER28_CLEAR_TWIN } from "@/lib/products/pdp-redesign/cylinder28-frosted";
import { availableViews, stageLayout } from "@/lib/products/pdp-redesign/stage";
import display from "@/lib/products/display-images.generated.json";

const clear = ["GBMtlRoll28Blk", "GBMtlRoll28Wht", "GBRoll28Blk", "GBCyl1ozRollWht"];
const frosted = Object.keys(CYLINDER28_CLEAR_TWIN);
const body = (sku: string) => approvedComponentKit(sku)!.parts.find(part => part.slot === "body")!;
const sources = display.sources as Record<string, Record<string, string>>;

describe("28 ml Cylinder roll-ons use the reviewed Sunburst glass on hosted builds (2026-11-24)", () => {
    it("serves all eight Clear and Frosted recipes, every roller and cap", () => {
        expect(Object.keys(approvedComponentKits()).filter(isCylinder28RollOnSku).sort()).toEqual([...clear, ...frosted].sort());
        expect(frosted).toHaveLength(4);
    });

    it("draws nothing from the local review folders", () => {
        for (const sku of [...clear, ...frosted]) {
            const kit = approvedComponentKit(sku)!;
            expect(kit.sku).toBe(sku);
            for (const part of kit.parts) {
                for (const image of [part.image, part.image2x, part.mask, part.detached?.image]) {
                    if (!image) continue;
                    expect(image.url).not.toMatch(/^\/(?:local-kits|reviews)\//);
                }
            }
        }
    });

    it("gives Clear the clear body and Frosted the frosted body, each with display copies", () => {
        for (const sku of clear) {
            expect(body(sku).image.url).toMatch(/^\/images\/approved-masters\/cylinder28-glass-clear\.41b656b096f0\.png$/);
            expect(approvedComponentKit(sku)!.register?.glass).toBe("Clear");
        }
        for (const sku of frosted) {
            const kit = approvedComponentKit(sku)!;
            expect(body(sku).image.url).toMatch(/^\/images\/approved-masters\/cylinder28-glass-frosted\.829743ec8dcd\.png$/);
            expect(kit.register).toMatchObject({ bodyId: "cylinder-28ml-16mm", glass: "Frosted", plateKey: "cylinder-28ml-16mm|Frosted" });
        }
        for (const sku of [clear[0], frosted[0]]) {
            expect(sources[body(sku).image.url]?.["640"]).toMatch(/^\/images\/approved-masters\/cylinder28-glass-(clear|frosted)-640\.[a-f0-9]{12}\.webp$/);
        }
    });

    it("keeps each Frosted SKU's roller and cap identical to its clear twin", () => {
        for (const [sku, twin] of Object.entries(CYLINDER28_CLEAR_TWIN)) {
            const own = approvedComponentKit(sku)!.parts.filter(part => part.slot !== "body");
            const clearParts = approvedComponentKit(twin.websiteSku)!.parts.filter(part => part.slot !== "body");
            expect(own).toEqual(clearParts);
            expect(own.map(part => part.slot)).toEqual(["roller", "cap"]);
        }
        expect(approvedComponentKit("GBCylFrst28MtlRollBlk")!.parts.find(part => part.slot === "roller")!.image.url).toMatch(/f5a0b3cae3e4/);
        expect(approvedComponentKit("GBCylFrst28RollWht")!.parts.find(part => part.slot === "roller")!.image.url).toMatch(/e3c978ea447c/);
    });

    it("keeps the owner-measured 81.73 mm glass at the same size on stage", () => {
        for (const sku of [...clear, ...frosted]) {
            const kit = approvedComponentKit(sku)!;
            const sizing = kit.glassSizing!;
            // Glass span (shoulder landmark to foot) per stage height is unchanged from the measured recipe:
            // 44.0698% over 1061 - 380.10 px.
            const scale = sizing.heightPct / (body(sku).bounds.bottom - sizing.landmarkY!);
            expect(scale).toBeCloseTo(44.06975268656447 / (1061 - 380.1031390134529), 8);
            expect(sizing.source).toMatch(/81\.73 mm/);
        }
    });

    it("renders every view on Clear and Frosted", () => {
        for (const sku of [...clear, ...frosted]) {
            const kit = approvedComponentKit(sku)!;
            const context = { family: "Cylinder", capacityMl: 28, color: kit.register!.glass, applicator: "Roller Ball", websiteSku: sku };
            const views = availableViews(kit, context);
            expect(views).toEqual(expect.arrayContaining(["sidecar", "capon", "exploded"]));
            for (const view of views) expect(stageLayout(kit, view, context)?.parts.length).toBeGreaterThan(0);
        }
    });

    it("makes Clear and Frosted approved masters on the same 28 ml kit version, so both catalog cards draw them", () => {
        const version = `${APPROVED_KIT_VERSION}-${CYLINDER28_KIT_VERSION}`;
        for (const sku of [...clear, ...frosted]) {
            expect(approvedMasterSku(sku)).toBe(sku);
            expect(cylinderMasterSku(sku)).toBe(sku);
            expect(updatedCylinderKitVersion(sku)).toBe(version);
            expect(cylinderMasterSource(sku)).toEqual({ family: "approved", version });
        }
    });

    it("serves each Frosted SKU's own frosted recipe, hosted, under the 28 ml version", async () => {
        for (const sku of frosted) {
            const { family, version } = cylinderMasterSource(sku)!;
            const response = await GET(new Request(`https://example.com/api/bottle-masters/${family}?sku=${sku}&v=${version}`));
            expect(response.status).toBe(200);
            const payload = await response.json();
            expect(payload.version).toBe(version);
            expect(payload.kit).toEqual(JSON.parse(JSON.stringify(approvedComponentKit(sku))));
            const parts = payload.kit.parts as { slot: string; image: { url: string } }[];
            expect(parts.find(part => part.slot === "body")!.image.url).toMatch(/cylinder28-glass-frosted\.829743ec8dcd\.png$/);
            for (const part of parts) expect(part.image.url).not.toMatch(/^\/(?:local-kits|reviews)\//);
            const invalid = await GET(new Request(`https://example.com/api/bottle-masters/approved?sku=${sku}&v=wrong`));
            expect(invalid.status).toBe(404);
        }
    });
});
