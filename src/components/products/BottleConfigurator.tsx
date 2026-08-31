"use client";

import { useState } from "react";
import type { PaperDollConfiguration, PaperDollMode } from "@/lib/paper-doll/types";
import {
    getCylinderConfiguratorOptions,
    selectCylinderConfiguration,
    type CylinderSelectionChange,
} from "@/lib/products/unified-cylinder-pdp";
import { getMaterialSwatchStyle } from "@/lib/products/material-swatches";
import { ChevronDown } from "@/components/icons";

const MODE_LABELS: Record<PaperDollMode, string> = {
    rollon: "Roll-On",
    spray: "Fine Mist Spray",
    lotion: "Lotion Pump",
};

type StepKey = "glass" | "applicator" | "roller" | "finish";

function ChoiceLabel({ number, children }: { number: number; children: React.ReactNode }) {
    return (
        <h3 className="mb-2 hidden items-center gap-2 text-xs font-semibold text-obsidian lg:flex">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-muted-gold text-[10px] font-bold text-muted-gold">{number}</span>
            {children}
        </h3>
    );
}

/**
 * Mobile step header: collapses the step to a summary row showing the current
 * selection. Hidden on lg+, where every step stays expanded as before.
 */
function StepHeader({
    number,
    title,
    value,
    swatchLabel,
    open,
    onToggle,
}: {
    number: number;
    title: string;
    value: string;
    swatchLabel?: string;
    open: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className={`flex min-h-12 w-full items-center gap-2 border px-3 text-left lg:hidden ${open ? "border-obsidian bg-white" : "border-champagne bg-white"}`}
        >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-muted-gold text-[10px] font-bold text-muted-gold">{number}</span>
            <span className="text-xs font-semibold text-obsidian">{title}</span>
            <span className="ml-auto flex min-w-0 items-center gap-2">
                {swatchLabel ? (
                    <span className="h-5 w-5 shrink-0 rounded-full border border-black/10" style={getMaterialSwatchStyle(swatchLabel)} />
                ) : null}
                <span className="truncate text-[11px] font-semibold text-slate">{value}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate transition-transform ${open ? "rotate-180" : ""}`} />
            </span>
        </button>
    );
}

export default function BottleConfigurator({
    configurations,
    selected,
    onSelect,
}: {
    configurations: readonly PaperDollConfiguration[];
    selected: PaperDollConfiguration;
    onSelect: (configuration: PaperDollConfiguration, change: CylinderSelectionChange) => void;
}) {
    const options = getCylinderConfiguratorOptions(configurations, selected);
    // Mobile accordion: one step open at a time; desktop ignores this state.
    const [openStep, setOpenStep] = useState<StepKey>("glass");

    function choose(change: CylinderSelectionChange) {
        onSelect(selectCylinderConfiguration(configurations, selected, change), change);
        // Auto-advance the mobile accordion; browsing finishes stays open.
        if (change.dimension === "glass") setOpenStep("applicator");
        else if (change.dimension === "deliverySystem") setOpenStep(change.value === "rollon" ? "roller" : "finish");
        else if (change.dimension === "rollerMaterial") setOpenStep("finish");
    }

    function toggle(step: StepKey) {
        setOpenStep((current) => (current === step ? "finish" : step));
    }

    const rollerValue = selected.applicatorKey === "metal-roller" ? "Metal roller" : "Plastic roller";
    const sectionBody = (step: StepKey) => `${openStep === step ? "mt-2 block" : "hidden"} lg:mt-0 lg:block`;

    return (
        <div className="space-y-3 lg:space-y-5">
            <section aria-labelledby="glass-choice">
                <StepHeader number={1} title="Glass color" value={selected.glassLabel} swatchLabel={selected.glassLabel} open={openStep === "glass"} onToggle={() => toggle("glass")} />
                <ChoiceLabel number={1}><span id="glass-choice">Glass color</span></ChoiceLabel>
                <div className={sectionBody("glass")}>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5">
                        {options.glassColors.map((label) => {
                            const active = selected.glassLabel === label;
                            return (
                                <button
                                    key={label}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => choose({ dimension: "glass", value: label })}
                                    className={`min-h-14 border px-2 py-2 text-center text-[10px] font-semibold ${active ? "border-obsidian ring-1 ring-obsidian" : "border-champagne bg-white hover:border-muted-gold"}`}
                                >
                                    <span className="mx-auto mb-1 block h-6 w-6 rounded-full border border-black/10" style={getMaterialSwatchStyle(label)} />
                                    {label.replace("Cobalt ", "")}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section aria-labelledby="applicator-choice">
                <StepHeader number={2} title="Applicator" value={MODE_LABELS[selected.mode]} open={openStep === "applicator"} onToggle={() => toggle("applicator")} />
                <ChoiceLabel number={2}><span id="applicator-choice">Applicator</span></ChoiceLabel>
                <div className={sectionBody("applicator")}>
                    <div className="grid grid-cols-3 gap-2">
                        {options.deliverySystems.map((mode) => {
                            const active = selected.mode === mode;
                            return (
                                <button
                                    key={mode}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => choose({ dimension: "deliverySystem", value: mode })}
                                    className={`min-h-12 border px-2 py-2 text-[10px] font-semibold leading-tight ${active ? "border-obsidian bg-obsidian text-white" : "border-champagne bg-white text-obsidian hover:border-muted-gold"}`}
                                >
                                    {MODE_LABELS[mode]}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {selected.mode === "rollon" && (
                <section aria-labelledby="roller-choice">
                    <StepHeader number={3} title="Roller material" value={rollerValue} open={openStep === "roller"} onToggle={() => toggle("roller")} />
                    <ChoiceLabel number={3}><span id="roller-choice">Roller material</span></ChoiceLabel>
                    <div className={sectionBody("roller")}>
                        <div className="grid grid-cols-2 gap-2">
                            {options.rollerMaterials.map((material) => {
                                const active = selected.applicatorKey === (material === "Metal" ? "metal-roller" : "plastic-roller");
                                return (
                                    <button
                                        key={material}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => choose({ dimension: "rollerMaterial", value: material })}
                                        className={`min-h-11 border px-3 text-xs font-semibold ${active ? "border-obsidian bg-obsidian text-white" : "border-champagne bg-white text-obsidian hover:border-muted-gold"}`}
                                    >
                                        {material} roller
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            <section aria-labelledby="finish-choice">
                <StepHeader number={selected.mode === "rollon" ? 4 : 3} title="Finish" value={selected.finishLabel} swatchLabel={selected.finishLabel} open={openStep === "finish"} onToggle={() => toggle("finish")} />
                <ChoiceLabel number={selected.mode === "rollon" ? 4 : 3}><span id="finish-choice">Finish</span></ChoiceLabel>
                <div className={sectionBody("finish")}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                        {options.finishes.map((label) => {
                            const active = selected.finishLabel === label;
                            return (
                                <button
                                    key={label}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => choose({ dimension: "finish", value: label })}
                                    className={`flex min-h-11 items-center gap-2 border px-2 py-1.5 text-left text-[10px] font-semibold ${active ? "border-obsidian ring-1 ring-obsidian" : "border-champagne bg-white hover:border-muted-gold"}`}
                                >
                                    <span className="h-7 w-7 shrink-0 rounded-full border border-black/10" style={getMaterialSwatchStyle(label)} />
                                    <span className="leading-tight">{label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>
        </div>
    );
}

export { MODE_LABELS };
