"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    filterTeamHubTools,
    groupTeamHubTools,
    type TeamHubTool,
} from "@/lib/teamHub";
import { cn } from "@/lib/utils";

function withPreview(href: string, previewMode: boolean) {
    if (!previewMode || href.startsWith("http") || !href.startsWith("/team")) return href;
    return href.includes("?") ? `${href}&preview=1` : `${href}?preview=1`;
}

function ToolRow({ tool, previewMode }: { tool: TeamHubTool; previewMode: boolean }) {
    const className = cn(
        "group flex items-start gap-4 px-4 py-3.5 transition-colors",
        "hover:bg-travertine/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold",
    );

    const body = (
        <>
            <Badge
                variant="outline"
                className="mt-0.5 shrink-0 border-champagne/70 bg-bone px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-dim"
            >
                {tool.badge}
            </Badge>
            <div className="min-w-0 flex-1">
                <p className="font-sans text-[14px] font-semibold leading-tight text-obsidian">
                    {tool.name}
                </p>
                <p className="mt-1 font-sans text-[13px] leading-5 text-slate">
                    {tool.description}
                </p>
            </div>
            <span className="shrink-0 self-center font-sans text-[13px] font-semibold text-obsidian transition-colors group-hover:text-muted-gold">
                {tool.external ? "Open ↗" : "Open →"}
            </span>
        </>
    );

    if (tool.external) {
        return (
            <a href={tool.href} target="_blank" rel="noopener noreferrer" className={className}>
                {body}
            </a>
        );
    }

    return (
        <Link href={withPreview(tool.href, previewMode)} className={className}>
            {body}
        </Link>
    );
}

export default function TeamHubDirectory({ tools, previewMode = false }: { tools: TeamHubTool[]; previewMode?: boolean }) {
    const [query, setQuery] = useState("");
    const grouped = useMemo(
        () => groupTeamHubTools(filterTeamHubTools(tools, query)),
        [query, tools],
    );

    return (
        <div className="space-y-5">
            <label className="relative block">
                <span className="sr-only">Filter tools</span>
                <MagnifyingGlass
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash"
                    weight="regular"
                />
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Filter tools, queues, or studios"
                    className="h-10 w-full rounded-md border border-champagne/70 bg-linen pl-9 pr-3 font-sans text-sm text-obsidian placeholder:text-ash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold"
                />
            </label>

            {grouped.length === 0 ? (
                <Card className="border-champagne/50 bg-linen shadow-none">
                    <CardContent className="px-5 py-8 text-sm text-slate">
                        No tools match “{query}”. Try a family, queue, or studio name.
                    </CardContent>
                </Card>
            ) : (
                grouped.map((group) => (
                    <section key={group.section.id} aria-labelledby={`team-hub-${group.section.id}`}>
                        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h2
                                    id={`team-hub-${group.section.id}`}
                                    className="font-serif text-2xl font-semibold leading-tight text-obsidian"
                                >
                                    {group.section.label}
                                </h2>
                                <p className="mt-1 max-w-2xl font-sans text-[13px] leading-5 text-slate">
                                    {group.section.description}
                                </p>
                            </div>
                            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-dim">
                                {group.tools.length} {group.tools.length === 1 ? "tool" : "tools"}
                            </p>
                        </div>
                        <Card className="overflow-hidden border-champagne/50 bg-linen shadow-[0_18px_45px_rgba(29,29,31,0.04)]">
                            <CardContent className="p-0">
                                {group.tools.map((tool, index) => (
                                    <div key={tool.href}>
                                        {index > 0 ? <Separator className="bg-champagne/40" /> : null}
                                        <ToolRow tool={tool} previewMode={previewMode} />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </section>
                ))
            )}
        </div>
    );
}
