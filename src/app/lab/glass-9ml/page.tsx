import GlassNineLab from "./GlassNineLab";

export const metadata = { title: "Glass on the 9 mL — lab" };

/**
 * Does three.js glass make the flat paper-doll better?
 *
 * Three treatments of one SKU, side by side, so the question can be answered by
 * looking rather than by arguing:
 *
 *   photo    the kit as it ships — body, fitment and cap, all photographed
 *   hybrid   the BODY rendered as real glass (transmission, IOR 1.52,
 *            dispersion) with the photographed fitment and cap on top
 *   3D       everything modelled, for reference
 *
 * The hybrid is the one worth judging. It is the plan's tier 2: keep the
 * photography that makes a cap look like metal, and replace only the part where
 * a flat photograph has least to say — the glass, which is mostly refraction.
 */
export default function Page() {
    return <GlassNineLab />;
}
