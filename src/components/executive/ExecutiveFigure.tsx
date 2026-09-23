import type { MetricAvailability } from "@/lib/executive/commerce";

/**
 * One figure on the executive board.
 *
 * Numeral and noun share a serif line, with the explanation beneath in small
 * grey — the register Faire uses for figures, and deliberately not a bordered
 * stat tile with an icon and a percentage delta. A delta against a period we
 * have no data for would be the fixture problem returning by another route.
 *
 * `availability` is what stops a missing source rendering as a confident zero.
 * "We have not connected this" and "this is zero" are different facts, and a
 * board that draws them identically is lying about the second one.
 */
export default function ExecutiveFigure({
    value,
    unit,
    label,
    availability,
    emphasis = "normal",
}: {
    /** Pre-formatted. Null renders as an em dash, never as 0. */
    value: string | null;
    /** The noun, set smaller on the same line. */
    unit?: string;
    label: string;
    availability?: MetricAvailability;
    emphasis?: "normal" | "quiet";
}) {
    const unavailable = availability?.state === "unavailable" || value === null;

    return (
        <div>
            <p
                className={`font-serif leading-[1.05] ${
                    emphasis === "quiet" ? "text-[28px] text-slate" : "text-[40px] text-obsidian"
                }`}
            >
                {unavailable ? <span className="text-ash">—</span> : value}
                {!unavailable && unit ? (
                    <span className={emphasis === "quiet" ? "text-[20px]" : "text-[26px]"}> {unit}</span>
                ) : null}
            </p>
            <p className="mt-1.5 font-sans text-[12.5px] font-medium text-obsidian">{label}</p>
            {availability && availability.state !== "live" ? (
                <p className="mt-1 max-w-[34ch] font-sans text-[12px] leading-5 text-slate">
                    {availability.note}
                </p>
            ) : null}
        </div>
    );
}
