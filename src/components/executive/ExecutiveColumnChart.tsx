/**
 * A column chart in the board's register.
 *
 * Inline SVG rather than a charting library: the whole visual language here is
 * a handful of tokens and a serif, and a library would arrive with its own
 * palette, its own tooltips and its own idea of what a chart looks like — then
 * need overriding into submission. It also keeps the page free of a runtime
 * dependency for what is arithmetic and rectangles.
 *
 * Empty buckets are drawn, not skipped. A series that quietly omits the months
 * with nothing in them draws a busier business than exists.
 */
export default function ExecutiveColumnChart({
    series,
    /** Optional second value per bar, drawn in a muted tone beneath the first. */
    highlightLabel,
    height = 132,
    format = (value: number) => value.toLocaleString(),
}: {
    series: Array<{ label: string; value: number; suspect?: number }>;
    highlightLabel?: string;
    height?: number;
    format?: (value: number) => string;
}) {
    const max = Math.max(1, ...series.map((point) => point.value));
    const barGap = 3;
    const width = 720;
    const barWidth = Math.max(2, width / series.length - barGap);
    const hasSuspect = series.some((point) => (point.suspect ?? 0) > 0);

    return (
        <figure className="m-0">
            <svg
                viewBox={`0 0 ${width} ${height + 22}`}
                className="w-full"
                role="img"
                aria-label={`Column chart, peak ${format(max)}`}
                preserveAspectRatio="none"
            >
                {/* Three guides, not a full grid — enough to read height against
                    without turning the figure into graph paper. */}
                {[0, 0.5, 1].map((fraction) => (
                    <line
                        key={fraction}
                        x1={0}
                        x2={width}
                        y1={height - fraction * height}
                        y2={height - fraction * height}
                        stroke="var(--color-champagne)"
                        strokeWidth={1}
                        opacity={fraction === 0 ? 0.9 : 0.45}
                    />
                ))}

                {series.map((point, index) => {
                    const barHeight = (point.value / max) * (height - 6);
                    const suspectHeight = ((point.suspect ?? 0) / max) * (height - 6);
                    const x = index * (barWidth + barGap);
                    return (
                        <g key={`${point.label}-${index}`}>
                            {point.value > 0 && (
                                <rect
                                    x={x}
                                    y={height - barHeight}
                                    width={barWidth}
                                    height={barHeight}
                                    fill="var(--color-obsidian)"
                                    opacity={0.88}
                                />
                            )}
                            {/* The suspect portion sits inside the same bar in
                                gold, so the reader sees what share of a day's
                                signups was the script. */}
                            {suspectHeight > 0 && (
                                <rect
                                    x={x}
                                    y={height - suspectHeight}
                                    width={barWidth}
                                    height={suspectHeight}
                                    fill="var(--color-muted-gold)"
                                />
                            )}
                            <title>{`${point.label}: ${format(point.value)}`}</title>
                        </g>
                    );
                })}
            </svg>

            <div className="mt-1.5 flex justify-between font-sans text-[10.5px] text-ash">
                <span>{series[0]?.label}</span>
                <span>{series[series.length - 1]?.label}</span>
            </div>

            {hasSuspect && highlightLabel ? (
                <figcaption className="mt-2 flex items-center gap-2 font-sans text-[12px] text-slate">
                    <span
                        aria-hidden
                        className="inline-block h-2 w-2 rounded-[1px]"
                        style={{ background: "var(--color-muted-gold)" }}
                    />
                    {highlightLabel}
                </figcaption>
            ) : null}
        </figure>
    );
}
