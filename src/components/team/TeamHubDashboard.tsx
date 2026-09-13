import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlatformStatusCard } from "@/components/team/PlatformStatusCard";
import TeamHubDirectory from "@/components/team/TeamHubDirectory";
import type { PlatformHealthSnapshot } from "@/lib/executive/platformHealth";
import type { TeamHubTool } from "@/lib/teamHub";

type TeamHubDashboardProps = {
    tools: TeamHubTool[];
    previewMode?: boolean;
    platformHealth: PlatformHealthSnapshot;
};

function withPreview(href: string, previewMode: boolean) {
    if (!previewMode || href.startsWith("http") || !href.startsWith("/team")) return href;
    return href.includes("?") ? `${href}&preview=1` : `${href}?preview=1`;
}

export function TeamHubDashboard({ tools, previewMode = false, platformHealth }: TeamHubDashboardProps) {
    const quickActions = tools.filter((tool) => tool.quick);

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
                                <Button
                                    key={tool.href}
                                    asChild
                                    variant="outline"
                                    className="h-auto justify-start rounded-md border-champagne/60 bg-linen px-4 py-3 text-left shadow-none hover:border-muted-gold/50 hover:bg-travertine/60"
                                >
                                    <Link href={withPreview(tool.href, previewMode)}>
                                        <span className="block">
                                            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-dim">
                                                {tool.badge}
                                            </span>
                                            <span className="mt-1 block font-sans text-sm font-semibold text-obsidian">
                                                {tool.name}
                                            </span>
                                        </span>
                                    </Link>
                                </Button>
                            ))}
                        </div>
                    </section>
                ) : null}

                <TeamHubDirectory tools={tools} previewMode={previewMode} />
            </div>
        </main>
    );
}
