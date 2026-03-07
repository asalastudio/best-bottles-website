"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sectionLabels: Record<string, string> = {
    "/portal": "Overview",
    "/portal/orders": "Orders",
    "/portal/tracking": "Tracking",
    "/portal/drafts": "Drafts",
    "/portal/tools": "Tools",
    "/portal/grace": "Grace AI",
    "/portal/documents": "Documents",
    "/portal/account": "Account",
};

export default function PortalTopBar({
    inTransitCount = 0,
}: {
    inTransitCount?: number;
}) {
    const pathname = usePathname();
    const section = sectionLabels[pathname] ?? "Portal";

    return (
        <div className="h-12 bg-white border-b border-neutral-200 flex items-center justify-between px-6 sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-2">
                <span className="font-sans text-[13px] text-neutral-400">Portal</span>
                <span className="font-sans text-[13px] text-neutral-300">/</span>
                <span className="font-sans text-[13px] text-neutral-900 font-medium">{section}</span>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="font-sans text-[11px] text-emerald-700 font-medium">
                        {inTransitCount} in transit
                    </span>
                </div>

                <Link
                    href="/portal/drafts"
                    className="inline-flex items-center gap-1.5 font-sans text-[13px] font-medium text-white bg-neutral-900 px-3.5 h-8 rounded-md hover:bg-neutral-800 transition-colors"
                >
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3 h-3 shrink-0">
                        <line x1="6" y1="2" x2="6" y2="10" /><line x1="2" y1="6" x2="10" y2="6" />
                    </svg>
                    New Draft
                </Link>
            </div>
        </div>
    );
}
