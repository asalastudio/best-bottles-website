import type { PaperDollConfiguration } from "@/lib/paper-doll/types";
import {
    CYLINDER_9ML_17415_COHORT,
    isCylinder9ml17415Group,
    type ProductCohortGroupIdentity,
} from "./product-cohorts";

export { CYLINDER_9ML_17415_COHORT, isCylinder9ml17415Group };

export interface CylinderConfigurationSourceGroup extends ProductCohortGroupIdentity {
    slug: string;
    color: string | null;
}

export interface CylinderConfigurationSourceVariant {
    _id?: string;
    graceSku: string;
    websiteSku: string;
    applicator: string | null;
    capColor: string | null;
    capStyle?: string | null;
    itemName?: string | null;
    webPrice1pc: number | null;
    priceTiers?: Array<{ minQty: number; unitPrice: number; totalPrice?: number }> | null;
    stockStatus: string | null;
    shopifyVariantId?: string | null;
    shopifySellable?: boolean | null;
    itemDescription?: string | null;
    imageUrl?: string | null;
    imageUrlCapOff?: string | null;
    webPrice10pc?: number | null;
    webPrice12pc?: number | null;
    category?: string | null;
    heightWithCap?: string | null;
    heightWithoutCap?: string | null;
    diameter?: string | null;
    bottleWeightG?: number | null;
    caseQuantity?: number | null;
}

export interface CylinderConfigurationSourceRow {
    group: CylinderConfigurationSourceGroup;
    variant: CylinderConfigurationSourceVariant;
}

const BODY_KEYS: Record<string, string> = {
    Clear: "CLR",
    Amber: "AMB",
    "Cobalt Blue": "BLU",
    Frosted: "FRS",
    Swirl: "SWL",
};

const ROLLON_CAP_KEYS: Record<string, string> = {
    "Black Dotted": "BLK-DOT",
    "Matte Copper": "MATT-CU",
    "Matte Gold": "MATT-GL",
    "Matte Silver": "MATT-SL",
    "Pink Dotted": "PNK-DOT",
    "Shiny Black": "SHN-BLK",
    "Shiny Gold": "SHN-GL",
    "Shiny Silver": "SHN-SL",
    "Silver Dotted": "SL-DOT",
    White: "WHT",
};

const ROLLON_FINISHES: Array<{ pattern: RegExp; label: string; layerKey: string }> = [
    { pattern: /black dot cap/i, label: "Black Dotted", layerKey: "BLK-DOT" },
    { pattern: /matte copper cap/i, label: "Matte Copper", layerKey: "MATT-CU" },
    { pattern: /matte gold cap/i, label: "Matte Gold", layerKey: "MATT-GL" },
    { pattern: /matte silver cap/i, label: "Matte Silver", layerKey: "MATT-SL" },
    { pattern: /pink dot cap/i, label: "Pink Dotted", layerKey: "PNK-DOT" },
    { pattern: /shiny black cap/i, label: "Shiny Black", layerKey: "SHN-BLK" },
    { pattern: /shiny gold cap/i, label: "Shiny Gold", layerKey: "SHN-GL" },
    { pattern: /shiny silver cap/i, label: "Shiny Silver", layerKey: "SHN-SL" },
    { pattern: /silver dot cap/i, label: "Silver Dotted", layerKey: "SL-DOT" },
    { pattern: /white cap/i, label: "White", layerKey: "WHT" },
];

const ROLLER_KEYS: Record<string, { applicatorKey: string; layerKey: string }> = {
    "Metal Roller Ball": { applicatorKey: "metal-roller", layerKey: "MTL-ROLL" },
    "Plastic Roller Ball": { applicatorKey: "plastic-roller", layerKey: "PLS-ROLL" },
};

const SPRAYER_FINISHES: Array<{ pattern: RegExp; label: string; layerKey: string }> = [
    { pattern: /matte silver trim/i, label: "Matte Silver", layerKey: "MATT-SL" },
    { pattern: /shiny silver trim/i, label: "Shiny Silver", layerKey: "SHN-SL" },
    { pattern: /black trim/i, label: "Black", layerKey: "BLK" },
    { pattern: /gold trim/i, label: "Gold", layerKey: "GL" },
    { pattern: /red trim/i, label: "Red", layerKey: "RD" },
    { pattern: /turquoise trim/i, label: "Turquoise", layerKey: "TUR" },
];

const PUMP_KEYS: Record<string, string> = {
    Black: "BLK",
    Gold: "GL",
    "Matte Silver": "MATT-SL",
};

function mappingError(
    kind: string,
    value: string | null,
    row: CylinderConfigurationSourceRow,
): Error {
    return new Error(
        `Unmapped CYL-9ML ${kind} "${value ?? "null"}" for ${row.variant.graceSku} in ${row.group.slug}`,
    );
}

export function buildCylinder9mlConfigurations(
    rows: readonly CylinderConfigurationSourceRow[],
): PaperDollConfiguration[] {
    const configurations = rows.map((row): PaperDollConfiguration => {
        if (!isCylinder9ml17415Group(row.group)) {
            throw new Error(
                `Product ${row.variant.graceSku} in ${row.group.slug} is outside CYL-9ML 17-415 cohort`,
            );
        }

        const glassLabel = row.group.color;
        const bodyKey = glassLabel ? BODY_KEYS[glassLabel] : null;
        if (!glassLabel || !bodyKey) throw mappingError("glass", glassLabel, row);

        const applicator = row.variant.applicator;
        const roller = applicator ? ROLLER_KEYS[applicator] : null;
        const sprayer = applicator === "Fine Mist Sprayer"
            ? SPRAYER_FINISHES.find(({ pattern }) => pattern.test(row.variant.itemName ?? "")) ?? null
            : null;
        const pumpFromCapColor = applicator === "Lotion Pump" && row.variant.capColor
            ? PUMP_KEYS[row.variant.capColor] ?? null
            : null;
        const pumpFromItemName = applicator === "Lotion Pump"
            ? SPRAYER_FINISHES.find(
                ({ pattern, label }) => Boolean(PUMP_KEYS[label]) && pattern.test(row.variant.itemName ?? ""),
            ) ?? null
            : null;
        const pump = pumpFromCapColor && row.variant.capColor
            ? { label: row.variant.capColor, layerKey: pumpFromCapColor }
            : pumpFromItemName;

        let applicatorLabel: string;
        let applicatorKey: string;
        let mode: PaperDollConfiguration["mode"];
        let finishLabel: string;
        let layerKeys: PaperDollConfiguration["layerKeys"];

        if (roller) {
            const capLabel = row.variant.capColor;
            const capKey = capLabel ? ROLLON_CAP_KEYS[capLabel] : null;
            const parsedCap = capKey && capLabel
                ? { label: capLabel, layerKey: capKey }
                : ROLLON_FINISHES.find(({ pattern }) => pattern.test(row.variant.itemName ?? "")) ?? null;
            if (!parsedCap) throw mappingError("finish", capLabel, row);
            applicatorLabel = applicator!;
            applicatorKey = roller.applicatorKey;
            mode = "rollon";
            finishLabel = parsedCap.label;
            layerKeys = { body: bodyKey, roller: roller.layerKey, cap: parsedCap.layerKey };
        } else if (sprayer) {
            applicatorLabel = "Fine Mist Sprayer";
            applicatorKey = "fine-mist-sprayer";
            mode = "spray";
            finishLabel = sprayer.label;
            layerKeys = { body: bodyKey, sprayer: sprayer.layerKey };
        } else if (pump) {
            applicatorLabel = "Lotion Pump";
            applicatorKey = "lotion-pump";
            mode = "lotion";
            finishLabel = pump.label;
            layerKeys = { body: bodyKey, pump: pump.layerKey };
        } else if (applicator === "Fine Mist Sprayer" || applicator === "Lotion Pump") {
            throw mappingError("finish", row.variant.capColor, row);
        } else {
            throw mappingError("applicator", applicator, row);
        }

        return {
            graceSku: row.variant.graceSku,
            websiteSku: row.variant.websiteSku,
            productGroupSlug: row.group.slug,
            familyKey: "CYL-9ML",
            family: "Cylinder",
            capacityMl: 9,
            neckThreadSize: "17-415",
            glassLabel,
            glassKey: bodyKey,
            applicatorLabel,
            applicatorKey,
            mode,
            finishLabel,
            layerKeys,
            price1pc: row.variant.webPrice1pc,
            priceTiers: row.variant.priceTiers ?? [],
            stockStatus: row.variant.stockStatus,
            shopifyVariantId: row.variant.shopifyVariantId ?? null,
            shopifySellable: row.variant.shopifySellable ?? null,
            variantId: row.variant._id ?? null,
            itemName: row.variant.itemName ?? null,
            itemDescription: row.variant.itemDescription ?? null,
            imageUrl: row.variant.imageUrl ?? null,
            imageUrlCapOff: row.variant.imageUrlCapOff ?? null,
            webPrice10pc: row.variant.webPrice10pc ?? null,
            webPrice12pc: row.variant.webPrice12pc ?? null,
            category: row.variant.category ?? null,
            heightWithCap: row.variant.heightWithCap ?? null,
            heightWithoutCap: row.variant.heightWithoutCap ?? null,
            diameter: row.variant.diameter ?? null,
            bottleWeightG: row.variant.bottleWeightG ?? null,
            caseQuantity: row.variant.caseQuantity ?? null,
        };
    });

    return configurations.sort((a, b) =>
        a.glassLabel.localeCompare(b.glassLabel)
        || a.applicatorLabel.localeCompare(b.applicatorLabel)
        || a.finishLabel.localeCompare(b.finishLabel)
        || a.graceSku.localeCompare(b.graceSku),
    );
}
