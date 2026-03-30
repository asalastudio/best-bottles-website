"use client";

import { useEffect, useState } from "react";
import { Microphone } from "@/components/icons";
import { useGrace } from "@/components/useGrace";

const PDP_GRACE_SEEN_KEY = "pdp-grace-trigger-seen";

/**
 * Inline PDP Grace trigger — elegant, un-intrusive.
 * Surfaces "Talk with Grace" with Microphone icon and subtle pulse on first visit.
 */
export default function PdpGraceTrigger() {
    const { openPanel } = useGrace();
    const [showPulse, setShowPulse] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined" && !localStorage.getItem(PDP_GRACE_SEEN_KEY)) {
            setShowPulse(true); // eslint-disable-line react-hooks/set-state-in-effect -- one-time init from localStorage
        }
    }, []);

    const handleClick = () => {
        setShowPulse(false);
        try {
            localStorage.setItem(PDP_GRACE_SEEN_KEY, "1");
        } catch {
            /* ignore */
        }
        openPanel();
    };

    return (
        <button
            onClick={handleClick}
            className="group flex items-center gap-2 text-slate hover:text-obsidian transition-colors duration-200"
            aria-label="Talk with Grace — fitment and pricing help"
        >
            <span
                className={`relative flex items-center justify-center rounded-full p-1.5 transition-colors duration-200 ${
                    showPulse
                        ? "bg-muted-gold/15 text-muted-gold animate-grace-pulse-subtle"
                        : "bg-champagne/40 text-slate group-hover:bg-muted-gold/20 group-hover:text-muted-gold"
                }`}
            >
                <Microphone size={16} weight="fill" className="text-current" />
            </span>
            <span className="text-xs font-medium tracking-wide">
                Fitment questions? <span className="text-muted-gold group-hover:underline">Talk with Grace</span>
            </span>
        </button>
    );
}
