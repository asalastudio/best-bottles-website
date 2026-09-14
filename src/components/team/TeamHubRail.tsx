"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import BrandWordmark from "@/components/BrandWordmark";
import {
    filterTeamHubTools,
    groupTeamHubTools,
    teamPreviewHref,
    type TeamHubTool,
} from "@/lib/teamHub";

/**
 * The Team Hub's left rail.
 *
 * Every tool lives here rather than in a grid of cards in the middle of the
 * page. A card grid makes navigation the subject of the page; staff already
 * know which tool they want, so the middle of the screen should be the work
 * waiting for them instead.
 *
 * Counts sit against the rows that have work behind them, so the rail answers
 * "where do I need to go" before anyone reads a word of the page.
 */
export default function TeamHubRail({
    tools,
    previewMode,
    counts,
    activeHref,
}: {
    tools: TeamHubTool[];
    previewMode: boolean;
    /** href → number of items waiting. Absent or zero renders nothing. */
    counts: Record<string, number>;
    activeHref?: string;
}) {
    const [query, setQuery] = useState("");
    const grouped = useMemo(
        () => groupTeamHubTools(filterTeamHubTools(tools, query)),
        [tools, query],
    );

    return (
        <nav
            aria-label="Team Hub tools"
            className="flex h-full w-full flex-col lg:w-[248px] lg:min-w-[248px]"
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
                    Team Hub
                </p>
            </div>

            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-rule)" }}>
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find a tool"
                    aria-label="Find a tool"
                    className="h-8 w-full rounded-md px-2.5 font-sans text-[13px] outline-none"
                    style={{
                        border: "1px solid var(--color-rule)",
                        background: "var(--color-surface)",
                        color: "var(--color-text-primary)",
                    }}
                />
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
                {grouped.length === 0 ? (
                    <p className="px-2 py-4 font-sans text-[12.5px]" style={{ color: "var(--color-text-muted)" }}>
                        Nothing matches “{query}”.
                    </p>
                ) : (
                    grouped.map((group) => (
                        <div key={group.section.id} className="mb-4">
                            <p
                                className="px-2 pb-1.5 font-sans text-[10.5px] font-medium uppercase tracking-[0.14em]"
                                style={{ color: "var(--color-text-muted)" }}
                            >
                                {group.section.label}
                            </p>
                            {group.tools.map((tool) => {
                                const count = counts[tool.href] ?? 0;
                                const active = activeHref === tool.href;
                                return (
                                    <a
                                        key={tool.href}
                                        href={teamPreviewHref(tool.href, previewMode)}
                                        target={tool.external ? "_blank" : undefined}
                                        rel={tool.external ? "noopener noreferrer" : undefined}
                                        aria-current={active ? "page" : undefined}
                                        className="group relative flex items-center gap-2 rounded-md px-2 py-[7px] font-sans text-[13px] transition-colors"
                                        style={{
                                            background: active ? "var(--color-surface-selected)" : "transparent",
                                            color: "var(--color-text-primary)",
                                            fontWeight: active ? 500 : 400,
                                        }}
                                    >
                                        {/* Gold means one thing across the internal
                                            surfaces: the destination you are on. */}
                                        {active && (
                                            <span
                                                aria-hidden
                                                className="absolute left-0 top-1/2 h-[18px] w-[2px] -translate-y-1/2 rounded-full"
                                                style={{ background: "var(--color-muted-gold)" }}
                                            />
                                        )}
                                        <span className="min-w-0 flex-1 truncate">
                                            {tool.name}
                                            {tool.external && (
                                                <span aria-hidden style={{ color: "var(--color-text-muted)" }}> ↗</span>
                                            )}
                                        </span>
                                        {count > 0 && (
                                            <span
                                                className="shrink-0 rounded-full px-1.5 py-[1px] font-sans text-[11px] tabular-nums"
                                                style={{
                                                    background: "var(--color-status-warning-surface)",
                                                    color: "var(--color-status-warning-text)",
                                                }}
                                            >
                                                {count}
                                            </span>
                                        )}
                                    </a>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>
        </nav>
    );
}
