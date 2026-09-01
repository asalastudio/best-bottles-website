/**
 * Line glyphs for the closure types we actually sell.
 *
 * Drawn rather than borrowed. Phosphor is the house icon set and two of its
 * glyphs genuinely fit — SprayBottle and Eyedropper — but there is no honest
 * Phosphor icon for a roll-on cap, a lotion pump, a reducer or a short cap,
 * and reaching for Tag or Package to mean "cap" makes a grid of closures that
 * all look like something else. These are ten shapes we manufacture; ten
 * 16px outlines are cheaper than the confusion.
 *
 * They share Phosphor's conventions on purpose so they sit beside it without
 * looking foreign: 24x24 viewBox, 1.75 stroke, round caps and joins,
 * currentColor, no fills.
 *
 * The keys are the component group keys componentUtils actually produces —
 * Sprayer, Roll-On Cap, Cap, Lotion Pump, Short Cap, Antique Bulb Sprayer,
 * Reducer, Dropper, Metal Roller, Plastic Roller — measured from the catalog,
 * not invented. Anything unrecognised gets the neutral closure outline rather
 * than disappearing.
 */

type Props = { type: string; size?: number; className?: string };

const S = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
};

/** shoulders + neck shared by most closures, so the family reads as one set */
function Neck() {
    return <path d="M9 9h6M9 9v-2h6v2" {...S} />;
}

const GLYPHS: Record<string, () => React.ReactElement> = {
    // trigger head with a nozzle and the mist leaving it
    Sprayer: () => (
        <>
            <path d="M10 7V5h4v2" {...S} />
            <path d="M14 6h3.5v1.5H14" {...S} />
            <path d="M9 9h6v3H9z" {...S} />
            <path d="M10.5 12v7h3v-7" {...S} />
            <path d="M19 5.2h1.6M19 7.4h1.6" {...S} />
        </>
    ),
    // same head, bulb instead of a trigger
    "Antique Bulb Sprayer": () => (
        <>
            <circle cx="18" cy="8" r="2.6" {...S} />
            <path d="M15.4 8h-1.6" {...S} />
            <path d="M9 9h5v3H9z" {...S} />
            <path d="M10.5 12v7h3v-7" {...S} />
        </>
    ),
    // ball seated in the collar — the defining feature
    "Roll-On Cap": () => (
        <>
            <circle cx="12" cy="7.5" r="2.8" {...S} />
            <path d="M8.6 9.4h6.8v2.6H8.6z" {...S} />
            <path d="M10 12v7h4v-7" {...S} />
        </>
    ),
    "Metal Roller": () => GLYPHS["Roll-On Cap"](),
    "Plastic Roller": () => GLYPHS["Roll-On Cap"](),
    // down-stroke spout over a collar
    "Lotion Pump": () => (
        <>
            <path d="M12 4v3" {...S} />
            <path d="M12 7h4.5v2H14" {...S} />
            <path d="M9 9h6v3H9z" {...S} />
            <path d="M10.5 12v7h3v-7" {...S} />
        </>
    ),
    // pipette in a bulb
    Dropper: () => (
        <>
            <path d="M10.5 4h3v3.5h-3z" {...S} />
            <path d="M9 7.5h6v2.5H9z" {...S} />
            <path d="M12 10v9" {...S} />
            <path d="M10.6 19h2.8" {...S} />
        </>
    ),
    // a plain screw cap: knurled skirt
    Cap: () => (
        <>
            <path d="M7.5 7h9v9h-9z" {...S} />
            <path d="M9.6 9v5M12 9v5M14.4 9v5" {...S} />
        </>
    ),
    // the same, squat
    "Short Cap": () => (
        <>
            <path d="M7.5 9h9v5.5h-9z" {...S} />
            <path d="M9.6 10.6v2.4M12 10.6v2.4M14.4 10.6v2.4" {...S} />
        </>
    ),
    // an orifice narrowing into the neck
    Reducer: () => (
        <>
            <path d="M8 7h8l-2.2 4h-3.6z" {...S} />
            <path d="M10.2 11v7h3.6v-7" {...S} />
            <circle cx="12" cy="7" r="0.9" {...S} />
        </>
    ),
};

/** unrecognised group key — a closure outline, never a blank */
function Fallback() {
    return (
        <>
            <path d="M8.5 8h7v8h-7z" {...S} />
            <Neck />
        </>
    );
}

export function ClosureIcon({ type, size = 16, className }: Props) {
    const draw = GLYPHS[type] ?? Fallback;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24"
             aria-hidden="true" focusable="false" className={className}>
            {draw()}
        </svg>
    );
}

/** "Bottle only" is a real choice, so it gets a real mark: the bottle alone. */
export function BottleOnlyIcon({ size = 16, className }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24"
             aria-hidden="true" focusable="false" className={className}>
            <path d="M10.5 4h3v3h-3z" {...S} />
            <path d="M9 7h6v12a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" {...S} />
        </svg>
    );
}
