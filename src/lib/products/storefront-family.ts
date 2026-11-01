/** Storefront grouping only. Source records, product slugs and body identities stay intact. */
export function storefrontFamily(family: string): string {
    return family === "Tulip" ? "Cylinder" : family;
}
export function sourceFamilies(family: string): string[] {
    return storefrontFamily(family) === "Cylinder" ? ["Cylinder", "Tulip"] : [family];
}
export function withStorefrontFamily<T extends { family?: string | null }>(row: T): T {
    return row.family === "Tulip" ? { ...row, family: "Cylinder" } : row;
}
/** Geometry and sibling discovery still use the original Tulip source. */
export function sourceFamilyForProduct(slug: string, family: string): string {
    return /^tulip-(?:5|6)ml-/.test(slug) ? "Tulip" : family;
}
