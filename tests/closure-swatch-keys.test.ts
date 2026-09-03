/**
 * The 5 ml cobalt 13-415 roll-on page (2026-09-02): four pills — Matte Copper,
 * Pink with Dots, Silver with Dots, Black with Dots — rendered as colour dots
 * (three of them blank) while their photographs sat in roll-on-cap-13-415
 * under the token names Copper / Pink / Silver / Black. Real SKUs from that
 * page pin the join.
 */
import { describe, expect, it } from "vitest";
import { buildCapOptionPhotoKeys, photoKeysForVariant, resolveCapOptionPhoto } from "../src/lib/products/closure-swatch-keys";
import { getFinishFromWebsiteSku } from "../src/lib/paper-doll/tokens.generated";

// catalogue variants (websiteSku, capColor) and the component rows that photograph them
const variants = [
    { websiteSku: "GBCylBlu5MtlRollCuMatt", graceSku: "GB-CYL-BLU-5ML-MRL-MCPR", capColor: "Matte Copper" },
    { websiteSku: "GBCylBlu5MtlRollPinkDot", graceSku: "GB-CYL-BLU-5ML-MRL-PKDT", capColor: "Pink with Dots" },
    { websiteSku: "GBCylBlu5MtlRollSlDot", graceSku: "GB-CYL-BLU-5ML-MRL-SLDT", capColor: "Silver with Dots" },
    { websiteSku: "GBCylBlu5MtlRollBlkDot", graceSku: "GB-CYL-BLU-5ML-MRL-BKDT", capColor: "Black with Dots" },
    { websiteSku: "GBCylBlu5MtlRollSlMatt", graceSku: "GB-CYL-BLU-5ML-MRL-MSLV", capColor: "Matte Silver" },
    { websiteSku: "GBCylBlu5MtlRollGlSh", graceSku: "GB-CYL-BLU-5ML-MRL-SGLD", capColor: "Shiny Gold" },
];
const componentRows = ["CPRoll13-415Cu", "CPRoll13-415PinkDot", "CPRoll13-415SlDot", "CPRoll13-415BlackDot", "CPRoll13-415SlMt", "CPRoll13-415GlSh"];
const thumbBySwatch = new Map<string, string>();
for (const sku of componentRows) {
    const finish = getFinishFromWebsiteSku(sku);
    if (finish && !thumbBySwatch.has(finish.swatchName)) thumbBySwatch.set(finish.swatchName, `thumb:${sku}`);
}

describe("closure swatch photo join", () => {
    it("the variant's website-SKU token names what the component family keys on", () => {
        expect(photoKeysForVariant(variants[0])).toEqual(["Copper"]);
        expect(photoKeysForVariant(variants[1])).toEqual(["Pink"]);
        expect(photoKeysForVariant(variants[2])).toEqual(["Silver"]);
        expect(photoKeysForVariant(variants[3])).toEqual(["Black"]);
    });

    it("every catalogue pill on the page resolves to its photograph", () => {
        const options = variants.map((v) => v.capColor);
        const keys = buildCapOptionPhotoKeys(options, variants, (v) => v.capColor);
        expect(keys["Pink with Dots"]).toEqual(["Pink"]);
        expect(keys["Black with Dots"]).toEqual(["Black"]);
        for (const name of options) {
            expect(resolveCapOptionPhoto(name, thumbBySwatch, keys), name).toBeDefined();
        }
        expect(resolveCapOptionPhoto("Matte Copper", thumbBySwatch, keys)).toBe("thumb:CPRoll13-415Cu");
        expect(resolveCapOptionPhoto("Silver with Dots", thumbBySwatch, keys)).toBe("thumb:CPRoll13-415SlDot");
    });

    it("a name the component family photographs directly still wins by name", () => {
        const keys = buildCapOptionPhotoKeys(["Matte Silver"], variants, (v) => v.capColor);
        expect(resolveCapOptionPhoto("Matte Silver", thumbBySwatch, keys)).toBe("thumb:CPRoll13-415SlMt");
    });

    it("an unrecognised SKU falls through to the colour dot, never to a wrong photo", () => {
        const keys = buildCapOptionPhotoKeys(["Mystery"], [{ websiteSku: "XYZ", graceSku: null, capColor: "Mystery" }], (v) => v.capColor);
        expect(keys["Mystery"]).toEqual([]);
        expect(resolveCapOptionPhoto("Mystery", thumbBySwatch, keys)).toBeUndefined();
    });
});
