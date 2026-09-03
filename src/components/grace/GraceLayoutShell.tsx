"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useGrace } from "@/components/useGrace";
import {
    GRACE_MINIMUM_CONTENT_WIDTH_PX,
    gracePushEligiblePathname,
    resolveGraceDrawerWidth,
    resolveGraceSurface,
} from "@/lib/grace/pushLayout";

export default function GraceLayoutShell({ children }: { children: ReactNode }) {
    const { panelMode } = useGrace();
    const pathname = usePathname();
    const [viewportWidth, setViewportWidth] = useState(0);
    useEffect(() => {
        const update = () => setViewportWidth(document.documentElement.clientWidth || window.innerWidth);
        update();
        window.addEventListener("resize", update, { passive: true });
        const observer = typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(update);
        observer?.observe(document.documentElement);
        return () => {
            window.removeEventListener("resize", update);
            observer?.disconnect();
        };
    }, []);

    const ownsViewport = pathname.startsWith("/grace-workspace") || pathname.startsWith("/executive");
    const drawerWidth = resolveGraceDrawerWidth(viewportWidth);
    const surface = resolveGraceSurface({
        isOpen: panelMode === "open",
        viewportWidth,
        drawerWidth,
        minimumContentWidth: GRACE_MINIMUM_CONTENT_WIDTH_PX,
        ownsViewport,
        pushEligible: gracePushEligiblePathname(pathname),
    });
    const inset = surface.contentIsInset ? `${surface.drawerWidth}px` : "0px";
    const style = {
        "--grace-content-inset": inset,
        width: surface.contentIsInset ? `calc(100% - ${surface.drawerWidth}px)` : "100%",
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
