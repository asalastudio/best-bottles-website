"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { GraceContext, type GraceContextValue } from "@/components/GraceContext";

const GraceEngine = dynamic(() => import("@/components/grace/GraceProvider"), { ssr: false });

/**
 * Keeps the page tree mounted while the Grace runtime (and its Convex
 * subscriptions) stay out of the LCP trace. A tap on a Grace control loads
 * the engine immediately and replays the open; otherwise it loads after the
 * first paint window.
 */
export default function GraceProviderGate({ children }: { children: ReactNode }) {
    const [value, setValue] = useState<GraceContextValue | null>(null);
    const [load, setLoad] = useState(false);
    const pendingOpen = useRef(false);

    useEffect(() => {
        if (load) return;
        const arm = () => setLoad(true);
        const onPointerDown = (event: Event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (!target.closest("[data-grace-launcher], [data-grace-open]")) return;
            pendingOpen.current = true;
            arm();
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        const timerId = window.setTimeout(arm, 8000);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            window.clearTimeout(timerId);
        };
    }, [load]);

    useEffect(() => {
        if (!value || !pendingOpen.current) return;
        pendingOpen.current = false;
        value.open();
    }, [value]);

    return (
        <GraceContext.Provider value={value}>
            {load ? <GraceEngine publishValue={setValue} /> : null}
            {children}
        </GraceContext.Provider>
    );
}
