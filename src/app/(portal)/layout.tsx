import { ReactNode } from "react";
import type { Metadata } from "next";
import PortalSidebar from "@/components/portal/PortalSidebar";
import PortalTopBar from "@/components/portal/PortalTopBar";
import { getPortalShellData } from "@/lib/portal/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Client Portal — Best Bottles",
};

export default async function PortalLayout({ children }: { children: ReactNode }) {
    const shell = await getPortalShellData();

    return (
        <div className="flex h-screen overflow-hidden bg-neutral-50">
            <PortalSidebar
                companyName={shell.account?.companyName ?? null}
                tierLabel={shell.account?.tier ?? null}
            />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <PortalTopBar inTransitCount={shell.inTransitCount} />
                <main className="flex-1 overflow-auto bg-neutral-50">
                    {shell.viewer.clerkOrgId ? (
                        children
                    ) : (
                        <div className="px-6 py-10 max-w-[760px]">
                            <div className="bg-white border border-neutral-200 rounded-lg px-6 py-6">
                                <h1 className="font-sans text-[22px] font-semibold text-neutral-900 mb-2">
                                    Choose your organization to use the portal
                                </h1>
                                <p className="font-sans text-sm text-neutral-500 leading-relaxed">
                                    Your account is signed in, but there is no active Clerk organization selected for this session yet.
                                    Once an organization is active, orders, drafts, and account data will sync to the portal automatically.
                                </p>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
