"use client";

/**
 * Compact configuration rows: the active choice for every property the family
 * lets the customer decide, each opening its picker. Properties with one
 * compatible option are listed as facts, not controls.
 */
import type { CSSProperties } from "react";
import { CaretRight } from "@/components/icons";
import type { MobileConfigFact, MobileConfigOption, MobileConfigRow } from "@/lib/products/mobile-pdp-config-rows";
import type { MobilePickerType } from "@/lib/products/mobile-pdp-view-modes";

export function OptionThumb({ option, size = "md", className = "" }: { option: MobileConfigOption | undefined; size?: "sm" | "md" | "lg"; className?: string }) {
    const box = size === "lg" ? "h-20 w-20" : size === "sm" ? "h-9 w-9" : "h-12 w-12";
    if (option?.thumbUrl) {
        return (
            <span className={`${box} shrink-0 overflow-hidden rounded-[3px] bg-white ring-1 ring-champagne/70 ${className}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={option.thumbUrl} alt="" decoding="async" loading="lazy" className="h-full w-full object-contain" />
            </span>
        );
    }
    if (option?.swatchStyle) {
        return <span className={`${box} shrink-0 rounded-full ring-1 ring-champagne ${className}`} style={option.swatchStyle as CSSProperties} aria-hidden />;
    }
    return null;
}

export default function MobileConfigurationSummary({
    rows,
    facts,
    onOpen,
    registerRow,
}: {
    rows: MobileConfigRow[];
    facts: MobileConfigFact[];
    onOpen: (picker: MobilePickerType) => void;
    registerRow: (picker: MobilePickerType, el: HTMLButtonElement | null) => void;
}) {
    if (rows.length === 0 && facts.length === 0) return null;
    return (
        <div data-testid="mobile-pdp-configuration" className="border-y border-champagne/60 bg-white">
            {rows.map((row) => {
                const selected = row.options.find((option) => option.id === row.selectedId) ?? row.options[0];
                return (
                    <button
                        key={row.picker}
                        type="button"
                        ref={(el) => registerRow(row.picker, el)}
                        onClick={() => onOpen(row.picker)}
                        aria-haspopup="dialog"
                        aria-label={`${row.label}: ${selected?.label ?? ""}. Change`}
                        data-testid={`mobile-pdp-row-${row.picker}`}
                        className="flex min-h-[64px] w-full items-center gap-3 border-t border-champagne/60 px-4 py-3 text-left transition-colors first:border-t-0 hover:bg-linen/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold"
                    >
                        <OptionThumb option={selected} />
                        <span className="min-w-0 flex-1">
                            <span className="block text-2xs font-semibold uppercase tracking-label text-slate">{row.label}</span>
                            <span className="block truncate text-sm font-medium text-obsidian">{selected?.label}</span>
                        </span>
                        <CaretRight className="h-4 w-4 shrink-0 text-slate" aria-hidden />
                    </button>
                );
            })}
            {facts.length > 0 ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-champagne/60 px-4 py-3 first:border-t-0">
                    {facts.map((fact) => (
                        <div key={fact.label} className="min-w-0">
                            <dt className="text-2xs font-semibold uppercase tracking-label text-slate">{fact.label}</dt>
                            <dd className="truncate text-sm text-obsidian">{fact.value}</dd>
                        </div>
                    ))}
                </dl>
            ) : null}
        </div>
    );
}
