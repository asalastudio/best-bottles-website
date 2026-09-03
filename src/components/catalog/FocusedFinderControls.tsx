"use client";

import type { RollerMaterial } from "@/lib/catalogFilters";

export type FocusedFinderOption<T extends string = string> = {
    value: T;
    label: string;
    count: number;
};

type FocusedFinderControlsProps = {
    capacityOptions: readonly FocusedFinderOption[];
    rollerMaterialOptions: readonly FocusedFinderOption<RollerMaterial>[];
    selectedCapacities: readonly string[];
    selectedRollerMaterials: readonly RollerMaterial[];
    onToggleCapacity: (capacity: string) => void;
    onToggleRollerMaterial: (material: RollerMaterial) => void;
    className?: string;
};

function RefinementButton({
    label,
    count,
    selected,
    onClick,
}: {
    label: string;
    count: number;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            className={`flex min-h-11 w-full items-center justify-between gap-3 border-b border-champagne/45 px-3 text-left text-sm transition-colors last:border-b-0 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold motion-reduce:transition-none ${
                selected ? "bg-obsidian text-bone" : "bg-linen text-obsidian hover:bg-bone"
            }`}
        >
            <span>{label}</span>
            <span className={`text-xs tabular-nums ${selected ? "text-champagne" : "text-slate"}`}>{count}</span>
        </button>
    );
}

export default function FocusedFinderControls({
    capacityOptions,
    rollerMaterialOptions,
    selectedCapacities,
    selectedRollerMaterials,
    onToggleCapacity,
    onToggleRollerMaterial,
    className = "",
}: FocusedFinderControlsProps) {
    return (
        <div className={`border border-champagne/70 bg-linen ${className}`}>
            <p className="border-b border-champagne/70 px-4 py-3 text-sm leading-relaxed text-slate">
                Refine these results if capacity or roller construction matters to your order.
            </p>
            <fieldset className="border-b border-champagne/70 p-3">
                <legend className="px-1 font-serif text-lg text-obsidian">Capacity</legend>
                <div className="mt-2 border border-champagne/60">
                    {capacityOptions.map((option) => (
                        <RefinementButton
                            key={option.value}
                            label={option.label}
                            count={option.count}
                            selected={selectedCapacities.includes(option.value)}
                            onClick={() => onToggleCapacity(option.value)}
                        />
                    ))}
                </div>
            </fieldset>
            <fieldset className="p-3">
                <legend className="px-1 font-serif text-lg text-obsidian">Roller Material</legend>
                <div className="mt-2 border border-champagne/60">
                    {rollerMaterialOptions.map((option) => (
                        <RefinementButton
                            key={option.value}
                            label={option.label}
                            count={option.count}
                            selected={selectedRollerMaterials.includes(option.value)}
                            onClick={() => onToggleRollerMaterial(option.value)}
                        />
                    ))}
                </div>
            </fieldset>
        </div>
    );
}
