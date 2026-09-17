"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { attachBuilderKits } from "@/lib/bottle-builder/payload";
import type { BuilderBody, BuilderKit } from "@/lib/bottle-builder/model";

/** Chooser tiles use reviewed body images. Kit layers load after a bottle is chosen. */
export function useBuilderKits(family: string, bodies: BuilderBody[], bodyId: string | null) {
    const [kits, setKits] = useState<Record<string, BuilderKit | null>>({});
    const loaded = useRef(new Set<string>());
    useEffect(() => {
        if (!bodyId || loaded.current.has(bodyId)) return;
        const controller = new AbortController();
        fetch(`/api/bottle-builder/kits?family=${encodeURIComponent(family)}&bodyId=${encodeURIComponent(bodyId)}`, { signal: controller.signal })
            .then(async response => {
                if (!response.ok) throw Error("Kit imagery unavailable");
                const data = await response.json();
                if (!data || typeof data !== "object" || typeof data.kits !== "object" || data.kits === null) throw Error("Invalid kits");
                if (controller.signal.aborted) return;
                loaded.current.add(bodyId);
                setKits(current => ({ ...current, ...data.kits as Record<string, BuilderKit | null> }));
            }).catch(() => {});
        return () => controller.abort();
    }, [family, bodyId]);
    return useMemo(() => attachBuilderKits(bodies, kits), [bodies, kits]);
}
