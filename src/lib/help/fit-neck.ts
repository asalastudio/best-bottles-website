/**
 * The neck-finish builder: choose a bottle, then an applicator, then a closure.
 *
 * Built from the fit index (what fits) and the fit media manifest (approved
 * master images with true-scale geometry, scripts/help/build_fit_media.py).
 * A finish gets a builder only when every bottle and part on it has media.
 */
import fitMedia from "./fit-media.generated.json";
import { allBodies, bodyLabel, closureGroup, componentById, fitHref, itemCatalogHref, neckRuling, type FitBody } from "./fit";

export type MediaImage = { src: string; width: number; height: number; pxPerMm: number; axisX: number; seatY: number };
type NeckMedia = { bodies: Record<string, MediaImage & { source: string }>; parts: Record<string, MediaImage & { source: string; overcap?: MediaImage }> };

const MEDIA = (fitMedia as { necks: Record<string, NeckMedia> }).necks;

export type BuilderPart = { id: string; itemCode: string | null; name: string; finish: string; group: string; image: MediaImage; overcap: MediaImage | null; catalogUrl: string | null };
export type BuilderBottle = {
    id: string; label: string; family: string; capacityMl: number | null; heightMm: number | null; diameterMm: number | null;
    image: MediaImage; fitUrl: string; fits: string[]; rollers: Array<"plastic" | "metal">;
    products: Array<{ sku: string; parts: string[] }>;
};
export type ApplicatorKey = "roll-plastic" | "roll-metal" | "spray" | "none" | "lotion" | "reducer";
export type Applicator = { key: ApplicatorKey; label: string; note: string; available: boolean; elsewhere: string[] };
export type CapGroup = { key: string; label: string; note: string; partIds: string[] };
export type NeckBuilder = {
    neck: string;
    ruling: { date: string; statement: string } | null;
    bottles: BuilderBottle[];
    parts: Record<string, BuilderPart>;
    rollers: { plastic: string | null; metal: string | null };
    sprayers: string[];
    rollOnCaps: string[];
    capGroups: CapGroup[];
    applicators: Applicator[];
};

const GROUP_NOTES: Record<string, string> = {
    "short-ribbed-cap": "Black or white",
    "short-cap": "Foam liner, metal-look finishes",
    "tall-cap": "24 mm high, gold or silver",
    "liner-cap": "Caps with liner",
};

/** "Matte blue Fine Mist Sprayer, Thread size 13-415" → "Matte blue". */
export function finishName(name: string): string {
    const text = name
        .replace(/,?\s*Thread\s*size.*$/i, "").replace(/,?\s*Threadsize.*$/i, "")
        .replace(/Fine Mist Sprayer/i, "")
        .replace(/cap with dots or closure for rollon bottles/i, "dotted")
        .replace(/cap or closure for rollon bottles/i, "")
        .replace(/lid or closure for glass bottle/i, "")
        .replace(/short cap with liner/i, "")
        .replace(/\s+/g, " ").trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export function neckBuilderNecks(): string[] {
    return Object.keys(MEDIA).sort();
}

export function neckBuilderHref(neck: string): string {
    return `/help/fit/neck/${encodeURIComponent(neck)}`;
}

/** Which other necks offer an applicator type this neck does not. */
function necksWith(type: string): string[] {
    const necks = new Set<string>();
    for (const body of allBodies()) {
        if (!body.interchangeable || !body.neck) continue;
        if (body.listed.some((id) => componentById(id)?.type === type)) necks.add(body.neck);
    }
    return [...necks].sort();
}

export function neckBuilder(neck: string): NeckBuilder | null {
    const media = MEDIA[neck];
    if (!media) return null;
    const bodies = allBodies().filter((body) => body.neck === neck && body.interchangeable);
    if (!bodies.length || bodies.some((body) => !media.bodies[body.id])) return null;

    const parts: Record<string, BuilderPart> = {};
    const partIds = new Set(bodies.flatMap((body) => body.listed));
    for (const id of [...partIds, "LIB-" + neck + "-PlsticRollon", "LIB-" + neck + "-MtlRollon"]) {
        const image = media.parts[id];
        if (!image) continue;
        const component = componentById(id);
        const roller = id.startsWith("LIB-");
        const name = component?.name ?? (id.includes("Mtl") ? "Metal roller insert" : "Plastic roller insert");
        const { overcap, ...main } = image;
        parts[id] = {
            id,
            itemCode: component?.itemCode ?? null,
            name,
            finish: roller ? (id.includes("Mtl") ? "Metal ball" : "Plastic ball") : finishName(name),
            group: roller ? "roller-insert" : closureGroup(component!).key,
            image: main,
            overcap: overcap ?? null,
            catalogUrl: component?.itemCode ? itemCatalogHref(component.itemCode) : null,
        };
    }
    const inGroup = (key: string) => Object.values(parts).filter((part) => part.group === key).map((part) => part.id);
    const capGroups = (["short-ribbed-cap", "short-cap", "tall-cap", "liner-cap"])
        .map((key) => ({ key, label: closureGroup({ type: "cap", style: { "short-ribbed-cap": "Short ribbed", "short-cap": "Short", "tall-cap": "Tall", "liner-cap": "Liner" }[key]! }).label, note: GROUP_NOTES[key], partIds: inGroup(key) }))
        .filter((group) => group.partIds.length > 0);
    const sprayers = inGroup("fine-mist-sprayer");
    const rollOnCaps = inGroup("roll-on-cap");
    const plastic = parts[`LIB-${neck}-PlsticRollon`] ? `LIB-${neck}-PlsticRollon` : null;
    const metal = parts[`LIB-${neck}-MtlRollon`] ? `LIB-${neck}-MtlRollon` : null;

    const bottles: BuilderBottle[] = bodies.map((body: FitBody) => ({
        id: body.id,
        label: bodyLabel(body),
        family: body.family,
        capacityMl: body.capacityMl,
        heightMm: body.heightMm,
        diameterMm: body.diameterMm,
        image: media.bodies[body.id],
        fitUrl: fitHref(body),
        fits: body.listed.filter((id) => parts[id]),
        rollers: [
            ...(body.fitmentTypes.includes("Plastic Roller Ball") && plastic ? ["plastic" as const] : []),
            ...(body.fitmentTypes.includes("Metal Roller Ball") && metal ? ["metal" as const] : []),
        ],
        products: body.products ?? [],
    })).sort((a, b) => (a.capacityMl ?? 0) - (b.capacityMl ?? 0) || (a.heightMm ?? 0) - (b.heightMm ?? 0) || a.label.localeCompare(b.label));

    const lotionElsewhere = necksWith("lotion-pump").filter((n) => n !== neck);
    const reducerElsewhere = necksWith("reducer").filter((n) => n !== neck);
    const hasLotion = Object.values(parts).some((part) => componentById(part.id)?.type === "lotion-pump");
    const hasReducer = Object.values(parts).some((part) => componentById(part.id)?.type === "reducer");
    const applicators: Applicator[] = [
        { key: "roll-plastic", label: "Roll-on, plastic ball", note: "Roller insert. You choose the roll-on cap next.", available: Boolean(plastic && rollOnCaps.length), elsewhere: [] },
        { key: "roll-metal", label: "Roll-on, metal ball", note: "Roller insert. You choose the roll-on cap next.", available: Boolean(metal && rollOnCaps.length), elsewhere: [] },
        { key: "spray", label: "Fine mist sprayer", note: `${sprayers.length} finishes. Each comes with its matching overcap.`, available: sprayers.length > 0, elsewhere: [] },
        { key: "none", label: "None: pour or cap only", note: "No applicator. You choose a cap next.", available: capGroups.length > 0, elsewhere: [] },
        { key: "lotion", label: "Lotion pump", note: "", available: hasLotion, elsewhere: lotionElsewhere },
        { key: "reducer", label: "Reducer", note: "", available: hasReducer, elsewhere: reducerElsewhere },
    ];
    return { neck, ruling: neckRuling(neck), bottles, parts, rollers: { plastic, metal }, sprayers, rollOnCaps, capGroups, applicators };
}

/** The product a chosen build matches, if we sell it as one item. */
export function matchProduct(bottle: Pick<BuilderBottle, "products">, partIds: string[]): string | null {
    const want = [...partIds].sort().join("|");
    return bottle.products.find((product) => product.parts.join("|") === want)?.sku ?? null;
}
