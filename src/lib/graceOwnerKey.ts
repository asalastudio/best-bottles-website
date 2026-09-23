import { getAnonOwnerKey } from "@/lib/graceAnonOwnerKey";

/**
 * The owner key Grace uses to scope shortlists, memory notes, uploads, and
 * session traces.
 *
 * Signed-in customers get a stable key derived from their Clerk user id, so
 * what Grace remembers follows the person across devices. Anonymous visitors
 * keep the per-device localStorage key from `getAnonOwnerKey`.
 *
 * The prefix keeps the two namespaces from colliding: an anonymous key is a
 * bare UUID, a customer key always starts with `user:`.
 */
export function resolveGraceOwnerKey(clerkUserId: string | null | undefined): string {
    if (clerkUserId) return `user:${clerkUserId}`;
    return getAnonOwnerKey();
}

/**
 * Module-scope mirror of the active key, published by GraceProvider whenever
 * the Clerk identity changes.
 *
 * Some callers — the `/api/grace/tools` helper, for one — run outside React and
 * cannot read the provider. Without this they would silently fall back to the
 * device key and file a signed-in customer's work under an anonymous owner.
 */
let activeOwnerKey: string | null = null;

export function setActiveGraceOwnerKey(key: string): void {
    activeOwnerKey = key;
}

export function getActiveGraceOwnerKey(): string {
    return activeOwnerKey ?? getAnonOwnerKey();
}
