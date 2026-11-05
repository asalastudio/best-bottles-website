/*
 * Bottle-family shape icons (Jordan, 4 Nov 2026: "the shapes of the bottle as icons" in the Bottle Family filter and
 * menus). Each traced family is its real silhouette: the clear glass body the product pages draw, traced and
 * simplified (scripts/icons/trace-family-shapes.py -> family-shape-paths.generated.json), all on one 24-unit grid and
 * one baseline. Families with no register body are drawn here in the same style. Same stroke as CollectionIcon.
 */
import type { SVGProps } from "react";
import traced from "@/lib/catalog/family-shape-paths.generated.json";

type Props = { family: string; size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, "children">;

const DRAWN: Record<string, string[]> = {
    // A slim tube vial with a plug.
    Vial: ["M10.2 7.5h3.6v12.7a1.8 1.8 0 0 1-3.6 0z", "M9.9 7.5h4.2V4.5H9.9z"],
    // A shouldered apothecary bottle with a ball stopper.
    Apothecary: ["M7.3 13c0-2 1.8-3.2 3.4-3.2V8.2h2.6v1.6c1.6 0 3.4 1.2 3.4 3.2v8.2a.8.8 0 0 1-.8.8H8.1a.8.8 0 0 1-.8-.8z", "M12 5.6m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0"],
    // A tall lotion bottle body.
    "Lotion Bottle": ["M8.2 8.5c0-1 .8-1.6 1.8-1.6V4.5h4v2.4c1 0 1.8.6 1.8 1.6v12.7a.8.8 0 0 1-.8.8H9a.8.8 0 0 1-.8-.8z"],
    // Pillar: a straight column bottle with a heavy base.
    Pillar: ["M8.6 7.8h6.8v13.4a.8.8 0 0 1-.8.8H9.4a.8.8 0 0 1-.8-.8z", "M8.6 19.2h6.8", "M10.6 7.8V4.5h2.8v3.3"],
    // The "Unique Shapes" group: three small silhouettes together.
    "Unique Shapes": ["M3.5 13.5h5v7.7a.8.8 0 0 1-.8.8H4.3a.8.8 0 0 1-.8-.8z", "M5.2 13.5v-2h1.6v2",
        "M12 9.8c2.5 0 3.6 2.3 3.6 5.3c0 3.4-1.3 6.9-3.6 6.9s-3.6-3.5-3.6-6.9c0-3 1.1-5.3 3.6-5.3z", "M11.2 9.9V7.8h1.6v2.1",
        "M16.5 14.6l2.5-1.6l2.5 1.6v6.6a.8.8 0 0 1-.8.8h-3.4a.8.8 0 0 1-.8-.8z", "M18.2 13.1v-1.6h1.6v1.6"],
};
const GENERIC = ["M8.2 10c0-1.2 1-2 2-2V5.5h3.6V8c1 0 2 .8 2 2v11.2a.8.8 0 0 1-.8.8H9a.8.8 0 0 1-.8-.8z"];

export function hasFamilyShape(family: string): boolean {
    return family in (traced as Record<string, string>) || family in DRAWN;
}

export default function FamilyShapeIcon({ family, size = 24, strokeWidth = 1.25, ...rest }: Props) {
    const fromTrace = (traced as Record<string, string>)[family];
    const paths = fromTrace ? [fromTrace] : DRAWN[family] ?? GENERIC;
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
            {paths.map((d) => <path key={d} d={d} />)}
        </svg>
    );
}
