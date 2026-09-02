import Bottle25Lab from "./Bottle25Lab";

export const metadata = { title: "2.5D bottle — lab" };

/**
 * The acceptance test for the 2.5D renderer, on the page:
 *
 *   ONE master (cylinder-9ml) x four glasses x two closures = eight products,
 *   from one 18 KB thickness bake and zero new bottle images.
 *
 * The silhouette must be pixel-identical across the row; only the material
 * and the closure may change.
 */
export default function Page() {
    return <Bottle25Lab />;
}
