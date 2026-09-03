import type { PaperDollConfiguration, PaperDollMode } from "@/lib/paper-doll/types";

export type CylinderSelectionChange =
    | { dimension: "glass"; value: string }
    | { dimension: "deliverySystem"; value: PaperDollMode }
    | { dimension: "rollerMaterial"; value: "Metal" | "Plastic" }
    | { dimension: "finish"; value: string };

function rollerMaterial(configuration: PaperDollConfiguration): "Metal" | "Plastic" | null {
    if (configuration.mode !== "rollon") return null;
    return configuration.applicatorKey === "metal-roller" ? "Metal" : "Plastic";
}

export function selectCylinderConfiguration(
    configurations: readonly PaperDollConfiguration[],
    current: PaperDollConfiguration,
    change: CylinderSelectionChange,
): PaperDollConfiguration {
    let candidates: readonly PaperDollConfiguration[] = configurations;

    if (change.dimension === "glass") {
        candidates = configurations.filter((configuration) => configuration.glassLabel === change.value);
        return candidates.find((configuration) =>
            configuration.mode === current.mode
            && configuration.applicatorKey === current.applicatorKey
            && configuration.finishLabel === current.finishLabel,
        ) ?? candidates.find((configuration) =>
            configuration.mode === current.mode && configuration.applicatorKey === current.applicatorKey,
        ) ?? candidates.find((configuration) => configuration.mode === current.mode) ?? current;
    }

    if (change.dimension === "deliverySystem") {
        candidates = configurations.filter((configuration) =>
            configuration.glassLabel === current.glassLabel && configuration.mode === change.value,
        );
        return candidates[0] ?? current;
    }

    if (change.dimension === "rollerMaterial") {
        candidates = configurations.filter((configuration) =>
            configuration.glassLabel === current.glassLabel
            && configuration.mode === "rollon"
            && rollerMaterial(configuration) === change.value,
        );
        return candidates.find((configuration) => configuration.finishLabel === current.finishLabel)
            ?? candidates[0]
            ?? current;
    }

    candidates = configurations.filter((configuration) =>
        configuration.glassLabel === current.glassLabel
        && configuration.mode === current.mode
        && (current.mode !== "rollon" || configuration.applicatorKey === current.applicatorKey)
        && configuration.finishLabel === change.value,
    );
    return candidates[0] ?? current;
}
