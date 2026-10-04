/** Auth context is local bookkeeping; organization IDs are never sent here. */
export type AnalyticsIdentity = { userId: string | null; organizationId: string | null } | null;
type IdentitySdk = {
    reset(): void;
    identify(userId: string): void;
    consent: { reset(): void };
    get_property?(key: string): unknown;
    getSessionProperty?(key: string): unknown;
    get_distinct_id?(): string;
    getGroups?(): Record<string, unknown>;
};

/** Only the pinned SDK's explicit anonymous state with no identity/group residue is reusable. */
export function hasReusableAnonymousIdentity(sdk: IdentitySdk): boolean {
    if (!sdk.get_property || !sdk.getSessionProperty || !sdk.get_distinct_id || !sdk.getGroups) return false;
    const empty = (value: unknown) => value == null || (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0);
    const sessionState = sdk.getSessionProperty("$user_state");
    return sdk.get_property("$user_state") === "anonymous"
        && (sessionState == null || sessionState === "anonymous")
        && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(sdk.get_distinct_id())
        && !sdk.get_property("$user_id") && !sdk.getSessionProperty("$user_id")
        && !sdk.get_property("__alias") && !sdk.getSessionProperty("__alias")
        && empty(sdk.getGroups()) && empty(sdk.getSessionProperty("$groups"));
}

/**
 * Pinned posthog-js 1.433.2 reset() also clears consent. Suppress only that
 * synchronous step, restoring it even on error. No consent write, opt-in/out,
 * or config change occurs. Revalidate this adapter on SDK upgrades.
 */
export function resetIdentityPreservingConsent(sdk: IdentitySdk): void {
    const consent = sdk.consent;
    if (!consent || typeof consent.reset !== "function") throw new Error("Unsupported analytics consent reset");
    const resetConsent = consent.reset;
    try {
        consent.reset = () => {};
        sdk.reset();
    } finally {
        consent.reset = resetConsent;
    }
}

let desired: AnalyticsIdentity | undefined;
let revision = 0;
let appliedRevision = -1;
let identified = false;
let identityBlocked = false;

export function setCaptureIdentity(next: AnalyticsIdentity): boolean {
    if (desired !== undefined && desired?.userId === next?.userId
        && desired?.organizationId === next?.organizationId && (desired === null) === (next === null)) return false;
    desired = next ? { ...next } : null;
    identityBlocked = false;
    revision += 1;
    return true;
}

export function captureIdentityRevision(): number { return revision; }
export function identityCaptureReady(): boolean { return desired !== null && !identityBlocked; }

export function reconcileCaptureIdentity(sdk: IdentitySdk, publicRoute: boolean): void {
    if (desired === undefined) return;
    try {
        if (appliedRevision !== revision) {
            // Preserve the guest journey on a hard reload only when the SDK
            // proves it is anonymous. Always clear stale/ambiguous identities,
            // and reset on subsequent auth-context changes, even on private routes.
            if (appliedRevision !== -1 || !hasReusableAnonymousIdentity(sdk)) resetIdentityPreservingConsent(sdk);
            appliedRevision = revision;
            identified = false;
        }
        if (!identified && publicRoute && desired?.userId) {
            sdk.identify(desired.userId);
            identified = true;
        }
        identityBlocked = false;
    } catch (error) {
        identityBlocked = true;
        throw error;
    }
}
