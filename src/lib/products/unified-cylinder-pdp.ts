import type { PaperDollConfiguration, PaperDollMode } from "@/lib/paper-doll/types";

export type UnifiedPdpView = "beauty" | "build";
export type CylinderSelectionChange =
    | { dimension: "glass"; value: string }
    | { dimension: "deliverySystem"; value: PaperDollMode }
    | { dimension: "rollerMaterial"; value: "Metal" | "Plastic" }
    | { dimension: "finish"; value: string };

const GLASS_ORDER = ["Clear", "Amber", "Frosted", "Cobalt Blue", "Swirl"];
const MODE_ORDER: PaperDollMode[] = ["rollon", "spray", "lotion"];
const ROLLER_ORDER = ["Metal", "Plastic"] as const;

function uniqueInOrder<T extends string>(values: readonly T[], order: readonly string[]): T[] {
    const unique = [...new Set(values)];
    return unique.sort((a, b) => {
        const ai = order.indexOf(a);
        const bi = order.indexOf(b);
        return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi) || a.localeCompare(b);
    });
}

function rollerMaterial(configuration: PaperDollConfiguration): "Metal" | "Plastic" | null {
    if (configuration.mode !== "rollon") return null;
    return configuration.applicatorKey === "metal-roller" ? "Metal" : "Plastic";
}

export function resolveUnifiedPdpView(
    requestedView: string | null | undefined,
    _buildReady: boolean,
): UnifiedPdpView {
    return requestedView === "build" ? "build" : "beauty";
}

export function resolveCylinderConfigurationFromQuery(
    configurations: readonly PaperDollConfiguration[],
    requestedSku: string | null | undefined,
): { configuration: PaperDollConfiguration; invalidConfiguration: boolean } {
    if (configurations.length === 0) throw new Error("The unified Cylinder PDP requires at least one configuration");
    const defaultConfiguration = configurations.find((configuration) =>
        configuration.glassLabel === "Clear"
        && configuration.mode === "rollon"
        && configuration.applicatorKey === "metal-roller"
        && configuration.finishLabel === "Matte Gold",
    ) ?? configurations.find((configuration) =>
        configuration.glassLabel === "Clear"
        && configuration.mode === "rollon"
        && configuration.applicatorKey === "metal-roller",
    ) ?? configurations.find((configuration) => configuration.glassLabel === "Clear" && configuration.mode === "rollon")
        ?? configurations[0];
    if (!requestedSku) return { configuration: defaultConfiguration, invalidConfiguration: false };
    const exact = configurations.find((configuration) => configuration.graceSku === requestedSku);
    return {
        configuration: exact ?? defaultConfiguration,
        invalidConfiguration: !exact,
    };
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

export function getCylinderConfiguratorOptions(
    configurations: readonly PaperDollConfiguration[],
    selected: PaperDollConfiguration,
): {
    glassColors: string[];
    deliverySystems: PaperDollMode[];
    rollerMaterials: Array<"Metal" | "Plastic">;
    finishes: string[];
} {
    const forGlass = configurations.filter((configuration) => configuration.glassLabel === selected.glassLabel);
    const forSystem = forGlass.filter((configuration) => configuration.mode === selected.mode);
    const forMaterial = selected.mode === "rollon"
        ? forSystem.filter((configuration) => configuration.applicatorKey === selected.applicatorKey)
        : forSystem;

    return {
        glassColors: uniqueInOrder(configurations.map((configuration) => configuration.glassLabel), GLASS_ORDER),
        deliverySystems: uniqueInOrder(forGlass.map((configuration) => configuration.mode), MODE_ORDER),
        rollerMaterials: selected.mode === "rollon"
            ? uniqueInOrder(
                forSystem.map(rollerMaterial).filter((value): value is "Metal" | "Plastic" => Boolean(value)),
                ROLLER_ORDER,
            )
            : [],
        finishes: uniqueInOrder(forMaterial.map((configuration) => configuration.finishLabel), []),
    };
}

export function isUnifiedCylinderBuildReady(
    configurations: readonly PaperDollConfiguration[],
    assetsReady: boolean,
): boolean {
    return assetsReady
        && configurations.length === 145
        && new Set(configurations.map((configuration) => configuration.graceSku)).size === 145;
}
