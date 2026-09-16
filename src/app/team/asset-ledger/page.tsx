import { auth, currentUser } from "@clerk/nextjs/server";
import type { ReactNode } from "react";
import ledgerJson from "@/lib/asset-ledger/ledger.json";
import { type Ledger } from "@/lib/asset-ledger/types";
import LedgerDashboard from "./LedgerDashboard";
import PlateCatalog from "./PlateCatalog";
import {buildPlatePlan} from "../../../../scripts/asset-ledger/plate-plan.mjs";
import PlateContactSheet from "./PlateContactSheet";
import SourceRecovery from "./SourceRecovery";
import PlateCompletion from "./PlateCompletion";
import KitIntake from "./KitIntake";
import {readCompletion} from "../../../../scripts/asset-ledger/plate-completion.mjs";
import {readSourceRecovery} from "../../../../scripts/asset-ledger/source-recovery.mjs";
import {readPlateSheet,availablePlateSheetFamilies} from "../../../../scripts/asset-ledger/plate-contact-sheet.mjs";
import { getUserEmailAddresses, hasTeamHubAccess } from "@/lib/teamAccess";
import TeamHubShell from "@/components/team/TeamHubShell";
import {readStandards} from '../../../../scripts/asset-ledger/standard-review.mjs';
import {readCylinderFinalPlates} from '../../../../scripts/asset-ledger/cylinder-final-plates.mjs';

export const dynamic = "force-dynamic";

export const metadata = {
    title: { absolute: "Visual asset ledger — Best Bottles" },
    robots: { index: false, follow: false },
};

const ledger = ledgerJson as unknown as Ledger;
/** The Team Hub's own local-preview escape hatch, for sandboxes that run with Clerk disabled. Never in production. */
function isLocalPreview(params: Record<string, string | string[] | undefined> | undefined) {
    if (process.env.NODE_ENV === "production") return false;
    const preview = params?.preview;
    return (Array.isArray(preview) ? preview : [preview]).some((v) => v === "1" || v === "true");
}

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const params = searchParams ? await searchParams : undefined;
    // Same gate as the rest of the Team Hub: this page lists every SKU we sell
    // and the state of its imagery, which is internal operational truth.
    if (!isLocalPreview(params)) {
        const { userId, redirectToSignIn } = await auth();
        if (!userId) return redirectToSignIn({ returnBackUrl: "/team/asset-ledger" });
        const user = await currentUser();
        const emailAddresses = getUserEmailAddresses(user);
        if (!hasTeamHubAccess(user?.publicMetadata, { emailAddresses })) return <AccessPending />;
    }

    const previewMode = isLocalPreview(params);
    const localReview = process.env.NODE_ENV === 'development';
    let desk: ReactNode;
    if (!params?.view || params.view === 'plate-catalog') {
        desk = <PlateCatalog
            plan={buildPlatePlan(ledger)} generatedAt={ledger.generatedAt} deployment={ledger.deployment}
            initialFamily={typeof params?.family === 'string' ? params.family : ''}
            preview={previewMode} contactSheetFamilies={await availablePlateSheetFamilies(process.cwd())} />;
    } else if (localReview && params?.view === 'kits') {
        desk = <KitIntake />;
    } else if (params?.view === 'completion') {
        const completion = await readCompletion(process.cwd());
        desk = completion ? <PlateCompletion initial={completion} localReview={localReview}/> : <LedgerDashboard snapshot={ledger} localReview={localReview} />;
    } else if (params?.view === 'sources') {
        const recovery = await readSourceRecovery(process.cwd());
        desk = recovery ? <SourceRecovery data={recovery}/> : <LedgerDashboard snapshot={ledger} localReview={localReview} />;
    } else if (params?.view === 'plates') {
        const family = typeof params.family === 'string' ? params.family : 'Boston Round';
        const sheet = await readPlateSheet(process.cwd(), family);
        const finalPreparation = family === 'Cylinder' && localReview ? await readCylinderFinalPlates(process.cwd()).catch(() => null) : null;
        desk = sheet ? <PlateContactSheet initial={sheet} localReview={localReview} finalPreparation={finalPreparation}/> : <LedgerDashboard snapshot={ledger} localReview={localReview} />;
    } else {
        const snapshot = localReview ? {...ledger,bottleStandards:{standards:(await readStandards(process.cwd())).standards}} : ledger;
        desk = <LedgerDashboard snapshot={snapshot} localReview={localReview} />;
    }

    return <TeamHubShell previewMode={previewMode}>{desk}</TeamHubShell>;
}

function AccessPending() {
    return (
        <main className="min-h-screen bg-bone px-6 py-24">
            <div className="mx-auto max-w-[640px] rounded-xl border border-champagne/40 bg-white px-8 py-8">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-gold">Staff only</p>
                <h1 className="mb-3 font-serif text-3xl text-obsidian">You don&rsquo;t have access to the asset ledger</h1>
                <p className="text-sm leading-relaxed text-slate">
                    The ledger is limited to Best Bottles staff. If you should have access, ask an administrator to add
                    you to the Team Hub.
                </p>
            </div>
        </main>
    );
}
