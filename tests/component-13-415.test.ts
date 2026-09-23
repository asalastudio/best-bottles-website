import { describe, expect, it } from "vitest";
import { COMPONENTS_13_415, reviewed13_415Component, reviewed13_415Label } from "../convex/component13_415Catalog";
import { inferComponentType, normalizeComponentsByType, resolveCompatibleComponents } from "../convex/componentUtils";

const component = (graceSku: string, websiteSku?: string) => ({ graceSku, websiteSku, itemName: "Imported component",
    imageUrl: null, webPrice1pc: 0.3, webPrice12pc: null, capColor: null, stockStatus: "In Stock" });

describe("the reviewed 13-415 neck-thread component matrix", () => {
    it("keeps all nine roll-on caps in one group, including six solid and three dotted", () => {
        const counts = COMPONENTS_13_415.reduce<Record<string, number>>((byKind, item) => {
            byKind[item.kind] = (byKind[item.kind] ?? 0) + 1;
            return byKind;
        }, {});
        expect(counts).toEqual({
            "roll-on-solid": 6, "roll-on-dotted": 3, "short-ribbed": 2,
            "short-lined": 6, "tall-lined": 2, "fine-mist": 8,
        });
        expect(new Set(COMPONENTS_13_415.map(item => item.websiteSku)).size).toBe(27);
        expect(new Set(COMPONENTS_13_415.map(item => item.graceSku)).size).toBe(27);
        expect(COMPONENTS_13_415.map(reviewed13_415Label)).toHaveLength(27);
        expect(reviewed13_415Label(COMPONENTS_13_415.find(item => item.websiteSku === "CP13-415SpryBlkMt")!))
            .toEqual({ itemName: "Matte Black Fine Mist Sprayer, Thread 13-415", capColor: "Matte Black" });
        expect(reviewed13_415Label(COMPONENTS_13_415.find(item => item.websiteSku === "CP13-415Gl")!))
            .toEqual({ itemName: "Shiny Gold Tall Lined Cap, Thread 13-415", capColor: "Shiny Gold" });
    });

    it("uses exact identity to reclassify an imported Short Cap as a fine-mist sprayer", () => {
        const active = component("CMP-CAP-BLK-13-415-01", "CP13-415SpryBlkMt");
        const retired = component("CMP-SPR-MTBK-13-415-07", "CP13-415SpryBlkMt__RETIRED__old");
        const grouped = normalizeComponentsByType({ "Short Cap": [active], Sprayer: [retired] });
        expect(grouped.Sprayer).toMatchObject([{ graceSku: active.graceSku, websiteSku: active.websiteSku }]);
        expect(grouped["Short Cap"]).toBeUndefined();
        expect(inferComponentType(active.graceSku, active.itemName)).toBe("Sprayer");
        expect(reviewed13_415Component(active.graceSku, "CP13-415SpryGlMt")).toBeNull();
    });

    it("keeps lined and ribbed screw caps separate from roll-on caps and excludes unknown 13-415 imports", () => {
        const grouped = normalizeComponentsByType({
            "Short Cap": [component("CMP-CAP-WHT-S-13-415", "CP13-415WhtSht"),
                component("CMP-CLS-MTCP-S-13-415", "CP13-415CuSht"),
                component("CMP-CAP-SGLD-13-415-01", "CP13-415Gl"),
                component("CMP-CAP-UNKNOWN-13-415", "CP13-415Unknown")],
            "Roll-On Cap": COMPONENTS_13_415.filter(item => item.kind.startsWith("roll-on-"))
                .map(item => component(item.graceSku, item.websiteSku)),
            "Metal Roller": [component("CMP-MRL-13-415", "MetalRollerInsert")],
            "Plastic Roller": [component("CMP-ROL-13-415", "PlasticRollerInsert")],
            Sprayer: [component("CMP-SPR-GENERIC-13-415", "GenericSpray")],
        });
        const plain = resolveCompatibleComponents(grouped, null, { neckThreadSize: "13-415", applicator: "Cap/Closure" });
        expect(plain.Cap.map(item => item.websiteSku)).toEqual(["CP13-415WhtSht", "CP13-415CuSht", "CP13-415Gl"]);
        expect(plain["Roll-On Cap"]).toHaveLength(9);
        expect(plain["Metal Roller"]).toHaveLength(1);
        expect(plain["Plastic Roller"]).toHaveLength(1);
        expect(plain.Sprayer).toEqual([]);
        const plugged = resolveCompatibleComponents(grouped, null, { neckThreadSize: "13-415", applicator: "Metal Roller Ball" });
        expect(plugged["Roll-On Cap"]).toHaveLength(9);
        expect(plugged.Cap).toBeUndefined();
        expect(plugged.Sprayer).toBeUndefined();
    });
});
