"use client";

import { List, SquaresFour } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const executiveLanes = [
    { short: "OV", label: "Overview", href: "#overview", available: true },
    { short: "SA", label: "Sales", href: "#sales", available: true },
    { short: "PR", label: "Products", href: "#products", available: true },
    { short: "IN", label: "Inventory", href: "#inventory", available: true },
    { short: "OP", label: "Operations", href: "#operations", available: true },
    { short: "MF", label: "Manufacturing", available: false },
    { short: "CU", label: "Customers", href: "#customers", available: true },
    { short: "SU", label: "Suppliers", available: false },
    { short: "FI", label: "Financial", href: "#financial", available: true },
    { short: "EC", label: "Ecommerce", available: false },
    { short: "GR", label: "Grace", available: false },
    { short: "PL", label: "Platform", available: false },
] as const;

function LaneList({ mobile = false }: { mobile?: boolean }) {
    return (
        <nav aria-label="Executive Hub sections">
            <ul className={cn("space-y-2", mobile && "mt-6")}>
                {executiveLanes.map((lane, index) => (
                    <li key={lane.label}>
                        {lane.available ? (
                            <a
                                href={lane.href}
                                className={cn(
                                    "flex items-center border text-zinc-400 outline-none transition-colors hover:border-amber-300/70 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-amber-400",
                                    mobile
                                        ? "min-h-11 justify-between border-zinc-800 px-3 text-sm"
                                        : "size-10 justify-center border-zinc-800 text-[9px] font-semibold tracking-wider",
                                    index === 0 && "border-amber-300/70 bg-amber-300/15 text-amber-200",
                                )}
                                aria-current={index === 0 ? "page" : undefined}
                                title={mobile ? undefined : lane.label}
                            >
                                <span>{mobile ? lane.label : lane.short}</span>
                                {mobile ? <span className="text-[10px] text-zinc-600">Available</span> : null}
                            </a>
                        ) : (
                            <span
                                className={cn(
                                    "flex cursor-not-allowed items-center border border-zinc-900 text-zinc-700",
                                    mobile
                                        ? "min-h-11 justify-between px-3 text-sm"
                                        : "size-10 justify-center text-[9px] font-semibold tracking-wider",
                                )}
                                title={mobile ? undefined : `${lane.label} — awaiting source connection`}
                            >
                                <span>{mobile ? lane.label : lane.short}</span>
                                {mobile ? <span className="text-[10px]">Awaiting source</span> : null}
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </nav>
    );
}

export function ExecutiveNavigation() {
    return (
        <>
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-[60px] border-r border-zinc-800 bg-[#111216] pt-[66px] lg:block">
                <div className="flex justify-center py-4">
                    <SquaresFour className="size-4 text-amber-300" weight="fill" aria-hidden="true" />
                </div>
                <div className="px-2"><LaneList /></div>
            </aside>

            <div className="lg:hidden">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-9 rounded-none border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white"
                            aria-label="Open Executive Hub navigation"
                        >
                            <List className="size-4" aria-hidden="true" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="border-zinc-800 bg-[#111216] text-zinc-100">
                        <SheetHeader>
                            <SheetTitle className="font-serif text-zinc-100">BB / Executive</SheetTitle>
                            <SheetDescription className="text-zinc-500">Executive Hub sections and source readiness.</SheetDescription>
                        </SheetHeader>
                        <LaneList mobile />
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
}
