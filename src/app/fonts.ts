import { Cormorant, EB_Garamond, Montserrat } from "next/font/google";
// import localFont from "next/font/local";

/**
 * Best Bottles brand face.
 *
 * Target: TT Norms Pro (TypeType, commercial — needs the Webfont license, plus
 * the Logo license if the wordmark is set in it). Do NOT source it from GitHub
 * or a font CDN. Once the licensed WOFF2 files are placed at
 *   public/fonts/tt-norms-pro/TTNormsPro-Regular.woff2   (400)
 *   public/fonts/tt-norms-pro/TTNormsPro-Medium.woff2    (500)
 *   public/fonts/tt-norms-pro/TTNormsPro-DemiBold.woff2  (600, optional)
 * swap `brandFace` for the localFont block below and set
 * `--brand-weight-display: 500` in globals.css (Montserrat needs 600 to match
 * TT Norms Medium's presence; TT Norms itself should run at Medium).
 *
 * Until then Montserrat stands in so the type system can be reviewed live.
 */
export const brandFace = Montserrat({
    variable: "--font-brand-face",
    subsets: ["latin"],
    weight: ["400", "500", "600"],
    display: "swap",
});

// export const brandFace = localFont({
//     src: [
//         { path: "../../public/fonts/tt-norms-pro/TTNormsPro-Regular.woff2", weight: "400", style: "normal" },
//         { path: "../../public/fonts/tt-norms-pro/TTNormsPro-Medium.woff2", weight: "500", style: "normal" },
//         { path: "../../public/fonts/tt-norms-pro/TTNormsPro-DemiBold.woff2", weight: "600", style: "normal" },
//     ],
//     variable: "--font-brand-face",
//     display: "swap",
// });

/** Editorial accent only: campaign phrases, quotations, storytelling. Not for catalog, pricing, specs, filters or checkout. */
export const ebGaramond = EB_Garamond({
    variable: "--font-eb-garamond",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    style: ["normal", "italic"],
});

export const cormorant = Cormorant({
    variable: "--font-cormorant",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    style: ["normal", "italic"],
});
