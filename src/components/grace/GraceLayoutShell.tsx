"use client";

import { type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { mayRecordSession } from "@/lib/analytics/sessionReplayScope";
import { useGrace } from "@/components/useGrace";

export default function GraceLayoutShell({ children }: { children: ReactNode }) {
    const privateRoute = !mayRecordSession(usePathname());
    const { surface } = useGrace();
    const inset = surface.contentIsInset ? `${surface.drawerWidth}px` : "0px";
    const style = {
        "--grace-content-inset": inset,
        width: surface.contentIsInset ? `calc(100% - ${surface.drawerWidth}px)` : "100%",
    } as CSSProperties;

    return (
        <div
            data-ph-private={privateRoute || undefined}
            data-grace-layout={surface.mode}
            style={style}
            className={`min-h-screen min-w-0 transition-[width] duration-300 ease-out${privateRoute ? " ph-no-capture ph-block" : ""}`}
        >
            {children}
        </div>
    );
}
