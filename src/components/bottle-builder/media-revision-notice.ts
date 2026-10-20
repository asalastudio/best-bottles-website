'use client';
import { useSyncExternalStore } from 'react';
let changed = false;
const listeners = new Set<() => void>();
export function reportMediaRevisionMismatch() {
    changed = true;
    for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
/** Keep the current build's selections until the shopper chooses to refresh. */
export function useMediaRevisionMismatch() {
    return useSyncExternalStore(subscribe, () => changed, () => false);
}
