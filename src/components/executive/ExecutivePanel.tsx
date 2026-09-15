import Link from "next/link";

/**
 * One card in the board's grid.
 *
 * The board used to be full-width sections stacked down a long page, which
 * meant an executive scrolled past three things to reach the fourth. Panels of
 * a fixed rhythm in a two-column grid put the whole business on one or two
 * screens instead — the Vercel Analytics arrangement, where each panel is small
 * enough to read whole and no panel scrolls inside itself.
 */
export default function ExecutivePanel({
    eyebrow,
    title,
    action,
    children,
    wide = false,
}: {
    eyebrow?: string;
    title: string;
    /** A way out to the system that owns this panel's numbers. */
    action?: { label: string; href: string; external?: boolean };
    children: React.ReactNode;
    wide?: boolean;
}) {
    return (
        <section
            className={`rounded-lg border px-5 py-4 ${wide ? "lg:col-span-2" : ""}`}
            style={{ borderColor: "var(--color-rule)", background: "var(--color-surface)" }}
        >
            <header className="mb-3.5 flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                    {eyebrow ? (
                        <p className="mb-1 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-dim">
                            {eyebrow}
                        </p>
                    ) : null}
                    <h2 className="font-serif text-[19px] leading-tight text-obsidian">{title}</h2>
                </div>
                {action ? (
                    action.external ? (
                        <a
                            href={action.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 font-sans text-[12px] text-gold-dim underline underline-offset-4 hover:text-obsidian"
                        >
                            {action.label}
                        </a>
                    ) : (
                        <Link
                            href={action.href}
                            className="shrink-0 font-sans text-[12px] text-gold-dim underline underline-offset-4 hover:text-obsidian"
                        >
                            {action.label}
                        </Link>
                    )
                ) : null}
            </header>
            {children}
        </section>
    );
}
