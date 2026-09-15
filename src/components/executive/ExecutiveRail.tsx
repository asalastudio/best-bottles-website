"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandWordmark from "@/components/BrandWordmark";

export type ExecutiveRailSection = { id: string; label: string };

/**
 * The executive board's left rail.
 *
 * Deliberately the same shape and tokens as the Team Hub's rail: a person who
 * moves between the two should not have to relearn where things are. What it
 * holds differs — the team rail lists tools, this one lists the board's own
 * sections plus the systems the figures come from.
 *
 * The current section is tracked by observing the headings rather than by
 * listening to scroll offsets, which stay wrong the moment a section's height
 * changes.
 */
export default function ExecutiveRail({
    sections,
    sources,
}: {
    sections: ExecutiveRailSection[];
    sources: Array<{ label: string; href: string }>;
}) {
    const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);

    useEffect(() => {
        const headings = sections
            .map((section) => document.getElementById(section.id))
            .filter((element): element is HTMLElement => element !== null);
        if (headings.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                // The topmost heading currently in the upper half of the
                // viewport is the one being read.
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActive(visible[0].target.id);
            },
            { rootMargin: "0px 0px -55% 0px", threshold: 0 },
        );

        for (const heading of headings) observer.observe(heading);
        return () => observer.disconnect();
    }, [sections]);

    return (
        <nav
            aria-label="Executive board"
            className="flex w-full flex-col lg:sticky lg:top-0 lg:h-screen lg:w-[244px] lg:min-w-[244px]"
            style={{
                background: "var(--color-surface-rail)",
                borderRight: "1px solid var(--color-rule)",
            }}
        >
            <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid var(--color-rule)" }}>
                <Link href="/" aria-label="Best Bottles home" className="block">
                    <BrandWordmark className="app-wordmark" />
                </Link>
                <p className="mt-1.5 font-sans text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                    Executive
                </p>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
                <p
                    className="px-2 pb-1 font-sans text-[10px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: "var(--color-text-muted)" }}
                >
                    The business
                </p>
                {sections.map((section) => {
                    const isActive = active === section.id;
                    return (
                        <a
                            key={section.id}
                            href={`#${section.id}`}
                            aria-current={isActive ? "true" : undefined}
                            className="relative flex items-center rounded-md px-2 py-[6px] font-sans text-[13px] leading-[1.35] transition-colors hover:bg-[color:var(--color-surface-sunken)]"
                            style={{
                                background: isActive ? "var(--color-surface-selected)" : "transparent",
                                color: "var(--color-text-primary)",
                                fontWeight: isActive ? 500 : 400,
                            }}
                        >
                            {/* Gold marks the current destination here exactly as
                                it does in the portal and team rails. */}
                            {isActive && (
                                <span
                                    aria-hidden
                                    className="absolute left-0 top-1/2 h-[18px] w-[2px] -translate-y-1/2 rounded-full"
                                    style={{ background: "var(--color-muted-gold)" }}
                                />
                            )}
                            {section.label}
                        </a>
                    );
                })}

                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--color-rule)" }}>
                    <p
                        className="px-2 pb-1 font-sans text-[10px] font-semibold uppercase tracking-[0.16em]"
                        style={{ color: "var(--color-text-muted)" }}
                    >
                        Sources
                    </p>
                    {sources.map((source) => (
                        <a
                            key={source.href}
                            href={source.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center rounded-md px-2 py-[6px] font-sans text-[13px] leading-[1.35] transition-colors hover:bg-[color:var(--color-surface-sunken)]"
                            style={{ color: "var(--color-text-primary)" }}
                        >
                            {source.label}
                            <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                    ))}
                </div>
            </div>

            {/* Extra bottom room: the Grace launcher is fixed to the lower
                left and would otherwise sit on top of this link. */}
            <div className="px-3 pb-16 pt-2" style={{ borderTop: "1px solid var(--color-rule)" }}>
                <Link
                    href="/team"
                    className="flex items-center rounded-md px-2 py-[6px] font-sans text-[13px] transition-colors hover:bg-[color:var(--color-surface-sunken)]"
                    style={{ color: "var(--color-text-secondary)" }}
                >
                    Team Hub
                </Link>
            </div>
        </nav>
    );
}
