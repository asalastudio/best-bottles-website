"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BuilderBody, BuilderConfiguration } from "@/lib/bottle-builder/model";

/** First paint carries chooser-only bodies (one configuration per glass, see
 * chooserBodies). The chosen bottle's full configurations load here; its kit
 * layers follow in useBuilderKits, which reads the merged bodies. */
export function useBuilderBodyConfigurations(family: string, bodies: BuilderBody[], bodyId: string | null, shop: string | null) {
    const [loaded, setLoaded] = useState<Record<string, BuilderConfiguration[]>>({});
    const [failedId, setFailedId] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const requested = useRef(new Set<string>());
    // Loading is implied, never set: a chooser-only body that is not loaded and has not failed is in flight.
    const needed = Boolean(bodyId) && !loaded[bodyId!] && bodies.some(body => body.id === bodyId && body.chooserOnly);
    useEffect(() => {
        if (!bodyId || !needed) return;
        const inFlight = requested.current;
        const key = `${bodyId}#${attempt}`;
        if (inFlight.has(key)) return;
        inFlight.add(key);
        const controller = new AbortController();
        fetch(`/api/bottle-builder/bodies?family=${encodeURIComponent(family)}&bodyId=${encodeURIComponent(bodyId)}${shop ? `&shop=${encodeURIComponent(shop)}` : ""}`, { signal: controller.signal })
            .then(async response => {
                if (!response.ok) throw Error("Bottle options unavailable");
                const data = await response.json();
                if (!data || !Array.isArray(data.configurations)) throw Error("Invalid configurations");
                if (controller.signal.aborted) return;
                setLoaded(current => ({ ...current, [bodyId]: data.configurations as BuilderConfiguration[] }));
            }).catch(() => { if (!controller.signal.aborted) setFailedId(bodyId); });
        // An aborted request (the shopper moved on) must not block a later return to this bottle.
        return () => { controller.abort(); inFlight.delete(key); };
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
