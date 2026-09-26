"use client";
import { useEffect, useState } from "react";
import type { BuilderFamily } from "@/lib/bottle-builder/entry";

const validFamilies = (value: unknown): value is BuilderFamily[] =>
    Array.isArray(value) && value.every((f: BuilderFamily) => typeof f?.family === "string" && Number.isInteger(f.groups) && f.groups > 0);

/** Discover eligible families after the selected workspace has rendered.
 * `streamed` is the list the /matrix page streams into its own response; the
 * request below is only its fallback (a failed stream, or a retry). */
export function useBuilderFamilies(initial: BuilderFamily[], streamed?: Promise<BuilderFamily[] | null>) {
    const [families, setFamilies] = useState(initial);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        const accept = (list: BuilderFamily[]) => {
            if (controller.signal.aborted) return;
            setFamilies(current => [...list, ...current.filter(f => !list.some(other => other.family === f.family))]);
            setStatus("ready");
        };
        const discover = () => {
            fetch("/api/bottle-builder/families", { signal: controller.signal })
                .then(async response => {
                    if (!response.ok) throw Error("Family discovery unavailable");
                    const data = await response.json();
                    if (!validFamilies(data.families)) throw Error("Invalid families");
                    accept(data.families);
                }).catch(() => { if (!controller.signal.aborted) setStatus("error"); });
        };
        let idleId: number | undefined;
        let timeoutId: number | undefined;
        const later = () => {
            if (controller.signal.aborted) return;
            if (typeof requestIdleCallback === "function") idleId = requestIdleCallback(discover, { timeout: 800 });
            else timeoutId = window.setTimeout(discover, 0);
        };
        if (streamed && attempt === 0) streamed.then(list => validFamilies(list) ? accept(list) : later(), later);
        else later();
        return () => {
            controller.abort();
            if (idleId != null && typeof cancelIdleCallback === "function") cancelIdleCallback(idleId);
            if (timeoutId != null) window.clearTimeout(timeoutId);
        };
    }, [attempt, streamed]);
    return { families, status, retry: () => { setStatus("loading"); setAttempt(n => n + 1); } };
}
