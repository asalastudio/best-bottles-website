"use client";

import Link from "next/link";
import { ChevronRight } from "@/components/icons";

export interface BreadcrumbStep {
    label: string;
    href?: string;
}

export interface BreadcrumbsProps {
    steps: BreadcrumbStep[];
}

export default function Breadcrumbs({ steps }: BreadcrumbsProps) {
    if (!steps || steps.length === 0) return null;

    return (
        <div className="border-b border-champagne/50 bg-bone overflow-x-auto hide-scroll">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2 sm:py-3 flex items-center space-x-2 text-[11px] sm:text-xs text-slate whitespace-nowrap">
                <Link href="/" className="hover:text-muted-gold transition-colors shrink-0">Home</Link>
                {steps.map((step, idx) => {
                    const isLast = idx === steps.length - 1;
                    return (
                        <div key={idx} className="flex items-center space-x-2 shrink-0">
                            <ChevronRight className="w-3.5 h-3.5 text-slate/40 shrink-0" />
                            {isLast || !step.href ? (
                                <span className="text-obsidian font-medium truncate max-w-[150px] sm:max-w-[250px]" title={step.label}>
                                    {step.label}
                                </span>
                            ) : (
                                <Link
                                    href={step.href}
                                    className="hover:text-muted-gold transition-colors shrink-0"
                                >
                                    {step.label}
                                </Link>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
