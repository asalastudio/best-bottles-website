import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";
import { SwitchAccountButton } from "@/components/auth/SwitchAccountButton";
import { TeamHubDashboard } from "@/components/team/TeamHubDashboard";
import TeamHubShell from "@/components/team/TeamHubShell";
import { getPlatformHealthSnapshot } from "@/lib/executive/platformHealth";
import { getUserEmailAddresses, hasTeamHubAccess } from "@/lib/teamAccess";
import { buildTeamHubTools, getMadisonStudioHref, getShopifyAdminHref } from "@/lib/teamHub";
import { buildQueueItems, getTeamHubQueues, type QueueItem } from "@/lib/team/queues";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: { absolute: "Team Hub | Best Bottles" },
    robots: { index: false, follow: false },
};

type TeamPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function isLocalPreview(searchParams: Record<string, string | string[] | undefined> | undefined) {
    if (process.env.NODE_ENV === "production") return false;

    const preview = searchParams?.preview;
    const previewValues = Array.isArray(preview) ? preview : [preview];

    return previewValues.some((value) => value === "1" || value === "true");
}

export default async function TeamPage({ searchParams }: TeamPageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const previewMode = isLocalPreview(resolvedSearchParams);

    if (!previewMode) {
        const { userId, redirectToSignIn } = await auth();

        if (!userId) {
            return redirectToSignIn({ returnBackUrl: "/team" });
        }

        const user = await currentUser();
        const emailAddresses = getUserEmailAddresses(user);
        if (!hasTeamHubAccess(user?.publicMetadata, { emailAddresses })) {
            return <TeamAccessPending emailAddresses={emailAddresses} />;
        }
    }

    const platformHealth = await getPlatformHealthSnapshot({ issueLimit: 3, activityLimit: 0 });
    const tools = buildTeamHubTools({
        shopifyAdminHref: getShopifyAdminHref(),
        madisonStudioHref: getMadisonStudioHref(),
    });

    // Local preview runs without Clerk, so the staff gate behind the queue
    // query cannot pass. The hub still renders — with an empty band rather
    // than invented numbers, which is the honest version of "not available".
    let queueItems: QueueItem[] = [];
    try {
        queueItems = buildQueueItems(await getTeamHubQueues());
    } catch (error) {
        if (!previewMode) console.error("[team-hub] queue counts unavailable:", error);
    }

    return (
        <TeamHubShell previewMode={previewMode}>
            <TeamHubDashboard
                tools={tools}
                previewMode={previewMode}
                platformHealth={platformHealth}
                queueItems={queueItems}
            />
        </TeamHubShell>
    );
}

function TeamAccessPending({ emailAddresses }: { emailAddresses: string[] }) {
    const signedInEmail = emailAddresses[0];

    return (
        <main className="app-surface min-h-screen bg-bone px-6 py-20 sm:py-24">
            <div className="mx-auto max-w-2xl border border-champagne/60 bg-linen p-8 shadow-[0_18px_45px_rgba(29,29,31,0.04)]">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-muted-gold">
                    Best Bottles
                </p>
                <h1 className="font-serif text-4xl leading-tight text-obsidian sm:text-5xl">
                    Team Hub access pending
                </h1>
                <p className="mt-5 text-base leading-7 text-slate">
                    You are signed in, but this account is not enabled for the Team Hub yet.
                    Use the approved team email for your Clerk login, or ask a Best Bottles admin to turn on team access.
                </p>
                {signedInEmail ? (
                    <p className="mt-4 text-sm leading-6 text-slate">
                        Signed in as <span className="font-semibold text-obsidian">{signedInEmail}</span>.
                    </p>
                ) : null}
                <div className="mt-8 flex flex-wrap gap-3">
                    <SwitchAccountButton
                        redirectUrl="/team"
                        className="inline-flex border border-obsidian bg-obsidian px-5 py-3 text-sm font-semibold text-linen transition hover:border-muted-gold hover:bg-muted-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                    >
                        Use another team email
                    </SwitchAccountButton>
                    <a
                        href="mailto:jordan@asala.ai"
                        className="inline-flex border border-champagne bg-bone px-5 py-3 text-sm font-semibold text-obsidian transition hover:border-muted-gold hover:text-muted-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                    >
                        Contact Jordan
                    </a>
                </div>
            </div>
        </main>
    );
}
