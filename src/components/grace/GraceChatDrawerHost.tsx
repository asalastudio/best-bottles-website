"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useGrace } from "@/components/useGrace";

/**
 * The chat drawer renders nothing until Grace opens, yet as a static import it
 * put its code (and framer-motion) in the first-load JavaScript of every page.
 * It is now loaded after the page is idle, or at once when Grace opens, so the
 * first paint never waits for it and the first open still finds it ready.
 */
const GraceChatDrawer = dynamic(() => import("./GraceChatDrawer"), { ssr: false });

export default function GraceChatDrawerHost() {
    const { panelMode } = useGrace();
    const [idle, setIdle] = useState(false);
    useEffect(() => {
        if (typeof requestIdleCallback === "function") {
            const id = requestIdleCallback(() => setIdle(true), { timeout: 4000 });
            return () => cancelIdleCallback(id);
        }
        const id = window.setTimeout(() => setIdle(true), 1500);
        return () => window.clearTimeout(id);
    }, []);
    return idle || panelMode !== "closed" ? <GraceChatDrawer /> : null;
}
