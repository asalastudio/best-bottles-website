/**
 * A donut with the total in the middle.
 *
 * The palette is the brand's own earth range rather than a charting library's
 * categorical brights — six warm tones that sit together on linen instead of
 * competing with it. Segment colour carries no meaning beyond "a different
 * slice"; the legend does the work, which is why it shows the figure next to
 * every label rather than making the reader estimate from an arc.
 *
 * Inline SVG for the same reason as the column chart: this is arithmetic and
 * two circles, and a library would arrive with its own visual opinions to
 * override.
 */
const SEGMENT_TONES = [
    "var(--color-obsidian)",
    "var(--color-muted-gold)",
    "var(--color-slate)",
    "var(--color-gold-dim)",
    "var(--color-champagne)",
    "var(--color-travertine)",
] as const;

export default function ExecutiveDonut({
    segments,
    centreLabel,
    size = 168,
    thickness = 26,
}: {
    segments: Array<{ label: string; value: number }>;
    centreLabel: string;
    size?: number;
    thickness?: number;
}) {
    const ordered = [...segments].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
    const total = ordered.reduce((sum, s) => sum + s.value, 0);

    if (total === 0) {
        return (
            <p className="font-sans text-[13px] leading-6 text-slate">Nothing to show yet.</p>
        );
    }

    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;

    // Offsets are folded, not accumulated in a mutable outer variable: React's
    // lint rule is right that a `let` reassigned during render misbehaves if a
    // render is interrupted and restarted, and the arcs would come out
    // overlapping. Each arc's offset is the sum of everything before it.
    const arcs = ordered.reduce<Array<{
        label: string;
        value: number;
        tone: string;
        dash: number;
        offset: number;
    }>>((acc, segment, index) => {
        const consumed = acc.reduce((sum, arc) => sum + arc.value, 0) / total;
        acc.push({
            label: segment.label,
            value: segment.value,
            tone: SEGMENT_TONES[index % SEGMENT_TONES.length],
            dash: (segment.value / total) * circumference,
            offset: -consumed * circumference,
        });
        return acc;
    }, []);

    return (
        <div className="flex flex-wrap items-center gap-6">
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                role="img"
                aria-label={`${centreLabel}: ${total.toLocaleString()} across ${ordered.length} groups`}
                className="shrink-0"
            >
                {/* Rotated so the first — largest — segment starts at twelve
                    o'clock, which is where a reader's eye lands first. */}
                <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                    {arcs.map((arc) => (
                        <circle
                            key={arc.label}
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={arc.tone}
                            strokeWidth={thickness}
                            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
                            strokeDashoffset={arc.offset}
                        >
                            <title>{`${arc.label}: ${arc.value.toLocaleString()}`}</title>
                        </circle>
                    ))}
                </g>
                <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="font-serif"
                    style={{ fontSize: size / 4.2, fill: "var(--color-obsidian)" }}
                >
                    {total.toLocaleString()}
                </text>
            </svg>

            <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-1.5 p-0">
                {arcs.map((arc) => (
                    <li key={arc.label} className="flex items-baseline gap-2">
                        <span
                            aria-hidden
                            className="mt-[3px] inline-block h-2 w-2 shrink-0 rounded-[1px]"
                            style={{ background: arc.tone }}
                        />
                        <span className="min-w-0 flex-1 truncate font-sans text-[12.5px] text-obsidian">
                            {arc.label}
                        </span>
                        <span className="shrink-0 font-sans text-[12.5px] tabular-nums text-slate">
                            {arc.value.toLocaleString()}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
