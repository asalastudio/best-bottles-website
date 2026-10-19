"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useGrace } from "@/components/useGrace";

const GraceChatDrawer = dynamic(() => import("./GraceChatDrawer"), { ssr: false });

/**
 * The drawer (and framer-motion) stay out of the first load. Mount after the
 * page is idle, or immediately when the chat bubble is tapped.
 */
export default function GraceChat() {
    const { panelMode } = useGrace();
    const [armed, setArmed] = useState(false);
    const open = panelMode === "open";

    useEffect(() => {
        if (armed || open) return;
        const arm = () => setArmed(true);
        const onPointerDown = (event: Event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest("[data-grace-launcher], [data-grace-open]")) arm();
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        // A long timer, not requestIdleCallback: idle fires during the first
        // quiet moment and pulls framer-motion onto the LCP path.
        const timerId = window.setTimeout(arm, 8000);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            window.clearTimeout(timerId);
        };
    }, [armed, open]);

    if (!armed && !open) return null;
    return <GraceChatDrawer />;
}
