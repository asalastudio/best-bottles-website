import manifest from './manifest.json';

export const PRODUCTION_TARGET = {
    projectId: 'prj_GHwEFaEB2YYcMKetaompX9fGC4mR',
    teamId: 'team_CGyACzn1BhcZitDAKUiZRzax',
    convexUrl: 'https://precise-raccoon-123.convex.cloud',
} as const;
export const PREVIEW_TARGET = {
    projectId: 'prj_JFb1sYpDTmvfUR2qfOOL9TJmF5yt',
    convexUrl: 'https://beloved-wildcat-265.convex.cloud',
    branch: 'release/empire-round26-production',
} as const;
type Env = Record<string, string | undefined>;
export type ProductionApproval = {
    release: string;
    commit: string;
    projectId: string;
    convexUrl: string;
    mode: 'off' | 'canary' | 'empire' | 'all';
    rollbackDeploymentId: string;
    reference: string;
    approvedBy: string;
    expiresAt: string;
    intent: 'stage-without-traffic';
};

/** Server-only operator approval record. It is a declaration of approval, not
 * proof of consent. Supply only after human approval; never commit a live record.
 * An independent approval is needed to promote the staged deployment. */
function productionApproval(env: Env, now: number): ProductionApproval {
    let approval: ProductionApproval;
    try { approval = JSON.parse(env.BB_MEDIA_PRODUCTION_APPROVAL ?? ''); }
    catch { throw new Error('Production staging requires an explicit approval record'); }
    const mode = env.NEXT_PUBLIC_BB_MEDIA_RELEASE === 'off' || !env.NEXT_PUBLIC_BB_MEDIA_RELEASE
        ? 'off' : env.NEXT_PUBLIC_BB_MEDIA_RELEASE.split(':')[1];
    if (!approval || approval.release !== manifest.revision || !/^[a-f0-9]{40}$/.test(approval.commit ?? '')
        || approval.commit !== env.VERCEL_GIT_COMMIT_SHA || approval.projectId !== PRODUCTION_TARGET.projectId
        || approval.convexUrl !== PRODUCTION_TARGET.convexUrl || approval.mode !== mode
        || !/^dpl_[a-zA-Z0-9]+$/.test(approval.rollbackDeploymentId ?? '')
        || typeof approval.reference !== 'string' || !approval.reference.trim()
        || typeof approval.approvedBy !== 'string' || !approval.approvedBy.trim()
        || !Number.isFinite(Date.parse(approval.expiresAt)) || Date.parse(approval.expiresAt) <= now
        || Date.parse(approval.expiresAt) > now + 24 * 60 * 60 * 1000
        || approval.intent !== 'stage-without-traffic') throw new Error('Production approval does not match this build or has expired');
    return approval;
}

/** Fail closed before compilation. This function never writes remote state.
 * Both active production media and the new-code/off rollback baseline need an
 * exact staging approval. Normal local/off development remains unchanged. */
export function assertMediaBuildConfig(env: Env, now = Date.now()): void {
    const selection = env.NEXT_PUBLIC_BB_MEDIA_RELEASE;
    const active = Boolean(selection && selection !== 'off');
    if (active && !['canary', 'empire', 'all'].some(mode => selection === `${manifest.revision}:${mode}`)) throw new Error('Unknown media release selection');
    if (env.CONVEX_DEPLOY_KEY || env.BB_CONVEX_PREVIEW_DEPLOY === 'true') throw new Error('This frontend-only build must not contain a backend deployment key or request a backend deploy');
    if (active && env.NEXT_PUBLIC_REGISTER_STAGE === 'off') throw new Error('Media release requires the register stage');
    if (env.VERCEL_ENV === 'production') {
        if (env.VERCEL_PROJECT_ID !== PRODUCTION_TARGET.projectId || env.VERCEL_ORG_ID !== PRODUCTION_TARGET.teamId
            || env.NEXT_PUBLIC_CONVEX_URL !== PRODUCTION_TARGET.convexUrl) throw new Error('Wrong production project, team or backend');
        if (env.BB_MEDIA_LOCAL_REVIEW === 'true' || env.NEXT_PUBLIC_CLERK_ENABLED !== 'true') throw new Error('Production cannot inherit local review or disabled authentication');
        productionApproval(env, now);
        return;
    }
    const isolatedReview = env.VERCEL_ENV === "preview" && env.VERCEL_GIT_COMMIT_REF === PREVIEW_TARGET.branch;
    if (!active && !isolatedReview) return;
    if (env.NODE_ENV === 'development') throw new Error('Use a production-mode build for release review');
    if (['CONVEX_WRITE_TOKEN', 'BEST_BOTTLES_CONVEX_WRITE_TOKEN', 'BLOB_READ_WRITE_TOKEN', 'SHOPIFY_ADMIN_TOKEN', 'SHOPIFY_WEBHOOK_SECRET', 'CLERK_SECRET_KEY'].some(k => Boolean(env[k]))) throw new Error('Media preview must not contain deployment or media write credentials');
    if (!env.VERCEL && !env.VERCEL_ENV && env.BB_MEDIA_LOCAL_REVIEW === 'true') {
        const url = new URL(env.NEXT_PUBLIC_CONVEX_URL ?? '');
        if (!['localhost', '127.0.0.1', 'ci-placeholder.convex.cloud'].includes(url.hostname)) throw new Error('Local review requires a loopback or build-only placeholder backend');
        return;
    }
    if (env.VERCEL_ENV !== 'preview' || env.VERCEL_PROJECT_ID !== PREVIEW_TARGET.projectId
        || env.VERCEL_GIT_COMMIT_REF !== PREVIEW_TARGET.branch || env.NEXT_PUBLIC_CONVEX_URL !== PREVIEW_TARGET.convexUrl) throw new Error('Wrong isolated preview project, branch or backend');
}
