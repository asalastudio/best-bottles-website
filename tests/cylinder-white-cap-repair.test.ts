import { describe, expect, it } from "vitest";
import {
    CYLINDER_SWIRL_WHITE_CAP_GROUP_SLUG,
    CYLINDER_SWIRL_WHITE_CAP_VARIANTS,
} from "@/lib/products/cylinder-white-cap-repair";

describe("Cylinder Swirl white-cap repair contract", () => {
    it("restores the two configurations that make the 9 mL 17-415 cohort total 145", () => {
        expect(CYLINDER_SWIRL_WHITE_CAP_GROUP_SLUG).toBe("cylinder-9ml-swirl-17-415-rollon");
        expect(CYLINDER_SWIRL_WHITE_CAP_VARIANTS).toHaveLength(2);
        expect(CYLINDER_SWIRL_WHITE_CAP_VARIANTS.map((variant) => variant.graceSku)).toEqual([
            "GB-CYL-WHT-9ML-MRL-WHT",
            "GB-CYL-WHT-9ML-ROL-WHT",
        ]);
    });

    it("keeps both rows on the Swirl 17-415 platform with distinct roller materials", () => {
        expect(CYLINDER_SWIRL_WHITE_CAP_VARIANTS.map((variant) => ({
            color: variant.color,
            capacityMl: variant.capacityMl,
            neckThreadSize: variant.neckThreadSize,
            capColor: variant.capColor,
            applicator: variant.applicator,
            ballMaterial: variant.ballMaterial,
        }))).toEqual([
            {
                color: "Swirl",
                capacityMl: 9,
                neckThreadSize: "17-415",
                capColor: "White",
                applicator: "Metal Roller Ball",
                ballMaterial: "Metal",
            },
            {
                color: "Swirl",
                capacityMl: 9,
                neckThreadSize: "17-415",
                capColor: "White",
                applicator: "Plastic Roller Ball",
                ballMaterial: "Plastic",
            },
        ]);
    });
});
