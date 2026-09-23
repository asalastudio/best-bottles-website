// Search vocabulary only: aliases never establish thread or physical compatibility.
export const COMPONENT_VOCABULARY = [
    { name: "Sprayer", aliases: ["spray top", "spray head", "spray pump", "fine mist", "fine-mist sprayer", "perfume sprayer", "atomizer", "atomiser", "bulb sprayer", "tassel sprayer"] },
    { name: "Lotion Pump", aliases: ["treatment pump", "lotion top", "serum pump", "dispensing pump"] },
    { name: "Roller", aliases: ["roller ball", "rollerball", "roll on", "roll-on", "roller insert", "roller plug", "metal roller", "plastic roller"] },
    { name: "Roll-On Cap", aliases: ["roller cap", "roll on lid", "roll-on cap", "roller closure"] },
    { name: "Dropper", aliases: ["pipette", "pipette dropper", "bulb dropper", "dropper top"] },
    { name: "Reducer", aliases: ["orifice reducer", "flow restrictor", "reducer insert", "drop reducer"] },
    { name: "Cap", aliases: ["lid", "closure", "screw cap", "short cap", "tall cap", "lined cap", "overcap", "over cap", "protective cap"] },
] as const;
export function componentSearchText(name: string, kind: string, sku: string) {
    const words = COMPONENT_VOCABULARY.find(item => item.name === kind)?.aliases ?? [];
    return [name, kind, sku, ...words].join(" ").toLowerCase();
}
export function componentMechanismKey(kind: string, name: string, sku: string) {
    const text = `${name} ${sku}`.toLowerCase();
    if (kind === "Sprayer") return /tassel|ansptsl/.test(text) ? "tassel_sprayer" : /bulb|antique|vintage|ansp/.test(text) ? "bulb_sprayer" : "mist_sprayer";
    if (kind === "Roller") return /metal|mtl/.test(text) ? "metal_roller" : /plastic/.test(text) ? "plastic_roller" : "roller_unknown";
    return kind;
}
