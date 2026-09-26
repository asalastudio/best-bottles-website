"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { attachBuilderKits } from "@/lib/bottle-builder/payload";
import type { BuilderBody, BuilderKit } from "@/lib/bottle-builder/model";
import { loadBodyKits } from "./builder-requests";

/** Chooser tiles use reviewed body images. Kit layers load after a bottle is
 * chosen, or earlier when a tile's hover already started the request. */
export function useBuilderKits(family: string, bodies: BuilderBody[], bodyId: string | null) {
    const [kits, setKits] = useState<Record<string, BuilderKit | null>>({});
    const loaded = useRef(new Set<string>());
    useEffect(() => {
        if (!bodyId || loaded.current.has(bodyId)) return;
        let active = true;
        loadBodyKits(family, bodyId).then(result => {
            if (!active) return;
            loaded.current.add(bodyId);
            setKits(current => ({ ...current, ...result }));
        }).catch(() => {});
        return () => { active = false; };
    }, [family, bodyId]);
    return useMemo(() => attachBuilderKits(bodies, kits), [bodies, kits]);
}
