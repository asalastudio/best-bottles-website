import fs from "node:fs/promises";
import path from "node:path";

/**
 * Static paper-doll plates.
 *
 * A plate is one finished photograph of one configuration, written to
 * public/paper-doll/<family>/ by scripts/paperdoll/build_*.py and shipped
 * with the app. There is no CMS, no release gate and no runtime compositing:
 * a family is present when its manifest is on disk, and a configuration is
 * present when its row is in that manifest. The storefront reads the file.
 */

export type PlateVariant = {
    sku: string;
    graceSku: string | null;
    closure: string;
    closureLabel: string;
    color: string;
    swatch: string;
    image: string;
    thumb: string;
    imageCapOff: string | null;
    thumbCapOff: string | null;
    price: number | null;
    stock: string | null;
    applicator: string | null;
    productUrl: string | null;
    capacityMl: string | null;
    sourcePsd: string;
};

export type PlateFamilyManifest = {
    id: string;
    name: string;
    neckFinish: string;
    canvas: { width: number; height: number };
    closures: { id: string; label: string; count: number }[];
    variants: PlateVariant[];
};

export type PlateFamilySummary = {
    id: string;
    name: string;
    neckFinish: string;
    variantCount: number;
};

/** The 9 mL · 17-415 Cylinder, composited from its 26 layer PNGs. */
export const PLATE_FAMILY_CYL9 = "cylinder-9ml-17-415";

const ROOT = () => path.join(process.cwd(), "public", "paper-doll");

export async function loadPlateFamilies(): Promise<PlateFamilySummary[]> {
    try {
        return JSON.parse(await fs.readFile(path.join(ROOT(), "families.json"), "utf8"));
    } catch {
        return [];
    }
}

/** Null when the family has not been built -- never a throw, never a blank page. */
export async function loadPlateFamily(id: string): Promise<PlateFamilyManifest | null> {
    if (!/^[a-z0-9-]+$/.test(id)) return null;
    try {
        return JSON.parse(await fs.readFile(path.join(ROOT(), id, "manifest.json"), "utf8"));
    } catch {
        return null;
    }
}
