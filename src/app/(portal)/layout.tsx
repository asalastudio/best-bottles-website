import { ReactNode } from "react";
import type { Metadata } from "next";
import PortalSidebar from "@/components/portal/PortalSidebar";
import PortalTopBar from "@/components/portal/PortalTopBar";

// Portal pages require Clerk auth at request time — never statically prerender.
// This single export propagates to all child pages under (portal)/.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Client Portal — Best Bottles",
};

export default function PortalLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-screen overflow-hidden bg-bone">
            <PortalSidebar />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <PortalTopBar />
                <main className="flex-1 overflow-auto bg-bone">
                    {children}
                </main>
            </div>
        </div>
    );
}
