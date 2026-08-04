export type CylinderGroupFixture = {
    slug: string;
    family: string;
    capacityMl: number | null;
    neckThreadSize: string | null;
    color: string | null;
    paperDollFamilyKey: string | null;
};

export type CylinderVariantFixture = {
    graceSku: string;
    websiteSku: string;
    applicator: string | null;
    capColor: string | null;
    capStyle: string | null;
    itemName: string;
    webPrice1pc: number | null;
    priceTiers: Array<{ minQty: number; totalPrice: number; unitPrice: number }>;
    stockStatus: string | null;
    shopifyVariantId: string | null;
    shopifySellable: boolean | null;
};

export type CylinderConfigurationFixture = {
    group: CylinderGroupFixture;
    variant: CylinderVariantFixture;
};

const swirlRollonGroup: CylinderGroupFixture = {
    slug: "cylinder-9ml-swirl-17-415-rollon",
    family: "Cylinder",
    capacityMl: 9,
    neckThreadSize: "17-415",
    color: "Swirl",
    paperDollFamilyKey: "CYL-9ML",
};

function variant(
    values: Partial<CylinderVariantFixture> & Pick<CylinderVariantFixture, "graceSku" | "websiteSku" | "applicator" | "capColor">,
): CylinderVariantFixture {
    return {
        capStyle: "Roll-On",
        itemName: "9 ml Cylinder bottle",
        webPrice1pc: 0.76,
        priceTiers: [{ minQty: 1, totalPrice: 0.76, unitPrice: 0.76 }],
        stockStatus: "In Stock",
        shopifyVariantId: "gid://shopify/ProductVariant/1",
        shopifySellable: true,
        ...values,
    };
}

export const swirlWhiteCapFixtures: CylinderConfigurationFixture[] = [
    {
        group: swirlRollonGroup,
        variant: variant({
            graceSku: "GB-CYL-WHT-9ML-MRL-WHT",
            websiteSku: "GBCylSwrl9MtlRollWht",
            applicator: "Metal Roller Ball",
            capColor: "White",
        }),
    },
    {
        group: swirlRollonGroup,
        variant: variant({
            graceSku: "GB-CYL-WHT-9ML-ROL-WHT",
            websiteSku: "GBCylSwrl9RollWht",
            applicator: "Plastic Roller Ball",
            capColor: "White",
        }),
    },
];

export const swirlLegacySkuFixture: CylinderConfigurationFixture = {
    group: swirlRollonGroup,
    variant: variant({
        graceSku: "GB-CYL-CLR-9ML-MRL-SGLD-01",
        websiteSku: "GBCylSwrl9MtlRollShnGl",
        applicator: "Metal Roller Ball",
        capColor: "Shiny Gold",
    }),
};

export const unknownFinishFixture: CylinderConfigurationFixture = {
    group: swirlRollonGroup,
    variant: variant({
        graceSku: "GB-CYL-CLR-9ML-MRL-UNKNOWN",
        websiteSku: "GBCylSwrl9MtlRollUnknown",
        applicator: "Metal Roller Ball",
        capColor: "Chrome Rainbow",
    }),
};

export const clearSprayerFixture: CylinderConfigurationFixture = {
    group: {
        ...swirlRollonGroup,
        slug: "cylinder-9ml-clear-17-415-finemist",
        color: "Clear",
    },
    variant: variant({
        graceSku: "GB-CYL-CLR-9ML-T-23",
        websiteSku: "GBCyl9SpryMattSl",
        applicator: "Fine Mist Sprayer",
        capColor: "Clear",
        capStyle: "Tall",
        itemName: "Cylinder design 9ml clear glass bottle with fine mist sprayer with matte silver trim and plastic overcap.",
    }),
};

export const amberLotionPumpFixture: CylinderConfigurationFixture = {
    group: {
        ...swirlRollonGroup,
        slug: "cylinder-9ml-amber-17-415-lotionpump",
        color: "Amber",
    },
    variant: variant({
        graceSku: "LB-CYL-AMB-9ML-LPM-GLD",
        websiteSku: "LBCylAmb9LtnGl",
        applicator: "Lotion Pump",
        capColor: "Gold",
        capStyle: "Screw Cap",
        itemName: "Cylinder design 9ml amber glass bottle with treatment pump with gold trim and plastic overcap.",
    }),
};

export const clearLotionPumpLegacyFixture: CylinderConfigurationFixture = {
    group: {
        ...swirlRollonGroup,
        slug: "cylinder-9ml-clear-17-415-lotionpump",
        color: "Clear",
    },
    variant: variant({
        graceSku: "LB-CYL-CLR-9ML-T-03",
        websiteSku: "LBCyl9LtnMtSl",
        applicator: "Lotion Pump",
        capColor: "Clear",
        capStyle: "Pump",
        itemName: "Cylinder design 9ml clear glass bottle with treatment pump with matte silver trim plastic overcap.",
    }),
};

export const clearRollonLegacyFixture: CylinderConfigurationFixture = {
    group: {
        ...swirlRollonGroup,
        slug: "cylinder-9ml-clear-17-415-rollon",
        color: "Clear",
    },
    variant: variant({
        graceSku: "GB-CYL-CLR-9ML-T-11",
        websiteSku: "GBCyl9RollBlkDot",
        applicator: "Plastic Roller Ball",
        capColor: "Clear",
        capStyle: "Tall",
        itemName: "Cylinder design 9ml clear glass bottle with plastic roller ball plug and black dot cap.",
    }),
};

export const tallCylinderFixture: CylinderConfigurationFixture = {
    group: {
        ...swirlRollonGroup,
        slug: "tall-cylinder-9ml-clear-13-415-rollon",
        neckThreadSize: "13-415",
        color: "Clear",
        paperDollFamilyKey: "TALLCYL-9ML",
    },
    variant: variant({
        graceSku: "GB-TALLCYL-CLR-9ML-MRL-SGLD",
        websiteSku: "GBTallCyl9MtlRollShnGl",
        applicator: "Metal Roller Ball",
        capColor: "Shiny Gold",
    }),
};
