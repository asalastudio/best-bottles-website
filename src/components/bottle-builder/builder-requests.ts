import type { BuilderConfiguration, BuilderKit } from "@/lib/bottle-builder/model";

/** One request per bottle per page view, shared by the tile prefetch and the
 * hooks that apply the result, so a pick made after a hover never asks twice.
 * Invalid or failed responses are forgotten: "Try again" (or picking the bottle
 * again) makes a fresh request. */
const requests = new Map<string, Promise<unknown>>();

function load<T>(url: string, read: (data: unknown) => T | null): Promise<T> {
    let request = requests.get(url) as Promise<T> | undefined;
    if (!request) {
        request = fetch(url, { headers: { Accept: "application/json" } }).then(async response => {
            if (!response.ok) throw Error(`Builder request failed: ${response.status}`);
            const value = read(await response.json());
            if (value === null) throw Error("Invalid builder response");
            return value;
        });
        requests.set(url, request);
        request.catch(() => { if (requests.get(url) === request) requests.delete(url); });
    }
    return request;
}

const query = (family: string, bodyId: string) => `family=${encodeURIComponent(family)}&bodyId=${encodeURIComponent(bodyId)}`;

/** The chosen bottle's full configurations (first paint carries one per glass). */
export function loadBodyConfigurations(family: string, bodyId: string, shop: string | null) {
    return load(`/api/bottle-builder/bodies?${query(family, bodyId)}${shop ? `&shop=${encodeURIComponent(shop)}` : ""}`,
        data => data && typeof data === "object" && Array.isArray((data as { configurations?: unknown }).configurations)
            ? (data as { configurations: BuilderConfiguration[] }).configurations : null);
}

/** The chosen bottle's kit layers, keyed by configuration id. */
export function loadBodyKits(family: string, bodyId: string) {
    return load(`/api/bottle-builder/kits?${query(family, bodyId)}`,
        data => {
            const kits = data && typeof data === "object" ? (data as { kits?: unknown }).kits : null;
            return kits && typeof kits === "object" ? kits as Record<string, BuilderKit | null> : null;
        });
}

/** A bottle the shopper is about to pick (hover, focus, press): start both
 * requests now, so the click finds them in flight or done. */
export function prefetchBody(family: string, bodyId: string, shop: string | null) {
    loadBodyConfigurations(family, bodyId, shop).catch(() => {});
    loadBodyKits(family, bodyId).catch(() => {});
}
