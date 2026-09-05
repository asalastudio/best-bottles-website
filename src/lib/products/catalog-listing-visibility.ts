// These two legacy 5.5 mL Cylinder groups duplicate the 5 mL presentation.
// Hide only their browse cards; retain the records, SKUs, and direct PDP routes
// until the underlying product-group reconciliation is completed.
const HIDDEN_CATALOG_GROUPS = new Set([
    "cylinder-5.5ml-clear-13-415-finemist",
    "cylinder-5.5ml-clear-13-415",
]);

export function isHiddenCatalogGroup(slug: string): boolean {
    return HIDDEN_CATALOG_GROUPS.has(slug);
}
