import { compatibleFinishComponent, groupBuilderBodies, resolveBuilderConfigurations, isBuilderCandidate, type CatalogRow, type BuilderKit } from "../../src/lib/bottle-builder/model";
import { catalogIncludedAssembly } from "../../convex/catalogIncludedAssemblies";

/** Structural configuration readiness is not visual approval or deployed UI
 * proof. Keep known semantic artwork defects separate from sale eligibility. */
export function cylinderArtworkWarnings(row: Pick<CatalogRow, "family" | "capacityMl" | "neckThreadSize" | "applicator">, kit: BuilderKit | null) {
    if (row.family !== "Cylinder" || !kit || !["Fine Mist Sprayer", "Lotion Pump"].includes(row.applicator ?? "")) return [];
    const slots = new Set(kit.parts.map(part => part.slot));
    const warnings: string[] = [];
    if (row.capacityMl === 9 && row.neckThreadSize === "17-415" && !slots.has("diptube")) warnings.push("missing_9ml_dip_tube");
    if (row.capacityMl === 25 && row.neckThreadSize === "18-415" && slots.has("overcap")
        && [...slots].every(slot => ["body", "diptube", "overcap"].includes(slot))) warnings.push("missing_25ml_exposed_mechanism");
    return warnings;
}

/** Read-only assessment using the same matcher and kit validation as the builder. */
export function auditFamilyReadiness(rows: CatalogRow[], kits: (BuilderKit | null)[]) {
    const resolve = (input: CatalogRow[]) => {
        const configs = resolveBuilderConfigurations(input, kits);
        const visible = new Set(groupBuilderBodies(configs.filter(c => c !== null)).flatMap(b => b.configurations.map(c => c.id)));
        return { configs, visible };
    };
    const current = resolve(rows);
    return rows.map((row, i) => {
        const selected = compatibleFinishComponent(row);
        const blockers: string[] = [];
        const visible = current.visible.has(row.websiteSku!);
        if (!visible) {
            if (/__RETIRED__/i.test(row.websiteSku ?? "")) blockers.push("retired_assembly");
            if (row.resolution === "unknown" && !catalogIncludedAssembly(row)) blockers.push("missing_bottle_component_links");
            if (!selected) blockers.push("exact_component_unresolved");
            if (row.shopifySellable === false) blockers.push("assembly_unpublished_or_unsellable");
            if (!row.shopifyVariantId) blockers.push("missing_assembly_checkout_variant");
            if (/out of stock|unavailable|discontinued/i.test(row.stockStatus ?? "")) blockers.push("assembly_stock_unavailable");
            if (!(typeof row.webPrice1pc === "number" && row.webPrice1pc > 0 && Number.isFinite(row.webPrice1pc))) blockers.push("invalid_assembly_price");
            if (current.configs[i]) blockers.push("ambiguous_selection_identity");
            if (!blockers.length) blockers.push("media_or_configuration_invalid");
        }
        return {
            sku: row.websiteSku, graceSku: row.graceSku, family: row.family, capacityMl: row.capacityMl,
            glass: row.color, neck: row.neckThreadSize, fitment: row.applicator, finish: row.capColor,
            visible, blockers, componentSku: selected?.websiteSku ?? null,
            catalogCandidate: isBuilderCandidate(row),
            artworkWarnings: cylinderArtworkWarnings(row, kits[i]),
            includedAssemblySource: catalogIncludedAssembly(row)?.sourceUrl ?? null,
            componentStandaloneSellable: Object.values(row.components).flat().find(part => part.websiteSku === selected?.websiteSku)?.shopifySellable ?? null,
            compatibilitySources: row.compatibilitySources ?? [],
            kit: kits[i] ? { completeness: kits[i]!.completeness, conflicts: kits[i]!.conflicts,
                slots: kits[i]!.parts.map(p => p.slot), familyId: kits[i]!.familyId } : null,
            assemblySellable: row.shopifySellable, stockStatus: row.stockStatus,
        };
    });
}
