export type PaperDollMode = "rollon" | "spray" | "lotion";

export interface PaperDollLayerKeys {
    body: string;
    roller?: string;
    cap?: string;
    sprayer?: string;
    pump?: string;
}

export interface PaperDollConfiguration {
    graceSku: string;
    websiteSku: string;
    productGroupSlug: string;
    familyKey: "CYL-9ML";
    family: "Cylinder";
    capacityMl: 9;
    neckThreadSize: "17-415";
    glassLabel: string;
    glassKey: string;
    applicatorLabel: string;
    applicatorKey: string;
    mode: PaperDollMode;
    finishLabel: string;
    layerKeys: PaperDollLayerKeys;
    price1pc: number | null;
    priceTiers: Array<{ minQty: number; totalPrice: number; unitPrice: number }>;
    stockStatus: string | null;
    shopifyVariantId: string | null;
    shopifySellable: boolean | null;
}

