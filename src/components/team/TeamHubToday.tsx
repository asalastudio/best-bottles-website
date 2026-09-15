import Link from "next/link";
import type { QueueItem } from "@/lib/team/queues";

/**
 * What needs a person today.
 *
 * Set in the register Faire uses for figures rather than as a row of stat
 * cards: the numeral and the noun it counts share the same serif at the same
 * size, with the explanation beneath in small grey. No icons, no borders
 * around each figure, no percentage deltas — those are the marks of a generic
 * admin template, and they add decoration to a number that should carry
 * itself.
 *
 * An empty queue is not rendered as a zero. A wall of noughts trains people to
 * stop reading the band, so when everything is clear the band says so in a
 * sentence instead.
 */
export default function TeamHubToday({ items }: { items: QueueItem[] }) {
    if (items.length === 0) {
        return (
            <section
                aria-labelledby="team-hub-today"
                className="mb-8 rounded-lg px-7 py-8"
                style={{ background: "var(--color-travertine)" }}
            >
                <h2 id="team-hub-today" className="font-serif text-2xl leading-tight text-obsidian">
                    Nothing is waiting
                </h2>
                <p className="mt-2 max-w-xl font-sans text-[13.5px] leading-6 text-slate">
                    No certificates to review, no submitted orders outstanding, and every wholesale
                    account is set up to order. This band fills in as work arrives.
                </p>
            </section>
        );
    }

    return (
        <section
            aria-labelledby="team-hub-today"
            className="mb-8 rounded-lg px-7 py-8"
            style={{ background: "var(--color-travertine)" }}
        >
            <h2
                id="team-hub-today"
                className="mb-6 font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-gold-dim"
            >
                Waiting on someone
            </h2>

            <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                    <Link
                        key={item.id}
                        href={item.href}
                        className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                    >
                        {/* Numeral and noun share one serif line, the way Faire
                            sets "100,000 brands" — the number is not a badge
                            bolted onto a label. */}
                        <p className="font-serif text-[40px] leading-[1.05] text-obsidian group-hover:text-gold-dim transition-colors">
                            {item.count.toLocaleString()}{" "}
                            <span className="text-[26px]">{item.label}</span>
                        </p>
                        <p className="mt-2 max-w-[34ch] font-sans text-[12.5px] leading-5 text-slate">
                            {item.meaning}
                        </p>
                    </Link>
                ))}
            </div>
        </section>
    );
}
