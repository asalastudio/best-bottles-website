import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";

import { SwitchAccountButton } from "@/components/auth/SwitchAccountButton";
import { ExecutiveDashboard } from "@/components/executive/ExecutiveDashboard";
import { EXECUTIVE_HUB_FIXTURE } from "@/lib/executive/fixture";
import { getUserEmailAddresses, hasExecutiveHubAccess } from "@/lib/teamAccess";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: { absolute: "Executive Hub | Best Bottles" },
    robots: { index: false, follow: false },
};

type ExecutivePageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function isLocalPreview(searchParams: Record<string, string | string[] | undefined> | undefined) {
    if (process.env.NODE_ENV === "production") return false;

    const preview = searchParams?.preview;
    const previewValues = Array.isArray(preview) ? preview : [preview];

    return previewValues.some((value) => value === "1" || value === "true");
}

async function getExecutiveAccessFallback(previewMode: boolean) {
    if (previewMode) return null;

    const { userId, redirectToSignIn } = await auth();

    if (!userId) {
        return redirectToSignIn({ returnBackUrl: "/executive" });
    }

    const user = await currentUser();
    const emailAddresses = getUserEmailAddresses(user);
    if (!hasExecutiveHubAccess(user?.publicMetadata, { emailAddresses })) {
        return <ExecutiveAccessPending emailAddresses={emailAddresses} />;
    }

    return null;
}

export default async function ExecutivePage({ searchParams }: ExecutivePageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const previewMode = isLocalPreview(resolvedSearchParams);

    const accessFallback = await getExecutiveAccessFallback(previewMode);
    if (accessFallback) return accessFallback;

    return (
        <ExecutiveDashboard
            snapshot={EXECUTIVE_HUB_FIXTURE}
            previewMode={previewMode}
        />
    );
}

function ExecutiveAccessPending({ emailAddresses }: { emailAddresses: string[] }) {
    const signedInEmail = emailAddresses[0];

    return (
        <main className="min-h-screen bg-bone px-6 py-20 sm:py-24">
            <div className="mx-auto max-w-2xl border border-champagne/60 bg-linen p-8 shadow-[0_18px_45px_rgba(29,29,31,0.04)]">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-muted-gold">Best Bottles</p>
                <h1 className="font-serif text-4xl leading-tight text-obsidian sm:text-5xl">Executive Hub access pending</h1>
                <p className="mt-5 text-base leading-7 text-slate">
                    You are signed in, but this account is not enabled for the Executive Hub yet. Use the approved executive email for your Clerk login, or ask a Best Bottles admin to turn on executive access.
                </p>
                {signedInEmail ? (
                    <p className="mt-4 text-sm leading-6 text-slate">
                        Signed in as <span className="font-semibold text-obsidian">{signedInEmail}</span>.
                    </p>
                ) : null}
                <div className="mt-8 flex flex-wrap gap-3">
                    <SwitchAccountButton
                        redirectUrl="/executive"
                        className="inline-flex border border-obsidian bg-obsidian px-5 py-3 text-sm font-semibold text-linen transition hover:border-muted-gold hover:bg-muted-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                    >
                        Use another executive email
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
