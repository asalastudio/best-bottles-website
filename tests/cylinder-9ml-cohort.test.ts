import { describe, expect, it } from "vitest";
import {
    CYLINDER_9ML_17415_COHORT,
    buildCylinder9mlConfigurations,
    isCylinder9ml17415Group,
} from "@/lib/products/cylinder-9ml-configurator";
import {
    amberLotionPumpFixture,
    clearLotionPumpLegacyFixture,
    clearRollonLegacyFixture,
    clearSprayerFixture,
    swirlLegacySkuFixture,
    swirlWhiteCapFixtures,
    tallCylinderFixture,
    unknownFinishFixture,
} from "./fixtures/cylinder-9ml";

describe("CYL-9ML 17-415 configuration contract", () => {
    it("identifies only the classic 9 ml 17-415 cohort", () => {
        expect(CYLINDER_9ML_17415_COHORT).toMatchObject({
            slug: "cylinder-9ml-17-415",
            family: "Cylinder",
            capacityMl: 9,
            neckThreadSize: "17-415",
            paperDollFamilyKey: "CYL-9ML",
        });
        expect(isCylinder9ml17415Group(swirlWhiteCapFixtures[0].group)).toBe(true);
        expect(isCylinder9ml17415Group(tallCylinderFixture.group)).toBe(false);
    });

    it("maps metal and plastic rollers with the white cap", () => {
        const rows = buildCylinder9mlConfigurations(swirlWhiteCapFixtures);

        expect(rows.map((row) => [row.applicatorKey, row.layerKeys.roller, row.layerKeys.cap])).toEqual([
            ["metal-roller", "MTL-ROLL", "WHT"],
            ["plastic-roller", "PLS-ROLL", "WHT"],
        ]);
    });

    it("uses the group glass color when a legacy SKU incorrectly says CLR", () => {
        const [row] = buildCylinder9mlConfigurations([swirlLegacySkuFixture]);

        expect(row.glassLabel).toBe("Swirl");
        expect(row.layerKeys.body).toBe("SWL");
    });

    it("maps fine mist trim to the complete sprayer layer", () => {
        const [row] = buildCylinder9mlConfigurations([clearSprayerFixture]);

        expect(row).toMatchObject({
            mode: "spray",
            applicatorKey: "fine-mist-sprayer",
            finishLabel: "Matte Silver",
            layerKeys: { body: "CLR", sprayer: "MATT-SL" },
        });
    });

    it("maps lotion pump finish to the complete pump layer", () => {
        const [row] = buildCylinder9mlConfigurations([amberLotionPumpFixture]);

        expect(row).toMatchObject({
            mode: "lotion",
            applicatorKey: "lotion-pump",
            finishLabel: "Gold",
            layerKeys: { body: "AMB", pump: "GL" },
        });
    });

    it("recovers lotion pump finish when legacy capColor only says Clear", () => {
        const [row] = buildCylinder9mlConfigurations([clearLotionPumpLegacyFixture]);

        expect(row).toMatchObject({
            mode: "lotion",
            finishLabel: "Matte Silver",
            layerKeys: { body: "CLR", pump: "MATT-SL" },
        });
    });

    it("recovers roll-on cap finish when legacy capColor only says Clear", () => {
        const [row] = buildCylinder9mlConfigurations([clearRollonLegacyFixture]);

        expect(row).toMatchObject({
            mode: "rollon",
            applicatorKey: "plastic-roller",
            finishLabel: "Black Dotted",
            layerKeys: { body: "CLR", roller: "PLS-ROLL", cap: "BLK-DOT" },
        });
    });

    it("rejects an unmapped finish rather than guessing a layer", () => {
        expect(() => buildCylinder9mlConfigurations([unknownFinishFixture])).toThrow(
            /Unmapped CYL-9ML finish "Chrome Rainbow".*GB-CYL-CLR-9ML-MRL-UNKNOWN.*cylinder-9ml-swirl-17-415-rollon/,
        );
    });

    it("rejects rows from the 9 ml 13-415 tall cylinder", () => {
        expect(() => buildCylinder9mlConfigurations([tallCylinderFixture])).toThrow(
            /outside CYL-9ML 17-415 cohort/,
        );
    });
});
