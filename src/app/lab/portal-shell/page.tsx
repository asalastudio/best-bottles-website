"use client";

import { PortalChromeFrame } from "@/components/portal/PortalChrome";
import { PortalButton, StatCard } from "@/components/portal/ui";

export default function PortalShellLab() {
    return (
        <PortalChromeFrame
            orgName="ASALA"
            tierLabel="Portal access"
            inTransitCount={0}
            sectionLabel="Overview"
            navPathname="/portal"
            accountControl={<span className="grid h-7 w-7 place-items-center rounded-full bg-neutral-200 text-[11px] font-medium">A</span>}
        >
            <div className="mx-auto max-w-[1200px] px-4 py-4 lg:px-6 lg:py-6">
                <div className="mb-5 flex flex-col gap-3 lg:mb-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                        <h1 className="font-sans text-[20px] font-semibold leading-tight text-neutral-900 lg:text-[22px]">
                            Welcome back, ASALA
                        </h1>
                        <p className="mt-0.5 font-sans text-sm text-neutral-400">Awaiting sync · Taxable</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-11 min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-3 font-sans text-[13px] font-medium text-neutral-700 lg:h-8 lg:min-h-8">
                            Talk with Grace
                        </span>
                        <PortalButton size="sm" className="h-11 min-h-11 px-4 lg:h-8 lg:min-h-8">
                            New Draft
                        </PortalButton>
                    </div>
                </div>
                <div className="mb-5 grid grid-cols-2 gap-2.5 lg:mb-6 lg:grid-cols-4 lg:gap-3">
                    <StatCard label="YTD Spend" value="$0" sub="Delivered orders this year" highlight />
                    <StatCard label="Active Orders" value="0" sub="0 in transit" />
                    <StatCard label="Units In Flight" value="0" sub="Across active shipments" />
                    <StatCard label="Open Drafts" value="2" sub="Portal access" />
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                        <div className="border-b border-neutral-200 px-5 py-3">
                            <h2 className="font-sans text-[14px] font-semibold text-neutral-900">Active Orders</h2>
                        </div>
                        <p className="px-5 py-8 font-sans text-[13px] text-neutral-500">
                            No active orders yet. Once orders sync into Convex, they will show up here automatically.
                        </p>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                        <div className="border-b border-neutral-200 px-5 py-3">
                            <h2 className="font-sans text-[14px] font-semibold text-neutral-900">Recent Deliveries</h2>
                        </div>
                        <p className="px-5 py-8 font-sans text-[13px] text-neutral-500">
                            Delivered orders will appear here once your order history is synced.
                        </p>
                    </div>
                </div>
            </div>
        </PortalChromeFrame>
    );
}
