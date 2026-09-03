"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useGrace } from "@/components/useGrace";
import {
    GRACE_DESKTOP_DRAWER_WIDTH,
    gracePushEligiblePathname,
    resolveGraceSurface,
} from "@/lib/grace/pushLayout";

export default function GraceLayoutShell({ children }: { children: ReactNode }) {
    const { panelMode } = useGrace();
    const pathname = usePathname();
    const [viewportWidth, setViewportWidth] = useState(1440);
    useEffect(() => {
        const update = () => setViewportWidth(window.innerWidth);
        update();
        window.addEventListener("resize", update, { passive: true });
        return () => window.removeEventListener("resize", update);
    }, []);

    const ownsViewport = pathname.startsWith("/grace-workspace") || pathname.startsWith("/executive");
    const surface = resolveGraceSurface({
        isOpen: panelMode === "open",
        viewportWidth,
        ownsViewport,
        pushEligible: gracePushEligiblePathname(pathname),
    });
    const inset = surface.contentIsInset ? GRACE_DESKTOP_DRAWER_WIDTH : "0px";
    const style = {
        "--grace-content-inset": inset,
        width: surface.contentIsInset ? `calc(100% - ${GRACE_DESKTOP_DRAWER_WIDTH})` : "100%",
    } as CSSProperties;

    return (
        <div
            data-grace-layout={surface.mode}
            style={style}
            className="min-h-screen min-w-0 transition-[width] duration-300 ease-out"
        >
            {children}
        </div>
    );
}
