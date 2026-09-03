"use client";

import { Camera, Cube, Ruler, Stack } from "@phosphor-icons/react";
import type { ComponentType } from "react";
import type { PdpStageMode, PdpStageModeOption } from "@/lib/products/pdp-stage-modes";

const MODE_ICONS: Record<PdpStageMode, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
    photo: Camera,
    "3d": Cube,
    exploded: Stack,
    dimensions: Ruler,
};

export default function PdpStageModeDock({
    modes,
    activeMode,
    onModeChange,
}: {
    modes: readonly PdpStageModeOption[];
    activeMode: PdpStageMode | null;
    onModeChange: (mode: PdpStageMode) => void;
}) {
    if (modes.length < 2) return null;

    return (
        <div
            role="tablist"
            aria-label="Product view"
            className="grid auto-cols-fr grid-flow-col border-x border-b border-champagne/60 bg-white"
        >
            {modes.map((mode) => {
                const Icon = MODE_ICONS[mode.id];
                const selected = activeMode === mode.id;
                return (
                    <button
                        key={mode.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => onModeChange(mode.id)}
                        className={`flex min-h-11 items-center justify-center gap-2 border-l border-champagne/60 px-3 py-2.5 text-xs font-semibold transition-colors first:border-l-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold motion-reduce:transition-none ${
                            selected
                                ? "bg-obsidian text-white"
                                : "bg-white text-slate hover:text-obsidian"
                        }`}
                    >
                        <Icon className="h-4 w-4" aria-hidden />
                        <span>{mode.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
