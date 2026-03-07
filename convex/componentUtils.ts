type RawComponent = Record<string, unknown>;

export interface NormalizedComponent {
    graceSku: string;
    itemName: string;
    imageUrl: string | null;
    webPrice1pc: number | null;
    webPrice12pc: number | null;
    capColor: string | null;
    stockStatus: string | null;
}

function asRecord(value: unknown): RawComponent | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as RawComponent)
        : null;
}

function toStringOrEmpty(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function toNumberOrNull(value: unknown): number | null {
    return typeof value === "number" ? value : null;
}

export function inferComponentType(graceSku: string, itemName?: string): string {
    const sku = graceSku.toUpperCase();
    const name = (itemName ?? "").toLowerCase();
    if (sku.includes("DRP")) return "Dropper";
    if (sku.includes("ROC")) return "Roll-On Cap";
    if (sku.includes("AST") || sku.includes("ASP") || sku.includes("SPR") || sku.includes("ATM")) return "Sprayer";
    if (sku.includes("LPM")) return "Lotion Pump";
    if (sku.includes("RDC")) return "Reducer";
    if (sku.includes("ROL") || sku.includes("MRL") || sku.includes("RON") || sku.includes("MRO") || sku.includes("RBL")) return "Roller";
    if (name.includes("sprayer") || name.includes("bulb") || name.includes("atomizer")) return "Sprayer";
    if (name.includes("lotion") && name.includes("pump")) return "Lotion Pump";
    if (name.includes("dropper")) return "Dropper";
    if (name.includes("reducer")) return "Reducer";
    if (name.includes("cap") || name.includes("closure")) return "Cap";
    return "Accessory";
}

export function normalizeComponent(value: unknown): NormalizedComponent {
    const item = asRecord(value) ?? {};
    const graceSku = toStringOrEmpty(item.graceSku) || toStringOrEmpty(item.grace_sku);
    const itemName = toStringOrEmpty(item.itemName) || toStringOrEmpty(item.item_name);
    return {
        graceSku,
        itemName,
        imageUrl: toStringOrEmpty(item.imageUrl) || toStringOrEmpty(item.image_url) || null,
        webPrice1pc: toNumberOrNull(item.webPrice1pc) ?? toNumberOrNull(item.web_price_1pc) ?? toNumberOrNull(item.price_1),
        webPrice12pc: toNumberOrNull(item.webPrice12pc) ?? toNumberOrNull(item.web_price_12pc) ?? toNumberOrNull(item.price_12),
        capColor: toStringOrEmpty(item.capColor) || toStringOrEmpty(item.cap_color) || null,
        stockStatus: toStringOrEmpty(item.stockStatus) || toStringOrEmpty(item.stock_status) || null,
    };
}

export function normalizeComponentsByType(
    components: unknown,
): Record<string, NormalizedComponent[]> {
    const grouped: Record<string, NormalizedComponent[]> = {};

    if (Array.isArray(components)) {
        for (const raw of components) {
            const normalized = normalizeComponent(raw);
            const type = inferComponentType(normalized.graceSku, normalized.itemName);
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(normalized);
        }
        return grouped;
    }

    const map = asRecord(components);
    if (!map) return grouped;

    for (const [type, items] of Object.entries(map)) {
        if (!Array.isArray(items)) continue;
        grouped[type] = items.map((item) => normalizeComponent(item));
    }

    return grouped;
}

type BottleLike = {
    family?: string | null;
    capacityMl?: number | null;
    capacity?: string | null;
    itemName?: string | null;
    color?: string | null;
    neckThreadSize?: string | null;
};

type FitmentRuleLike = {
    threadSize?: string | null;
    bottleName?: string | null;
    familyHint?: string | null;
    capacityMl?: number | null;
    components?: unknown;
};

const FITMENT_COMPONENT_MAP: Record<string, string[]> = {
    Reducer: ["Reducer"],
    "Short Cap with Liner": ["Short Cap", "Cap"],
    "Tall Cap with Liner": ["Short Cap", "Cap"],
    Dropper: ["Dropper"],
    Sprayer: ["Sprayer"],
    "Bulb Sprayer": ["Antique Bulb Sprayer"],
    "Lotion Pump": ["Lotion Pump"],
    "Roller Plug (Plastic)": ["Plastic Roller"],
    "Roller Plug (Metal)": ["Metal Roller"],
    "Roll-On Cap": ["Roll-On Cap"],
};

function normalizeText(value: string | null | undefined): string {
    return (value ?? "").trim().toLowerCase();
}

function parseCapacityMl(bottle: BottleLike): number | null {
    if (typeof bottle.capacityMl === "number" && Number.isFinite(bottle.capacityMl)) {
        return bottle.capacityMl;
    }

    const raw = normalizeText(bottle.capacity);
    const match = raw.match(/([\d.]+)\s*ml/);
    return match ? Number(match[1]) : null;
}

function isFrostedBottle(bottle: BottleLike): boolean {
    const haystack = `${normalizeText(bottle.itemName)} ${normalizeText(bottle.color)}`;
    return haystack.includes("frost");
}

export function selectBestFitmentRule(
    fitmentRules: unknown,
    bottle: BottleLike,
): FitmentRuleLike | null {
    if (!Array.isArray(fitmentRules)) return null;

    const bottleThread = normalizeText(bottle.neckThreadSize);
    const bottleFamily = normalizeText(bottle.family);
    const bottleCapacity = parseCapacityMl(bottle);
    const bottleFrosted = isFrostedBottle(bottle);
    const bottleName = normalizeText(bottle.itemName);

    let bestRule: FitmentRuleLike | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const rawRule of fitmentRules) {
        const rule = asRecord(rawRule);
        if (!rule) continue;

        const threadSize = normalizeText(toStringOrEmpty(rule.threadSize));
        if (threadSize !== bottleThread) continue;

        const familyHint = normalizeText(toStringOrEmpty(rule.familyHint));
        const ruleName = normalizeText(toStringOrEmpty(rule.bottleName));
        const ruleCapacity = typeof rule.capacityMl === "number" && Number.isFinite(rule.capacityMl)
            ? rule.capacityMl
            : null;
        const ruleFrosted = ruleName.includes("frost");

        let score = 100;

        if (bottleFamily) {
            if (familyHint === bottleFamily) score += 40;
            else if (ruleName.startsWith(bottleFamily)) score += 30;
            else score -= 100;
        }

        if (bottleCapacity != null) {
            if (ruleCapacity === bottleCapacity) score += 25;
            else if (ruleCapacity != null) score -= 25;
        }

        if (bottleFrosted === ruleFrosted) score += 10;
        else score -= 10;

        if (bottleName && ruleName && bottleName.includes(ruleName)) score += 10;

        if (score > bestScore) {
            bestScore = score;
            bestRule = rule as FitmentRuleLike;
        }
    }

    return bestScore >= 100 ? bestRule : null;
}

export function filterGroupedComponentsByFitmentRule(
    grouped: Record<string, NormalizedComponent[]>,
    fitmentRule: FitmentRuleLike | null,
): Record<string, NormalizedComponent[]> {
    if (!fitmentRule) return grouped;

    const rawComponents = asRecord(fitmentRule.components);
    if (!rawComponents) return grouped;

    const allowedTypes = new Set<string>();
    for (const [fitmentType, marker] of Object.entries(rawComponents)) {
        if (marker !== "✓") continue;
        for (const mappedType of FITMENT_COMPONENT_MAP[fitmentType] ?? []) {
            allowedTypes.add(mappedType);
        }
    }

    if (allowedTypes.size === 0) return grouped;

    return Object.fromEntries(
        Object.entries(grouped).filter(([type]) => allowedTypes.has(type)),
    );
}
