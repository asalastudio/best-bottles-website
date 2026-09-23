import type { Metadata } from "next";
import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getUserEmailAddresses, hasTeamHubAccess } from "@/lib/teamAccess";
import { loadComponentReviews } from "@/lib/team/componentReviewStaff";
import { auditCheckedAt, componentFindings, type ReviewQueue } from "../../../../convex/componentReconciliationData";
import ComponentReviewQueue from "@/components/team/ComponentReviewQueue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Components Library | Team Hub" }, robots: { index: false, follow: false } };

export default async function ComponentsPage({ searchParams }: { searchParams?: Promise<{ preview?: string }> }) {
    const params = await searchParams;
    const preview = process.env.NODE_ENV !== "production" && params?.preview === "1";
    if (!preview) {
        const { userId, redirectToSignIn } = await auth();
        if (!userId) return redirectToSignIn({ returnBackUrl: "/team/components" });
        const user = await currentUser();
        if (!hasTeamHubAccess(user?.publicMetadata, { emailAddresses: getUserEmailAddresses(user) })) {
            return <main className="min-h-screen bg-bone px-8 py-20"><h1 className="font-serif text-4xl">Team Hub access pending</h1><p className="mt-4">Component review is limited to Best Bottles staff.</p></main>;
        }
    }
    let queue: ReviewQueue = { checkedAt: auditCheckedAt, rows: componentFindings.map(row => ({ ...row, review: null })) };
    let connected = false;
    if (!preview) {
        try { queue = await loadComponentReviews(); connected = true; } catch { /* Show evidence with an explicit unavailable state. */ }
    }
    return <main data-team-hub className="min-h-screen bg-bone px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1440px]">
            <Link href={preview ? "/team?preview=1" : "/team"} className="text-xs uppercase tracking-widest text-muted-gold">Team Hub</Link>
            <h1 className="mt-3 font-serif text-4xl sm:text-5xl text-obsidian">Components Library</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate">Review bottle and component associations against the catalog evidence. Record a clarification or propose the correct part. Decisions are saved for the team; catalog changes require separate validation.</p>
            <ComponentReviewQueue initialQueue={queue} initialConnected={connected} preview={preview} />
        </div>
    </main>;
}
