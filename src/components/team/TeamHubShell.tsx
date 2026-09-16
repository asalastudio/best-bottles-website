import type { ReactNode } from "react";
import TeamHubChrome from "@/components/team/TeamHubChrome";
import { buildQueueItems, getTeamHubQueues } from "@/lib/team/queues";
import { buildTeamHubTools, getMadisonStudioHref, getShopifyAdminHref } from "@/lib/teamHub";

export default async function TeamHubShell({
    previewMode = false,
    children,
}: {
    previewMode?: boolean;
    children: ReactNode;
}) {
    const tools = buildTeamHubTools({
        shopifyAdminHref: getShopifyAdminHref(),
        madisonStudioHref: getMadisonStudioHref(),
    });

    let queueCounts: Record<string, number> = {};
    try {
        queueCounts = buildQueueItems(await getTeamHubQueues()).reduce<Record<string, number>>((counts, item) => {
            counts[item.href] = (counts[item.href] ?? 0) + item.count;
            return counts;
        }, {});
    } catch (error) {
        if (!previewMode) console.error("[team-hub] queue counts unavailable:", error);
    }

    return (
        <TeamHubChrome tools={tools} counts={queueCounts} previewMode={previewMode}>
            {children}
        </TeamHubChrome>
    );
}
