"use client";

import Link from "next/link";
import type { ApplicatorNavValue } from "@/lib/catalogFilters";

export type FocusedApplicationOption = {
    value: ApplicatorNavValue;
    label: string;
    description?: string;
    count?: number;
    href?: string;
};

type FocusedApplicationCardsProps = {
    applications: readonly FocusedApplicationOption[];
    activeApplication: ApplicatorNavValue | null;
    onSelect?: (application: ApplicatorNavValue) => void;
    className?: string;
};

function applicationClassName(active: boolean): string {
    return [
        "group flex min-h-11 w-full items-center justify-between gap-4 px-4 py-3 text-left",
        "focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold",
        "motion-reduce:transition-none",
        active
            ? "bg-obsidian text-bone"
            : "bg-linen text-obsidian transition-colors hover:bg-bone",
    ].join(" ");
}

function ApplicationContent({ option, active }: { option: FocusedApplicationOption; active: boolean }) {
    return (
        <>
            <span className="min-w-0">
                <span className="block font-serif text-xl leading-none">{option.label}</span>
                {option.description ? (
                    <span className={`mt-1.5 block text-xs leading-relaxed ${active ? "text-bone/70" : "text-slate"}`}>
                        {option.description}
                    </span>
                ) : null}
            </span>
            {option.count != null ? (
                <span className={`shrink-0 text-xs tabular-nums ${active ? "text-champagne" : "text-slate"}`}>
                    {option.count}
                </span>
            ) : null}
        </>
    );
}

export default function FocusedApplicationCards({
    applications,
    activeApplication,
    onSelect,
    className = "",
}: FocusedApplicationCardsProps) {
    return (
        <nav aria-label="Choose an application" className={className}>
            <div className="grid gap-px border border-champagne/70 bg-champagne/70 sm:grid-cols-2 lg:grid-cols-5">
                {applications.map((option) => {
                    const active = option.value === activeApplication;
                    return option.href ? (
                        <Link
                            key={option.value}
                            href={option.href}
                            aria-current={active ? "page" : undefined}
                            className={applicationClassName(active)}
                        >
                            <ApplicationContent option={option} active={active} />
                        </Link>
                    ) : (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onSelect?.(option.value)}
                            className={applicationClassName(active)}
                        >
                            <ApplicationContent option={option} active={active} />
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
