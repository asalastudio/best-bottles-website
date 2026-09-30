"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { attachBuilderKits } from "@/lib/bottle-builder/payload";
import type { BuilderBody, BuilderKit } from "@/lib/bottle-builder/model";
import { loadBodyKits } from "./builder-requests";

/** A failed kits request (a cold function, a Convex hiccup: the route answers an
 * uncached 503) is asked again after 1 s and then 3 s. It used to be dropped, so
 * the fitment and finish images stayed missing until the shopper picked another
 * bottle and came back. */
export const KIT_RETRY_DELAYS_MS = [1000, 3000] as const;

/** Chooser tiles use reviewed body images. Kit layers load after a bottle is
 * chosen, or earlier when a tile's hover already started the request. */
export function useBuilderKits(family: string, bodies: BuilderBody[], bodyId: string | null) {
    const [kits, setKits] = useState<Record<string, BuilderKit | null>>({});
    const loaded = useRef(new Set<string>());
    useEffect(() => {
        if (!bodyId || loaded.current.has(bodyId)) return;
        let active = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const request = (retry: number) => {
            loadBodyKits(family, bodyId).then(result => {
                if (!active) return;
                loaded.current.add(bodyId);
                setKits(current => ({ ...current, ...result }));
            }).catch(() => {
                if (!active || retry >= KIT_RETRY_DELAYS_MS.length) return;
                timer = setTimeout(() => request(retry + 1), KIT_RETRY_DELAYS_MS[retry]);
            });
        };
        request(0);
        return () => { active = false; clearTimeout(timer); };
    }, [family, bodyId]);
    return useMemo(() => attachBuilderKits(bodies, kits), [bodies, kits]);
}
