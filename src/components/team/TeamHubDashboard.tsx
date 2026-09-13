import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformStatusCard } from "@/components/team/PlatformStatusCard";
import type { PlatformHealthSnapshot } from "@/lib/executive/platformHealth";
import { groupTeamHubTools, teamPreviewHref, type TeamHubTool } from "@/lib/teamHub";

type TeamHubDashboardProps = {
    tools: TeamHubTool[];
    previewMode?: boolean;
    platformHealth: PlatformHealthSnapshot;
};

function ToolCard({ tool, previewMode }: { tool: TeamHubTool; previewMode: boolean }) {
    const href = teamPreviewHref(tool.href, previewMode);
    const className =
        "group flex min-h-40 flex-col border border-champagne/50 bg-linen px-5 py-5 shadow-[0_18px_45px_rgba(29,29,31,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-muted-gold/50 hover:shadow-[0_22px_60px_rgba(29,29,31,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold";

    const body = (
        <>
            <Badge
                variant="outline"
                className="w-fit border-champagne/70 bg-bone px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-dim"
            >
                {tool.badge}
            </Badge>
            <h3 className="mt-3 font-serif text-2xl font-semibold leading-tight text-obsidian">
                {tool.name}
            </h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate">{tool.description}</p>
            <span className="mt-4 text-sm font-semibold text-obsidian transition-colors group-hover:text-muted-gold">
                {tool.external ? "Open ↗" : "Open →"}
            </span>
        </>
    );

    if (tool.external) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                {body}
            </a>
        );
    }

    return (
        <a href={href} className={className}>
            {body}
        </a>
    );
}

export function TeamHubDashboard({ tools, previewMode = false, platformHealth }: TeamHubDashboardProps) {
    const quickActions = tools.filter((tool) => tool.quick);
    const grouped = groupTeamHubTools(tools);

    return (
        <main data-team-hub className="min-h-screen bg-bone px-5 py-8 sm:px-8 sm:py-10">
            <div className="mx-auto max-w-6xl" data-testid="team-hub-dashboard">
                <header className="mb-6 flex flex-col gap-4 border-b border-champagne/40 pb-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-gold">
                            Best Bottles
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="font-serif text-4xl leading-tight text-obsidian sm:text-5xl">
                                Team Hub
                            </h1>
                            {previewMode ? (
                                <Badge
                                    variant="outline"
                                    className="border-muted-gold/40 bg-linen px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-dim"
                                >
                                    Local preview mode
                                </Badge>
                            ) : null}
                        </div>
                        <p className="mt-3 max-w-xl font-sans text-sm leading-6 text-slate">
                            Operational home for queues, catalog truth, and the studios that keep Best Bottles consistent.
                        </p>
                    </div>
                    <p className="font-sans text-sm leading-6 text-slate lg:text-right">
                        Need access to a tool? Contact Jordan{" "}
                        <a
                            href="mailto:jordan@asala.ai"
                            className="font-medium text-obsidian underline decoration-champagne underline-offset-4 hover:text-muted-gold"
                        >
                            (jordan@asala.ai)
                        </a>
                        .
                    </p>
                </header>

                <PlatformStatusCard snapshot={platformHealth} />

                {quickActions.length > 0 ? (
                    <section aria-labelledby="team-hub-today" className="mb-8">
                        <div className="mb-3">
                            <h2 id="team-hub-today" className="font-serif text-2xl font-semibold text-obsidian">
                                Today
                            </h2>
                            <p className="mt-1 font-sans text-[13px] text-slate">
                                Start with the work that usually needs a person first.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {quickActions.map((tool) => (
                                <a
                                    key={tool.href}
                                    href={teamPreviewHref(tool.href, previewMode)}
                                    className="rounded-md border border-champagne/60 bg-linen px-4 py-3 text-left transition hover:border-muted-gold/50 hover:bg-travertine/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                                >
                                    <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-dim">
                                        {tool.badge}
                                    </span>
                                    <span className="mt-1 block font-sans text-sm font-semibold text-obsidian">
                                        {tool.name}
                                    </span>
                                </a>
                            ))}
                        </div>
                    </section>
                ) : null}

                <div className="space-y-8" data-testid="team-hub-cards">
                    {grouped.map((group) => (
                        <section key={group.section.id} aria-labelledby={`team-hub-${group.section.id}`}>
                            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
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
                            <div className="grid gap-3 md:grid-cols-2">
                                {group.tools.map((tool) => (
                                    <Card
                                        key={tool.href}
                                        className="border-0 bg-transparent p-0 shadow-none"
                                    >
                                        <CardContent className="p-0">
                                            <ToolCard tool={tool} previewMode={previewMode} />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </main>
    );
}
