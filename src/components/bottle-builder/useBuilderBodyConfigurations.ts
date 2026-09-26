"use client";
import { useEffect, useMemo, useState } from "react";
import type { BuilderBody, BuilderConfiguration } from "@/lib/bottle-builder/model";
import { loadBodyConfigurations } from "./builder-requests";

/** First paint carries chooser-only bodies (one configuration per glass, see
 * chooserBodies). The chosen bottle's full configurations load here — often
 * already in flight from the tile's hover prefetch; its kit layers follow in
 * useBuilderKits, which reads the merged bodies. */
export function useBuilderBodyConfigurations(family: string, bodies: BuilderBody[], bodyId: string | null, shop: string | null) {
    const [loaded, setLoaded] = useState<Record<string, BuilderConfiguration[]>>({});
    const [failedId, setFailedId] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    // Loading is implied, never set: a chooser-only body that is not loaded and has not failed is in flight.
    const needed = Boolean(bodyId) && !loaded[bodyId!] && bodies.some(body => body.id === bodyId && body.chooserOnly);
    useEffect(() => {
        if (!bodyId || !needed) return;
        // The request is shared and never aborted: a shopper who moves on and comes back finds it done.
        let active = true;
        loadBodyConfigurations(family, bodyId, shop).then(configurations => {
            if (active) setLoaded(current => ({ ...current, [bodyId]: configurations }));
        }).catch(() => { if (active) setFailedId(bodyId); });
        return () => { active = false; };
    }, [family, bodyId, shop, needed, attempt]);
    const merged = useMemo(() => bodies.map(body => loaded[body.id]
        ? { ...body, configurations: loaded[body.id], chooserOnly: false } : body), [bodies, loaded]);
    const failed = Boolean(bodyId) && failedId === bodyId;
    return {
        bodies: merged,
        loading: needed && !failed,
        failed,
        retry: () => { setFailedId(null); setAttempt(n => n + 1); },
    };
}
