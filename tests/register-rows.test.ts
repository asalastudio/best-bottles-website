import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { stableJson } from "../convex/register";
import { parseBuildParts, parseCsv, readRegister, shapeRegister } from "../scripts/register/registerRows";

const REGISTER = resolve(__dirname, "..", "data", "register");

describe("register CSV parsing", () => {
    it("handles quotes, doubled quotes, commas and newlines inside fields", () => {
        const rows = parseCsv('a,b,c\n1,"x, y","say ""hi"""\n2,"line\nbreak",\n');
        expect(rows).toEqual([
            { a: "1", b: "x, y", c: 'say "hi"' },
            { a: "2", b: "line\nbreak", c: "" },
        ]);
    });

    it("parses build parts as role:componentId and rejects unknown roles", () => {
        expect(parseBuildParts("roller:LIB-17-415-MtlRollon; cap:CMP-ROC-MSLV-17415", "X")).toEqual([
            { role: "roller", componentId: "LIB-17-415-MtlRollon" },
            { role: "cap", componentId: "CMP-ROC-MSLV-17415" },
        ]);
        expect(() => parseBuildParts("lid:CMP-1", "X")).toThrow(/build role/);
    });
});

describe("stableJson", () => {
    it("ignores key order and undefined fields", () => {
        expect(stableJson({ b: 1, a: { d: [1, 2], c: null }, e: undefined })).toBe(stableJson({ a: { c: null, d: [1, 2] }, b: 1 }));
        expect(stableJson({ a: [1, 2] })).not.toBe(stableJson({ a: [2, 1] }));
    });
});

describe("the committed register shapes cleanly for Convex", () => {
    const files = readRegister(REGISTER);
    const { rows, problems } = shapeRegister(files);

    it("has no integrity problems", () => {
        expect(problems).toEqual([]);
    });

    it("keeps every row", () => {
        expect(rows.bodies).toHaveLength(files.bodies.length);
        expect(rows.components).toHaveLength(files.components.length);
        expect(rows.assemblies).toHaveLength(files.assemblies.length);
    });

    it("registers the library parts as non-sellable components keyed LIB-<neck>-<name>", () => {
        const parts = rows.components.filter(c => c.componentId.startsWith("LIB-"));
        expect(parts.map(p => p.componentId).sort()).toEqual([
            "LIB-13-415-MtlRollon", "LIB-13-415-PlsticRollon", "LIB-14.3mm-Plug", "LIB-17-415-MtlRollon", "LIB-17-415-PlsticRollon", "LIB-18-415-Reducer",
            "LIB-18-415-ShnBlkCap", "LIB-18-415-WhtPumpClOvrCp", "LIB-20-400-MtlRollon", "LIB-20-400-PlsticRollon",
        ]);
        for (const part of parts) {
            expect(part.sellable).toBe(false);
            expect(part.graceSku).toBeNull();
        }
    });

    it("builds every white-pump clear-overcap bottle from the white rectangular pump library part (checklist 6a)", () => {
        const white = rows.assemblies.filter(a => a.build.parts.some(p => p.componentId === "LIB-18-415-WhtPumpClOvrCp"));
        expect(white.map(a => a.websiteSku).sort()).toEqual([
            "LBElg100WhtClOvrCp", "LBElg60WhtClOvrCp", "LBElgFrst100WhtClOvrCp", "LBElgFrst60WhtClOvrCp", "LBEmp100WhtClOvrCp",
            "LBEmp50WhtClOvrCp", "LBSlk100WhtRectClOverCap", "LBSlk30WhtRectClOverCap", "LBSlk50WhtRectClOverCap",
        ]);
        for (const assembly of white) {
            expect(assembly.build.status).toBe("resolved");
            expect(assembly.build.parts).toEqual([{ role: "pump", componentId: "LIB-18-415-WhtPumpClOvrCp" }]);
        }
    });

    it("types the 17-415 lotion pumps and the matte-silver sprayer correctly", () => {
        const type = (sku: string) => rows.components.find(c => c.websiteSku === sku)?.type;
        expect(type("Ltn17-415Blk")).toBe("lotion-pump");
        expect(type("Spry17-415MattSl")).toBe("fine-mist-sprayer");
        expect(type("CP18-415AnSpTslGl")).toBe("tassel-bulb-sprayer");
    });

    it("builds every 9 mL Cylinder pilot bottle from its own parts", () => {
        const pilot = rows.assemblies.filter(a => a.bodyId === "cylinder-9ml-17-415");
        expect(pilot).toHaveLength(145);
        const resolved = pilot.filter(a => a.build.status === "resolved");
        expect(resolved).toHaveLength(145);
        for (const assembly of resolved) {
            const roles = assembly.build.parts.map(p => p.role);
            if (/Roller Ball/.test(assembly.fitmentType ?? "")) expect(roles).toEqual(["roller", "cap"]);
            else expect(roles).toHaveLength(1);
        }
        // "Black with Dots" (canonical, src/lib/catalogFilters.ts) and "Black Dotted" reach the same dotted cap.
        const clearDotted = pilot.find(a => a.websiteSku === "GBCyl9MtlRollBlkDot");
        expect(clearDotted?.capColor).toBe("Black with Dots");
        expect(clearDotted?.build.parts.map(p => p.componentId)).toEqual(["LIB-17-415-MtlRollon", "CMP-ROC-BLK-17415-DOT"]);
        const metal = pilot.find(a => a.websiteSku === "GBCylAmb9MtlRollBlkDot");
        expect(metal?.build.parts).toEqual([
            { role: "roller", componentId: "LIB-17-415-MtlRollon" },
            { role: "cap", componentId: "CMP-ROC-BLK-17415-DOT" },
        ]);
    });

    it("never builds an assembly outside the validated necks", () => {
        // The own-part rules written so far (BUILD_RULE_NECKS in scripts/register/build_register.py): the 17-415 pilot,
        // 18-415 and the 14.3 mm Tola plug (2026-09-25), 13-415 (2026-09-26), the Boston Round 20-400 (2026-09-29).
        const built = rows.assemblies.filter(a => a.build.status !== "unresolved");
        expect(new Set(built.map(a => a.neck))).toEqual(new Set(["13-415", "17-415", "18-415", "14.3mm", "20-400"]));
    });

    it("builds every Boston Round 20-400 bottle from its own parts", () => {
        const boston = rows.assemblies.filter(a => a.neck === "20-400");
        expect(boston).toHaveLength(108);
        expect(boston.filter(a => a.build.status === "resolved")).toHaveLength(108);
        const parts = (sku: string) => rows.assemblies.find(a => a.websiteSku === sku)?.build.parts.map(p => p.componentId);
        // A roll-on: its roller material's insert under the named tall cap.
        expect(parts("GBBstn1ozRollonShnSl")).toEqual(["LIB-20-400-PlsticRollon", "CMP-ROC-SSLV-20400-T"]);
        expect(parts("GBBstnBlu2ozMtlRollonShnSl")).toEqual(["LIB-20-400-MtlRollon", "CMP-ROC-SSLV-20400-T"]);
        // A bare "Blk" or "Gl" names the shiny cap: the photos show shiny caps (Jordan 2026-09-29).
        expect(parts("GBBstn1ozMtlRollonBlk")).toEqual(["LIB-20-400-MtlRollon", "CMP-ROC-SBLK-20400-T"]);
        expect(parts("GBBstnAmb1ozRollonGl")).toEqual(["LIB-20-400-PlsticRollon", "CMP-ROC-SGLD-20400-T"]);
        // A dropper is one part, sized to its bottle; the short black cap is the size's own.
        expect(parts("GBBstn2ozBlkDrpr")).toEqual(["CMP-DRP-BLK-20400-90"]);
        expect(parts("GBBstn1ozBlkDrp")).toEqual(["CMP-DRP-BLK-20400-76MM-01"]);
        expect(parts("GBBstnAmb1ozBlkCapSht")).toEqual(["CMP-CAP-BLK-20-400-1OZ"]);
    });

    it("builds a 13-415 roll-on from its SKU: the roller material's insert under the named cap", () => {
        const metal = rows.assemblies.find(a => a.websiteSku === "GBCrcl15MtlRollBlkSh");
        expect(metal?.build.parts).toEqual([
            { role: "roller", componentId: "LIB-13-415-MtlRollon" },
            { role: "cap", componentId: "CMP-ROC-SBLK-13415" },
        ]);
        const spray = rows.assemblies.find(a => a.websiteSku === "GBCrcl15SpryGlSh");
        expect(spray?.build.parts).toEqual([{ role: "sprayer", componentId: "CMP-CAP-SGLD-13-415-03" }]);
    });

    it("keys each assembly's body plate by body and glass", () => {
        const pilotPlates = new Set(rows.assemblies.filter(a => a.bodyId === "cylinder-9ml-17-415").map(a => a.plateKey));
        expect(pilotPlates.size).toBe(5);
    });
});
