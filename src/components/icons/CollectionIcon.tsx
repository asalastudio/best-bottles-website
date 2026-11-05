/*
 * Line icons for the shop collections (Jordan, 4 Nov 2026: "a simple SVG tasteful icon for roll-on, sample vials,
 * apothecary bottles, etc."). One drawing style: a 24-unit grid, a fine stroke in currentColor, rounded joins, no fill,
 * so they sit with the family shape icons (FamilyShapeIcon) and take the text colour around them.
 */
import type { SVGProps } from "react";

type Props = { collection: string; size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, "children">;

const PATHS: Record<string, string[]> = {
    // A short bottle with its roller ball seated in the neck.
    "roll-on-bottles": ["M8.5 9.5h7v11a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1z", "M10 9.5V7.5h4v2", "M12 5.5m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0"],
    // A slim travel atomizer: long metal case, collar, actuator.
    "perfume-atomizers": ["M9.5 7.5h5v13a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1z", "M9.5 11h5", "M10.5 7.5V5.5h3v2", "M11.2 5.5V3.5h1.6v2"],
    // A glass bottle with a fine-mist head and a little mist.
    "glass-spray-bottles": ["M7 11.5h8v9a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z", "M9 11.5V9.5h4v2", "M9.8 9.5V6.5h2.4v3", "M12.2 7.6h1.2", "M15.6 6.6h.01M17.4 5.6h.01M17.4 7.6h.01M19.2 6.6h.01"],
    // A bottle with a dropper: rounded bulb over a collar.
    "dropper-bottles": ["M7.5 12h9v8.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1z", "M9.5 12v-2h5v2", "M10.5 10V7.2a1.5 1.5 0 0 1 3 0V10", "M12 12v6.5"],
    // Two slim vials with plugs, one taller.
    "sample-vials": ["M7.5 8h3v12.5a1.5 1.5 0 0 1-3 0z", "M7.2 8h3.6V5.8H7.2z", "M13.5 10.5h3v10a1.5 1.5 0 0 1-3 0z", "M13.2 10.5h3.6V8.3h-3.6z"],
    // A bottle with a lotion pump and its spout.
    "lotion-pump-bottles": ["M7.5 12h8v8.5a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1z", "M9.5 12v-2h4v2", "M10.5 10V6.5h2v3.5", "M10 6.5h5.5", "M15.5 6.5v1.2"],
    // A splash bottle: a flat stopper over a wide neck, and a drop.
    "splash-on-bottles": ["M6.5 11h9v9.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1z", "M8.5 11V9h5v2", "M8 9h6", "M9 7.2h4V9H9z", "M18.5 12.5c-.9 1.1-1.4 1.9-1.4 2.6a1.4 1.4 0 0 0 2.8 0c0-.7-.5-1.5-1.4-2.6z"],
    // A heart-shaped decorative bottle with a short neck and cap.
    "decorative-bottles": ["M12 21s-6.5-4.1-6.5-8.6a3.3 3.3 0 0 1 6.5-.9a3.3 3.3 0 0 1 6.5.9C18.5 16.9 12 21 12 21z", "M10.8 9.4V7.8h2.4v1.6", "M10.3 7.8V5.8h3.4v2"],
    // An apothecary bottle with a round glass stopper.
    "apothecary-bottles": ["M7 12.5c0-1.5 1.5-2.5 3-2.5h4c1.5 0 3 1 3 2.5v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z", "M10.5 10V8.5h3V10", "M12 6.2m-1.8 0a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0"],
    // A squat cream jar with its lid.
    "cream-jars": ["M5.5 13h13v6.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z", "M5 10.2h14a.8.8 0 0 1 .8.8v1.2a.8.8 0 0 1-.8.8H5a.8.8 0 0 1-.8-.8V11a.8.8 0 0 1 .8-.8z", "M8 16.5h8"],
    // A gift box with ribbon: loose components, tools, bags and boxes.
    "accessories-packaging": ["M5 10.5h14v3H5z", "M6 13.5h12v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z", "M12 10.5v11", "M12 10.5c-1.2-2.6-4.4-3.3-4.4-1.2c0 1.1 2.2 1.2 4.4 1.2zM12 10.5c1.2-2.6 4.4-3.3 4.4-1.2c0 1.1-2.2 1.2-4.4 1.2z"],
};

export const COLLECTION_ICON_KEYS = Object.keys(PATHS);

export default function CollectionIcon({ collection, size = 24, strokeWidth = 1.25, ...rest }: Props) {
    const paths = PATHS[collection];
    if (!paths) return null;
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
            {paths.map((d) => <path key={d} d={d} />)}
        </svg>
    );
}
