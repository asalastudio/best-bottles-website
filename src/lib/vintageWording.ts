/**
 * Sentence copy from the legacy site ("Lavender Antique or Vintage style bulb sprayer with silver fittings")
 * reads "vintage-style" like the rest of the site; capitalised only where a sentence starts. No imports: the
 * Convex functions bundle this through canonicalProduct.ts.
 */
export function displayVintageWording(text: string): string {
    return text.replace(/\bantique or vintage[ -]style\b/gi, (_match, offset: number, whole: string) =>
        /(?:^|[.!?]\s+)$/.test(whole.slice(0, offset)) ? "Vintage-style" : "vintage-style");
}
