import manifest from './manifest.json';
import target from './preview-target.json';

type PreviewTarget = { verified: boolean; projectId: string | null; branch: string; convexUrl: string | null; productionConvexUrl: string | null; evidence: string | null };
/** Read-only build gate. A flag alone cannot activate these assets in production
 * or silently inherit an unverified preview backend. Never logs env values. */
export function assertMediaPreviewConfig(env: Record<string, string | undefined>, verifiedTarget: PreviewTarget = target): void {
    const selection = env.NEXT_PUBLIC_BB_MEDIA_RELEASE;
    if (!selection || selection === 'off') return;
    if (!['canary', 'empire', 'all'].some(mode => selection === `${manifest.revision}:${mode}`)) throw new Error('Unknown media release selection');
    if (env.NODE_ENV === 'development') throw new Error('Use a production-mode local build for release review; local development pilots remain separate');
    if (env.VERCEL_ENV === 'production') throw new Error('Production media activation has not been approved');
    if (env.NEXT_PUBLIC_REGISTER_STAGE === 'off') throw new Error('Media release requires the register stage');
    // The initial preview is frontend-only. It must not hold backend/storage write keys.
    if (['CONVEX_DEPLOY_KEY', 'CONVEX_WRITE_TOKEN', 'BEST_BOTTLES_CONVEX_WRITE_TOKEN', 'BLOB_READ_WRITE_TOKEN', 'BB_CONVEX_PREVIEW_DEPLOY', 'SHOPIFY_ADMIN_TOKEN', 'SHOPIFY_WEBHOOK_SECRET', 'CLERK_SECRET_KEY'].some(k => Boolean(env[k]))) throw new Error('Media preview must not contain deployment or media write credentials');
    if (!env.VERCEL && !env.VERCEL_ENV && env.BB_MEDIA_LOCAL_REVIEW === 'true') {
        const url = new URL(env.NEXT_PUBLIC_CONVEX_URL ?? '');
        if (!['localhost', '127.0.0.1', 'ci-placeholder.convex.cloud'].includes(url.hostname)) throw new Error('Local media review requires a loopback or build-only placeholder backend');
        return;
    }
    if (env.VERCEL_ENV !== 'preview' || !verifiedTarget.verified || !verifiedTarget.evidence || !verifiedTarget.projectId ||
        !verifiedTarget.convexUrl || !verifiedTarget.productionConvexUrl || verifiedTarget.convexUrl === verifiedTarget.productionConvexUrl ||
        env.VERCEL_PROJECT_ID !== verifiedTarget.projectId || env.VERCEL_GIT_COMMIT_REF !== verifiedTarget.branch ||
        env.NEXT_PUBLIC_CONVEX_URL !== verifiedTarget.convexUrl) throw new Error('Media preview target has not passed isolation verification');
}
