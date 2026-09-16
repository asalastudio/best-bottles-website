import { Badge } from "@/components/ui/badge";
import { PlatformStatusCard } from "@/components/team/PlatformStatusCard";
import TeamHubToday from "@/components/team/TeamHubToday";
import type { PlatformHealthSnapshot } from "@/lib/executive/platformHealth";
import type { QueueItem } from "@/lib/team/queues";
import { teamPreviewHref, type TeamHubTool } from "@/lib/teamHub";

type TeamHubDashboardProps = {
    tools: TeamHubTool[];
    previewMode?: boolean;
    platformHealth: PlatformHealthSnapshot;
    queueItems: QueueItem[];
};

/**
 * The Team Hub home.
 *
 * Navigation lives in TeamHubChrome. This page is the work waiting today —
 * queues, platform health, and the three desks staff jump to most.
 */
export function TeamHubDashboard({
    tools,
    previewMode = false,
    platformHealth,
    queueItems,
}: TeamHubDashboardProps) {
    const quickActions = tools.filter((tool) => tool.quick);

    return (
        <div className="px-5 py-8 sm:px-8 sm:py-10">
            <div className="mx-auto max-w-5xl" data-testid="team-hub-dashboard">
                <header className="mb-8">
                    <div className="flex flex-wrap items-baseline gap-3">
                        <h1 className="font-serif text-4xl leading-tight text-obsidian sm:text-[44px]">
                            Today
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
                    <p className="mt-2.5 max-w-xl font-sans text-[14px] leading-6 text-slate">
                        Queues, catalog truth, and the studios that keep Best Bottles consistent.
                    </p>
                </header>

                <TeamHubToday items={queueItems} />

                <PlatformStatusCard snapshot={platformHealth} />

                {quickActions.length > 0 ? (
                    <section aria-labelledby="team-hub-jump" className="mt-8">
                        <h2
                            id="team-hub-jump"
                            className="mb-3 font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-gold-dim"
                        >
                            Go straight to
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {quickActions.map((tool) => (
                                <a
                                    key={tool.href}
                                    href={teamPreviewHref(tool.href, previewMode)}
                                    className="inline-flex min-h-11 items-center rounded-full px-4 py-2 font-sans text-[13px] transition-colors hover:bg-travertine focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                                    style={{
                                        border: "1px solid var(--color-rule)",
                                        background: "var(--color-surface)",
                                        color: "var(--color-text-primary)",
                                    }}
                                >
                                    {tool.name}
                                </a>
                            ))}
                        </div>
                    </section>
                ) : null}

                <p className="mt-10 font-sans text-[12.5px] leading-6 text-slate">
                    Need access to a tool? Contact Jordan{" "}
                    <a
                        href="mailto:jordan@asala.ai"
                        className="font-medium text-obsidian underline decoration-champagne underline-offset-4 hover:text-muted-gold"
                    >
                        (jordan@asala.ai)
                    </a>
                    .
                </p>
            </div>
        </div>
    );
}
