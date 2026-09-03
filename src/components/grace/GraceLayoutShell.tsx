"use client";

import { type CSSProperties, type ReactNode } from "react";
import { useGrace } from "@/components/useGrace";

export default function GraceLayoutShell({ children }: { children: ReactNode }) {
    const { surface } = useGrace();
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
