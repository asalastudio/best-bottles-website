"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CaretDown } from "@/components/icons";

type Props = {
    title: string;
    defaultOpen?: boolean;
    expanded?: boolean;
    onToggle?: () => void;
    hasActiveFilters?: boolean;
    activeCount?: number;
    children: ReactNode;
};

/**
 * Shared visual shell for catalog facets. The filtering state remains owned by
 * the URL-backed catalog contract; this component only controls disclosure.
 */
export default function RefineSection({
    title,
    defaultOpen = false,
    expanded,
    onToggle,
    hasActiveFilters = false,
    activeCount = 0,
    children,
}: Props) {
    const hasActive = hasActiveFilters || activeCount > 0;
    const [internalOpen, setInternalOpen] = useState(defaultOpen || hasActive);
    const isOpen = expanded ?? internalOpen;
    const contentId = useId();
    const toggle = onToggle ?? (() => setInternalOpen((current) => !current));
    const showGlow = hasActive && !isOpen;

    return (
        <div className={`-mx-2 mb-1 rounded-lg border-b border-champagne/50 px-2 pb-1 transition-all duration-200 ${showGlow ? "bg-muted-gold/5 ring-1 ring-muted-gold/40 ring-offset-1 ring-offset-bone" : ""}`}>
            <button
                type="button"
                onClick={toggle}
                className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate transition-colors hover:text-obsidian"
                aria-expanded={isOpen}
                aria-controls={contentId}
            >
                <span className={`flex min-w-0 items-center gap-2 ${hasActive ? "text-muted-gold" : ""}`}>
                    <span>{title}</span>
                    {activeCount > 0 && (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-obsidian px-1.5 py-0.5 text-[9px] leading-none text-white" aria-label={`${activeCount} selected`}>
                            {activeCount}
                        </span>
                    )}
                </span>
                <CaretDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-0" : "-rotate-90"}`} />
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        id={contentId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="pb-3 pt-1">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
