import { isPillarPourSku, isPillarRollOnSku } from "../products/pillar-master";
import index from "./approved-kit-index.json";
import sprays from "./cylinder-spray-index.json";
import jumbo from "./cylinder-jumbo-overcap-index.json";
import lotions from "./cylinder-lotion-index.json";
import sleekTubes from "./sleek-large-tubes-index.json";
import dropper from "./cylinder25-dropper-index.json";
import reducers25 from "./cylinder25-reducers-index.json";
import body25 from "./cylinder25-body-index.json";

const lotionSkus = new Set<string>(lotions.skus);
const skus = new Set<string>([...index.skus, ...sprays.skus, ...jumbo.skus, ...lotionSkus, ...sleekTubes.skus, ...dropper.skus, ...reducers25.skus]);
const sleekSkus = new Set<string>(sleekTubes.skus);
const dropperSkus = new Set<string>(dropper.skus);
const reducer25Skus = new Set<string>(reducers25.skus);
const body25Skus = new Set<string>(body25.skus);
const jumbo28MeasuredSkus = new Set(["GBMtlRoll28Wht", "GBCyl1ozRollWht", "GBRoll28Blk", "GBMtlRoll28Blk"]);
export const APPROVED_KIT_VERSION = index.version;
export const CYLINDER9_COLOR_VERSION = index.version + "-cylinder9-colors-v2-20261102";
const spraySkus = new Set<string>(sprays.skus);
const jumboSkus = new Set<string>(jumbo.skus);
const nineLotionSkus = new Set([
    "LBCylAmb9LtnBlk", "LBCylAmb9LtnGl", "LBCylAmb9LtnMtSl",
    "LBCyl9LtnBlk", "LBCyl9LtnGl", "LBCyl9LtnMtSl",
    "LBCylBlu9LtnBlk", "LBCylBlu9LtnGl", "LBCylBlu9LtnMattSl",
    "LBCylFrst9LtnBlk", "LBCylFrst9LtnGl", "LBCylFrst9LtnMtSl",
    "LBCylSwrl9LtnBlk", "LBCylSwrl9LtnGl", "LBCylSwrl9LtnMtSl",
]);
const largeReducerFinishes: Record<string, string> = {
    BlkLthr: "BKLT", BrwnLthr: "BRLT", IvyLthr: "IVLT", LBrwnLthr: "LBLT", PnkLthr: "PKLT",
    MtSl: "MSLV", MtSlTall: "MSLV-T", ShnBlk: "SBLK", ShnBlkTall: "SBLK-T",
    ShnGl: "SGLD", ShnSl: "SSLV", Wht: "WHT",
};
export function cylinderLargeReducerGraceSku(sku: string): string | null {
    const match = /^GBCyl(50|100)Rdcr([A-Za-z]+)$/.exec(sku);
    if (!match || !Object.hasOwn(largeReducerFinishes, match[2])) return null;
    return `GB-CYL-CLR-${match[1]}ML-RDC-${largeReducerFinishes[match[2]]}`;
}

export function updatedCylinderKitVersion(sku: string | null | undefined): string | null {
    if (!sku) return null;
    if (isPillarPourSku(sku)) return "pillar-pour-v1";
    if (isPillarRollOnSku(sku)) return "pillar-rollon-8f3982db65f6";
    if (jumbo28MeasuredSkus.has(sku)) return `${index.version}-jumbo28-measured-v1`;
    if (body25Skus.has(sku)) return body25.version + "-clear-refraction-v3";
    if (cylinderLargeReducerGraceSku(sku)) return "cylinder-large-reducer-refraction-v3";
    if (/^(?:GB|LB)Cyl(?:50|100)(?:Spry|AnSp|Ltn)/i.test(sku)
        && (spraySkus.has(sku) || lotionSkus.has(sku))) return "cylinder-large-clear-refraction-v3";
    if (reducer25Skus.has(sku)) return reducers25.version;
    if (sleekSkus.has(sku)) return /^GBSlk(?:50|100)(?:Spry|AnSp)/.test(sku)
        ? sleekTubes.version + "-regenerated-spray-v1" : sleekTubes.version;
    if (dropperSkus.has(sku)) return dropper.version;
    if (nineLotionSkus.has(sku)) return `${index.version}-lotion9-physical-reference-v1`;
    if (lotionSkus.has(sku)) return `${lotions.version}-separate-psd-v4`;
    if (jumboSkus.has(sku)) return `${jumbo.version}-lotion-generated-v3`;
    if (spraySkus.has(sku)) return `${sprays.version}-generated-tubes-v7`;
    return null;
}
export function approvedMasterSku(sku: string | null | undefined): string | null {
    return sku && (skus.has(sku) || isPillarPourSku(sku) || isPillarRollOnSku(sku) || cylinderLargeReducerGraceSku(sku)) ? sku : null;
}
