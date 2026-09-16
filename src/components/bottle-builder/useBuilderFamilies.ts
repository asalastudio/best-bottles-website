"use client";
import { useEffect, useState } from "react";
import type { BuilderFamily } from "@/lib/bottle-builder/entry";

/** Discover eligible families after the selected workspace has rendered. */
export function useBuilderFamilies(initial: BuilderFamily[]) {
    const [families, setFamilies] = useState(initial);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        const discover = () => {
            fetch("/api/bottle-builder/families", { signal: controller.signal })
                .then(async response => {
                    if (!response.ok) throw Error("Family discovery unavailable");
                    const data = await response.json();
                    if (!Array.isArray(data.families) || !data.families.every((f: BuilderFamily) => typeof f.family === "string" && Number.isInteger(f.groups) && f.groups > 0)) throw Error("Invalid families");
                    if (controller.signal.aborted) return;
                    setFamilies(current => [...data.families, ...current.filter(f => !data.families.some((other: BuilderFamily) => other.family === f.family))]);
                    setStatus("ready");
                }).catch(() => { if (!controller.signal.aborted) setStatus("error"); });
        };
        let idleId: number | undefined;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        if (typeof requestIdleCallback === "function") idleId = requestIdleCallback(discover, { timeout: 800 });
        else timeoutId = window.setTimeout(discover, 0);
        return () => {
            controller.abort();
            if (idleId != null && typeof cancelIdleCallback === "function") cancelIdleCallback(idleId);
            if (timeoutId != null) clearTimeout(timeoutId);
        };
    }, [attempt]);
    return { families, status, retry: () => { setStatus("loading"); setAttempt(n => n + 1); } };
}
