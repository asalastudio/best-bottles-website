"use client";

import type { PaperDollConfiguration, PaperDollMode } from "@/lib/paper-doll/types";
import {
    getCylinderConfiguratorOptions,
    selectCylinderConfiguration,
    type CylinderSelectionChange,
} from "@/lib/products/unified-cylinder-pdp";
import { getMaterialSwatchStyle } from "@/lib/products/material-swatches";

const MODE_LABELS: Record<PaperDollMode, string> = {
    rollon: "Roll-On",
    spray: "Fine Mist Spray",
    lotion: "Lotion Pump",
};

function ChoiceLabel({ number, children }: { number: number; children: React.ReactNode }) {
    return (
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-obsidian">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-muted-gold text-[10px] font-bold text-muted-gold">{number}</span>
            {children}
        </h3>
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

    function choose(change: CylinderSelectionChange) {
        onSelect(selectCylinderConfiguration(configurations, selected, change), change);
    }

    return (
        <div className="space-y-5">
            <section aria-labelledby="glass-choice">
                <ChoiceLabel number={1}><span id="glass-choice">Glass color</span></ChoiceLabel>
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
            </section>

            <section aria-labelledby="applicator-choice">
                <ChoiceLabel number={2}><span id="applicator-choice">Applicator</span></ChoiceLabel>
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
            </section>

            {selected.mode === "rollon" && (
                <section aria-labelledby="roller-choice">
                    <ChoiceLabel number={3}><span id="roller-choice">Roller material</span></ChoiceLabel>
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
                </section>
            )}

            <section aria-labelledby="finish-choice">
                <ChoiceLabel number={selected.mode === "rollon" ? 4 : 3}><span id="finish-choice">Finish</span></ChoiceLabel>
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
            </section>
        </div>
    );
}

export { MODE_LABELS };
