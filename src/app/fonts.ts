import localFont from "next/font/local";

/**
 * Site typefaces, self-hosted from public/fonts (see public/fonts/README.md).
 *
 * These used to come from `next/font/google`, which downloads each family from
 * Google Fonts while `next build` runs. On 2026-09-25 that fetch failed on
 * Vercel ("TypeError: Cannot read properties of null (reading '1')" inside
 * next/font's Google loader) and took a preview deployment down with it. The
 * WOFF2 files now live in the repo, so a build needs nothing from the network
 * and every environment ships byte-identical fonts. Runtime is unchanged:
 * next/font self-hosted the Google files too.
 *
 * Brand face target: TT Norms Pro (TypeType, commercial — needs the Webfont
 * license, plus the Logo license if the wordmark is set in it). Do NOT source
 * it from GitHub or a font CDN. Once the licensed WOFF2 files are placed at
 *   public/fonts/tt-norms-pro/TTNormsPro-Regular.woff2   (400)
 *   public/fonts/tt-norms-pro/TTNormsPro-Medium.woff2    (500)
 *   public/fonts/tt-norms-pro/TTNormsPro-DemiBold.woff2  (600, optional)
 * point `brandFace` at them and set `--brand-weight-display: 500` in
 * globals.css (Montserrat needs 600 to match TT Norms Medium's presence; TT
 * Norms itself should run at Medium). Until then Montserrat stands in so the
 * type system can be reviewed live.
 */
export const brandFace = localFont({
    src: [{ path: "../../public/fonts/montserrat/montserrat-latin-wght-normal.woff2", weight: "100 900", style: "normal" }],
    variable: "--font-brand-face",
    display: "swap",
    adjustFontFallback: "Arial",
});

/** Editorial accent only: campaign phrases, quotations, storytelling. Not for catalog, pricing, specs, filters or checkout. */
export const ebGaramond = localFont({
    src: [
        { path: "../../public/fonts/eb-garamond/eb-garamond-latin-wght-normal.woff2", weight: "400 800", style: "normal" },
        { path: "../../public/fonts/eb-garamond/eb-garamond-latin-wght-italic.woff2", weight: "400 800", style: "italic" },
    ],
    variable: "--font-eb-garamond",
    display: "swap",
    preload: false,
    adjustFontFallback: "Times New Roman",
});

export const cormorant = localFont({
    src: [
        { path: "../../public/fonts/cormorant/cormorant-latin-wght-normal.woff2", weight: "300 700", style: "normal" },
        { path: "../../public/fonts/cormorant/cormorant-latin-wght-italic.woff2", weight: "300 700", style: "italic" },
    ],
    variable: "--font-cormorant",
    display: "swap",
    preload: false,
    adjustFontFallback: "Times New Roman",
});
