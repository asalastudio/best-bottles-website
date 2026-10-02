/** Auth context is local bookkeeping; organization IDs are never sent here. */
export type AnalyticsIdentity = { userId: string | null; organizationId: string | null } | null;
type IdentitySdk = { reset(): void; identify(userId: string): void };

let desired: AnalyticsIdentity | undefined;
let revision = 0;
let appliedRevision = -1;
let identified = false;

export function setCaptureIdentity(next: AnalyticsIdentity): boolean {
    if (desired !== undefined && desired?.userId === next?.userId
        && desired?.organizationId === next?.organizationId && (desired === null) === (next === null)) return false;
    desired = next;
    revision += 1;
    return true;
}

export function captureIdentityRevision(): number { return revision; }
export function identityCaptureReady(): boolean { return desired !== null; }

export function reconcileCaptureIdentity(sdk: IdentitySdk, publicRoute: boolean): void {
    if (desired === undefined) return;
    if (appliedRevision !== revision) {
        // Reset is local state cleanup, even on excluded routes. Never leave a
        // previous user's persisted ID/groups behind while waiting to identify.
        sdk.reset();
        appliedRevision = revision;
        identified = false;
    }
    if (!identified && publicRoute && desired?.userId) {
        sdk.identify(desired.userId);
        identified = true;
    }
}
