/**
 * The format that follows a bottle family in a generated group name. A family whose own name already ends in
 * "Bottle" (Lotion Bottle, Aluminum Bottle, Plastic Bottle) must not get a second one: the default "Bottle with
 * Cap" produced "30 ml Clear Lotion Bottle Bottle with Cap" on nine groups and their Shopify titles (2026-11-07).
 * The format then keeps only what follows "Bottle" ("with Cap"), or nothing when it was "Bottle" alone.
 */
export function bottleFormatAfterFamily(family: string | null | undefined, format: string): string {
    if (!/\bbottle$/i.test((family ?? "").trim())) return format;
    return format.replace(/^bottle\b\s*/i, "").trim();
}
