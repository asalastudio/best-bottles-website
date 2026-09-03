"use client";

import { useEffect, useMemo, useRef } from "react";

const FINDER_MEMORY_NAMESPACE = "best-bottles:focused-finder";

export type FinderNavigationState = {
    route: string;
    expandedFamily: string | null;
    scrollY: number;
};

type FinderNavigationMemoryProps = {
    pathname: string;
    search: string;
    expandedFamily: string | null;
    onRestoreExpandedFamily: (family: string) => void;
};

export function safeCatalogReturnPath(value: string | null): string | null {
    if (!value?.startsWith("/catalog")) return null;
    if (value.startsWith("//")) return null;
    return value;
}

function finderRoute(pathname: string, search: string): string {
    if (!search) return pathname;
    return `${pathname}${search.startsWith("?") ? search : `?${search}`}`;
}

export function finderNavigationMemoryKey(pathname: string, search: string): string {
    return `${FINDER_MEMORY_NAMESPACE}:${finderRoute(pathname, search)}`;
}

export function parseFinderNavigationMemory(value: string | null, route: string): FinderNavigationState | null {
    if (!value) return null;
    try {
        const candidate = JSON.parse(value) as Partial<FinderNavigationState>;
        if (candidate.route !== route) return null;
        if (candidate.expandedFamily !== null && typeof candidate.expandedFamily !== "string") return null;
        if (typeof candidate.scrollY !== "number" || !Number.isFinite(candidate.scrollY)) return null;
        return {
            route,
            expandedFamily: candidate.expandedFamily ?? null,
            scrollY: Math.max(0, candidate.scrollY),
        };
    } catch {
        return null;
    }
}

export function clampFinderScrollPosition(scrollY: number, scrollHeight: number, viewportHeight: number): number {
    if (![scrollY, scrollHeight, viewportHeight].every(Number.isFinite)) return 0;
    const maximum = Math.max(0, scrollHeight - viewportHeight);
    return Math.min(Math.max(0, scrollY), maximum);
}

export default function FinderNavigationMemory({
    pathname,
    search,
    expandedFamily,
    onRestoreExpandedFamily,
}: FinderNavigationMemoryProps) {
    const route = useMemo(() => finderRoute(pathname, search), [pathname, search]);
    const storageKey = useMemo(() => finderNavigationMemoryKey(pathname, search), [pathname, search]);
    const restoredRoute = useRef<string | null>(null);
    const skipInitialSave = useRef<string | null>(null);

    useEffect(() => {
        if (restoredRoute.current === route) return;
        restoredRoute.current = route;
        const state = parseFinderNavigationMemory(window.sessionStorage.getItem(storageKey), route);
        if (!state) return;
        skipInitialSave.current = route;
        if (state.expandedFamily) onRestoreExpandedFamily(state.expandedFamily);
        if (state.scrollY <= 0) return;

        window.requestAnimationFrame(() => {
            const scrollY = clampFinderScrollPosition(
                state.scrollY,
                document.documentElement.scrollHeight,
                window.innerHeight,
            );
            if (scrollY > 0) window.scrollTo({ top: scrollY, behavior: "auto" });
        });
    }, [onRestoreExpandedFamily, route, storageKey]);

    useEffect(() => {
        const save = () => {
            const state: FinderNavigationState = {
                route,
                expandedFamily,
                scrollY: Math.max(0, window.scrollY),
            };
            window.sessionStorage.setItem(storageKey, JSON.stringify(state));
        };

        const shouldSaveImmediately = skipInitialSave.current !== route;
        skipInitialSave.current = null;
        if (shouldSaveImmediately) save();
        window.addEventListener("pagehide", save);
        return () => window.removeEventListener("pagehide", save);
    }, [expandedFamily, route, storageKey]);

    return null;
}
