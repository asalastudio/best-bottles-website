/**
 * A ranked list with a bar behind each value.
 *
 * For distributions where the ordering is the story and an axis would only add
 * furniture — which families the catalogue is concentrated in, say. Bars are
 * proportional to the largest row rather than to a total, so a long tail stays
 * readable instead of collapsing into a row of slivers.
 */
export default function ExecutiveRankedBars({
    rows,
    max,
}: {
    rows: Array<{ label: string; value: number }>;
    /** Defaults to the largest row. */
    max?: number;
}) {
    const ceiling = Math.max(1, max ?? Math.max(...rows.map((row) => row.value)));

    return (
        <ol className="m-0 flex list-none flex-col gap-0 p-0">
            {rows.map((row, index) => (
                <li
                    key={row.label}
                    className="grid grid-cols-[1fr_64px] items-center gap-4 border-b border-champagne/40 py-2 last:border-b-0"
                >
                    <div className="min-w-0">
                        <p className="font-sans text-[13px] text-obsidian">
                            <span className="mr-2 tabular-nums text-ash">{index + 1}</span>
                            {row.label}
                        </p>
                        <div
                            className="mt-1.5 h-[5px] rounded-[1px]"
                            style={{
                                width: `${Math.max(1, (row.value / ceiling) * 100)}%`,
                                background: "var(--color-obsidian)",
                                opacity: 0.82,
                            }}
                        />
                    </div>
                    <p className="text-right font-sans text-[13px] tabular-nums text-obsidian">
                        {row.value.toLocaleString()}
                    </p>
                </li>
            ))}
        </ol>
    );
}
