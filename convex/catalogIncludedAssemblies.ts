import assemblies from "./catalog-included-assemblies.json";

type Identity = {
    websiteSku?: string | null; graceSku?: string | null; family?: string | null;
    capacityMl?: number | null; color?: string | null; neckThreadSize?: string | null;
    applicator?: string | null; capColor?: string | null; category?: string | null;
};

/** A catalogued complete bottle is proof of its OWN included hardware, not
 * evidence that this hardware is sold loose or fits any sibling bottle.
 * Every exception has an exact current source page and identity witness.
 * Ordering always uses the assembly's SKU, price and Shopify variant.
 */
export function catalogIncludedAssembly(product: Identity) {
    if (product.category !== "Glass Bottle") return null;
    return assemblies.find(source => source.websiteSku === product.websiteSku && source.graceSku === product.graceSku
        && source.family === product.family && source.capacityMl === product.capacityMl && source.color === product.color
        && source.neckThreadSize === product.neckThreadSize && source.applicator === (product.applicator ?? null)
        && source.capColor === product.capColor) ?? null;
}
