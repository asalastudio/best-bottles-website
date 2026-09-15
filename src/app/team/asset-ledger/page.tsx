import { auth, currentUser } from "@clerk/nextjs/server";
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

    const localReview = process.env.NODE_ENV === 'development';
    if (!params?.view || params.view === 'plate-catalog') return <PlateCatalog
        plan={buildPlatePlan(ledger)} generatedAt={ledger.generatedAt} deployment={ledger.deployment}
        initialFamily={typeof params?.family === 'string' ? params.family : ''}
        preview={isLocalPreview(params)} contactSheetFamilies={await availablePlateSheetFamilies(process.cwd())} />;
    if (localReview && params?.view === 'kits') return <KitIntake />;
    if(params?.view === 'completion'){
        const completion=await readCompletion(process.cwd());
        if(completion) return <PlateCompletion initial={completion} localReview={localReview}/>;
    }
    if(params?.view === 'sources'){
        const recovery=await readSourceRecovery(process.cwd());
        if(recovery) return <SourceRecovery data={recovery}/>;
    }
    if(params?.view === 'plates'){
        const family=typeof params.family==='string'?params.family:'Boston Round';
        const sheet = await readPlateSheet(process.cwd(),family);
        const finalPreparation=family==='Cylinder'&&localReview?await readCylinderFinalPlates(process.cwd()).catch(()=>null):null;
        if(sheet) return <PlateContactSheet initial={sheet} localReview={localReview} finalPreparation={finalPreparation}/>;
    }
    const snapshot = localReview ? {...ledger,bottleStandards:{standards:(await readStandards(process.cwd())).standards}} : ledger;
    return <LedgerDashboard snapshot={snapshot} localReview={localReview} />;
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
