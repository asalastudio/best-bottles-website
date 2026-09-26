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
        ]);
        for (const part of parts) {
            expect(part.sellable).toBe(false);
            expect(part.graceSku).toBeNull();
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
        // 18-415 (2026-09-25) and the 14.3 mm Tola plug (2026-09-25).
        const built = rows.assemblies.filter(a => a.build.status !== "unresolved");
        expect(new Set(built.map(a => a.neck))).toEqual(new Set(["17-415", "18-415", "14.3mm"]));
    });

    it("keys each assembly's body plate by body and glass", () => {
        const pilotPlates = new Set(rows.assemblies.filter(a => a.bodyId === "cylinder-9ml-17-415").map(a => a.plateKey));
        expect(pilotPlates.size).toBe(5);
    });
});
