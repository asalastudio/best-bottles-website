"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sectionLabels: Record<string, string> = {
    "/portal": "Dashboard",
    "/portal/orders": "Order History",
    "/portal/tracking": "Tracking",
    "/portal/drafts": "Saved Drafts",
    "/portal/tools": "Tools & Calculators",
    "/portal/grace": "Grace Workspace",
    "/portal/documents": "Documents",
    "/portal/account": "Account & Pricing",
};

export default function PortalTopBar() {
    const pathname = usePathname();
    const section = sectionLabels[pathname] ?? "Portal";

    const today = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    return (
        <div className="h-[56px] bg-linen border-b border-champagne flex items-center justify-between px-10 sticky top-0 z-10 shrink-0">

            {/* Breadcrumb */}
            <div className="flex items-center gap-2">
                <span className="font-sans text-xs text-ash/50">Portal</span>
                <span className="font-sans text-xs text-champagne">/</span>
                <span className="font-sans text-xs text-ash font-medium">{section}</span>
            </div>

            {/* Right cluster */}
            <div className="flex items-center gap-5">

                {/* In-transit indicator */}
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-gold shrink-0" />
                    <span className="font-sans text-xs text-ash">1 order in transit</span>
                </div>

                <div className="w-px h-4 bg-champagne" />

                {/* Quick action */}
                <Link
                    href="/portal/drafts"
                    className="inline-flex items-center gap-2 font-sans text-[11px] tracking-[0.12em] uppercase bg-muted-gold text-obsidian px-4 h-8 rounded-sm hover:bg-muted-gold/90 active:scale-[0.97] transition-all"
                >
                    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-[9px] h-[9px] shrink-0">
                        <line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" />
                    </svg>
                    New Draft
                </Link>

                <div className="w-px h-4 bg-champagne" />

                {/* Date */}
                <span className="font-sans text-xs text-ash/50">{today}</span>
            </div>
        </div>
    );
}
