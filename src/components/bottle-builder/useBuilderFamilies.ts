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
        fetch("/api/bottle-builder/families", { signal: controller.signal })
            .then(async response => {
                if (!response.ok) throw Error("Family discovery unavailable");
                const data = await response.json();
                if (!Array.isArray(data.families) || !data.families.every((f: BuilderFamily) => typeof f.family === "string" && Number.isInteger(f.groups) && f.groups > 0)) throw Error("Invalid families");
                if (controller.signal.aborted) return;
                setFamilies(current => [...data.families, ...current.filter(f => !data.families.some((other: BuilderFamily) => other.family === f.family))]);
                setStatus("ready");
            }).catch(() => { if (!controller.signal.aborted) setStatus("error"); });
        return () => controller.abort();
    }, [attempt]);
    return { families, status, retry: () => { setStatus("loading"); setAttempt(n => n + 1); } };
}
