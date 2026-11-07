/**
 * The neck-finish builder: choose a bottle, then an applicator, then a closure.
 *
 * Built from the fit index (what fits) and the fit media manifest (approved
 * master images with true-scale geometry, scripts/help/build_fit_media.py).
 * A finish gets a builder only when its bottles and the parts they list all
 * have media; parts without art are left out rather than drawn wrong.
 */
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import fitMedia from "./fit-media.generated.json";
import { allBodies, bodyLabel, componentById, fitHref, itemCatalogHref, neckRuling, type FitBody, type FitComponent } from "./fit";

export type MediaImage = { src: string; width: number; height: number; pxPerMm: number; axisX: number; seatY: number };
type NeckMedia = { bodies: Record<string, MediaImage & { source: string }>; parts: Record<string, MediaImage & { source: string; overcap?: MediaImage; behind?: MediaImage; swatch?: MediaImage }>; missingParts?: string[] };

const MEDIA = (fitMedia as { necks: Record<string, NeckMedia> }).necks;

export type BuilderPart = {
    id: string; itemCode: string | null; name: string; finish: string; group: string;
    /** What sits above the neck. */
    image: MediaImage;
    /** What sits inside the bottle (a dropper stem), drawn behind the glass. */
    behind: MediaImage | null;
    /** The whole part, for tiles. */
    swatch: MediaImage;
    overcap: MediaImage | null; catalogUrl: string | null;
};
export type BuilderBottle = {
    id: string; label: string; family: string; capacityMl: number | null; heightMm: number | null; diameterMm: number | null; glass: string;
    image: MediaImage; fitUrl: string; fits: string[]; fitments: string[];
    products: Array<{ sku: string; parts: string[] }>;
};
export type ApplicatorKey = "roll-plastic" | "roll-metal" | "spray" | "lotion" | "dropper" | "bulb" | "tassel" | "reducer" | "none";
/** What step 3 asks for once this applicator is chosen. */
export type ClosureKind = "roll-on-caps" | "caps" | "included" | "complete";
export type Applicator = {
    key: ApplicatorKey; label: string; note: string;
    /** A fixed insert drawn inside the neck (roller ball, reducer); null when the applicator is chosen by finish. */
    insert: string | null;
    /** The bottle fitment type that says a bottle takes this insert. */
    fitment: string | null;
    /** Finishes picked in step 2 (sprayers, pumps, droppers, bulbs). */
    finishes: string[];
    closure: ClosureKind;
    available: boolean;
    elsewhere: string[];
};
export type CapGroup = { key: string; label: string; note: string; partIds: string[] };
export type NeckBuilder = {
    neck: string;
    ruling: { date: string; statement: string } | null;
    bottles: BuilderBottle[];
    parts: Record<string, BuilderPart>;
    rollOnCaps: string[];
    capGroups: CapGroup[];
    applicators: Applicator[];
};

/** Cap groups in the order the matrices draw them; liner notes only where a caliper confirmed a liner (13-415). */
const CAP_GROUPS: Array<{ key: string; label: string; test: (c: Pick<FitComponent, "type" | "style">) => boolean; note: (neck: string) => string }> = [
    { key: "short-ribbed-cap", label: "Short ribbed caps", test: (c) => c.type === "cap" && c.style === "Short ribbed", note: () => "Black or white" },
    { key: "short-cap", label: "Short caps", test: (c) => c.type === "cap" && c.style === "Short", note: (neck) => (neck === "13-415" ? "Foam liner, metal-look finishes" : "Low profile") },
    { key: "tall-cap", label: "Tall caps", test: (c) => c.type === "cap" && c.style === "Tall", note: (neck) => (neck === "13-415" ? "Foam liner, 24 mm high" : "Taller profile") },
    { key: "liner-cap", label: "Caps with liner", test: (c) => c.type === "cap" && c.style === "Liner", note: () => "Hard plastic with liner" },
    { key: "faux-leather-cap", label: "Faux leather caps", test: (c) => c.type === "faux-leather-cap", note: () => "Leather-look wrap" },
];

const APPLICATORS: Array<Omit<Applicator, "insert" | "finishes" | "available" | "elsewhere"> & { partType?: string; insertId?: (neck: string) => string }> = [
    { key: "roll-plastic", label: "Roll-on, plastic ball", note: "Roller insert. You choose the roll-on cap next.", fitment: "Plastic Roller Ball", closure: "roll-on-caps", insertId: (neck) => `LIB-${neck}-PlsticRollon` },
    { key: "roll-metal", label: "Roll-on, metal ball", note: "Roller insert. You choose the roll-on cap next.", fitment: "Metal Roller Ball", closure: "roll-on-caps", insertId: (neck) => `LIB-${neck}-MtlRollon` },
    { key: "spray", label: "Fine mist sprayer", note: "Each finish comes with its matching overcap.", fitment: null, closure: "included", partType: "fine-mist-sprayer" },
    { key: "lotion", label: "Lotion pump", note: "For lotions and serums.", fitment: null, closure: "complete", partType: "lotion-pump" },
    { key: "dropper", label: "Dropper", note: "Bulb dropper with collar cap.", fitment: null, closure: "complete", partType: "dropper" },
    { key: "bulb", label: "Vintage bulb sprayer", note: "Antique-style bulb atomiser.", fitment: null, closure: "complete", partType: "vintage-bulb-sprayer" },
    { key: "tassel", label: "Bulb sprayer with tassel", note: "Bulb atomiser with tassel.", fitment: null, closure: "complete", partType: "tassel-bulb-sprayer" },
    { key: "reducer", label: "Reducer", note: "Orifice reducer under a cap. You choose the cap next.", fitment: "Reducer", closure: "caps", insertId: (neck) => `LIB-${neck}-Reducer` },
    { key: "none", label: "None: pour or cap only", note: "No applicator. You choose a cap next.", fitment: null, closure: "caps" },
];
/** Shown greyed out where a finish lacks them, because customers ask for them by name. */
const ALWAYS_SHOWN: ApplicatorKey[] = ["lotion", "reducer"];

/** "Matte blue Fine Mist Sprayer, Thread size 13-415" → "Matte blue". */
export function finishName(name: string): string {
    const text = name
        .replace(/,?\s*Thread\s*size.*$/i, "").replace(/,?\s*Threadsize.*$/i, "").replace(/\.\s*Thread.*$/i, "")
        .replace(/Fine Mist Sprayer/i, "")
        .replace(/(?:with dots|with dots or)?\s*cap (?:with dots )?or closure for rollon bottles/i, (m) => (/dots/i.test(m) ? " dotted" : ""))
        .replace(/lid or closure for glass bottle/i, "")
        .replace(/short cap with liner/i, "")
        .replace(/caps? for glass bottles/i, "")
        .replace(/collar (?:sprayer|Lotion or treatment pump)/i, "collar")
        .replace(/Lotion or treatment pump/i, "")
        .replace(/Antique or Vintage style bulb sprayer/i, "bulb")
        .replace(/rubber bulb dropper with/i, "bulb,")
        .replace(/\.\s*Glass stem length is (\d+)\s*mm.*$/i, ", $1 mm stem")
        .replace(/\.\s*Glass stem.*$/i, "")
        .replace(/\s+/g, " ").replace(/\s+([,.])/g, "$1").replace(/[,.\s]+$/, "").trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export function neckBuilderNecks(): string[] {
    return Object.keys(MEDIA).filter((neck) => neckBuilder(neck) !== null).sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));
}

export function neckBuilderHref(neck: string): string {
    return `/help/fit/neck/${encodeURIComponent(neck)}`;
}

/** Printable matrices for a neck finish (scripts/help/build_matrix_pdf.py), largest format last. */
export function neckMatrixDownloads(neck: string): Array<{ label: string; href: string; sizeMb: number }> {
    return [
        { label: "US letter, landscape, 2 pages", file: `best-bottles-${neck}-neck-matrix-letter.pdf` },
        { label: "Tabloid 11 × 17 in, landscape, 1 page", file: `best-bottles-${neck}-neck-matrix-tabloid.pdf` },
    ].flatMap(({ label, file }) => {
        const path = join(process.cwd(), "public", "downloads", "matrices", file);
        if (!existsSync(path)) return [];
        return [{ label, href: `/downloads/matrices/${file}`, sizeMb: Math.round(statSync(path).size / 1e5) / 10 }];
    });
}

/** Which other necks offer a part type. */
function necksWith(type: string): string[] {
    const necks = new Set<string>();
    for (const body of allBodies()) {
        if (!body.interchangeable || !body.neck) continue;
        if (body.listed.some((id) => componentById(id)?.type === type)) necks.add(body.neck);
    }
    return [...necks].sort((a, b) => parseFloat(a) - parseFloat(b));
}

const cache = new Map<string, NeckBuilder | null>();

export function neckBuilder(neck: string): NeckBuilder | null {
    if (cache.has(neck)) return cache.get(neck)!;
    const view = build(neck);
    cache.set(neck, view);
    return view;
}

function build(neck: string): NeckBuilder | null {
    const media = MEDIA[neck];
    if (!media) return null;
    // Bottles that list parts and have a master image (a body the catalog lists nothing for, like the fixed
    // 30 ml Cylinder spray products, keeps its own fit page).
    const bodies = allBodies().filter((body) => body.neck === neck && body.interchangeable && body.listed.length > 0 && media.bodies[body.id]);
    if (!bodies.length) return null;

    const parts: Record<string, BuilderPart> = {};
    const ids = new Set(bodies.flatMap((body) => body.listed));
    for (const def of APPLICATORS) if (def.insertId) ids.add(def.insertId(neck));
    for (const id of ids) {
        const image = media.parts[id];
        if (!image) continue;
        const component = componentById(id);
        const insert = id.startsWith("LIB-");
        const name = component?.name ?? (id.includes("Mtl") ? "Metal roller insert" : id.includes("Plstic") ? "Plastic roller insert" : "Reducer insert");
        const { overcap, behind, swatch, ...main } = image;
        const group = insert ? "insert" : CAP_GROUPS.find((g) => g.test(component!))?.key ?? component!.type;
        parts[id] = {
            id,
            itemCode: component?.itemCode ?? null,
            name,
            finish: insert ? (id.includes("Mtl") ? "Metal ball" : id.includes("Plstic") ? "Plastic ball" : "Reducer") : finishName(name),
            group,
            image: main,
            behind: behind ?? null,
            swatch: swatch ?? main,
            overcap: overcap ?? null,
            catalogUrl: component?.itemCode ? itemCatalogHref(component.itemCode) : null,
        };
    }
    const ofType = (type: string) => Object.values(parts).filter((part) => componentById(part.id)?.type === type).map((part) => part.id).sort((a, b) => parts[a].finish.localeCompare(parts[b].finish));
    const capGroups = CAP_GROUPS
        .map((g) => ({ key: g.key, label: g.label, note: g.note(neck), partIds: Object.values(parts).filter((p) => p.group === g.key).map((p) => p.id) }))
        .filter((g) => g.partIds.length > 0);
    const rollOnCaps = ofType("roll-on-cap");

    const bottles: BuilderBottle[] = bodies.map((body: FitBody) => ({
        id: body.id,
        label: bodyLabel(body),
        family: body.family,
        capacityMl: body.capacityMl,
        heightMm: body.heightMm,
        diameterMm: body.diameterMm,
        glass: body.glass.includes("Clear") ? "Clear" : body.glass[0] ?? "Clear",
        image: media.bodies[body.id],
        fitUrl: fitHref(body),
        fits: body.listed.filter((id) => parts[id]),
        fitments: body.fitmentTypes,
        products: body.products ?? [],
    })).sort((a, b) => (a.capacityMl ?? 0) - (b.capacityMl ?? 0) || (a.heightMm ?? 0) - (b.heightMm ?? 0) || a.label.localeCompare(b.label));

    const applicators: Applicator[] = APPLICATORS.flatMap((def) => {
        const insert = def.insertId ? def.insertId(neck) : null;
        const finishes = def.partType ? ofType(def.partType) : [];
        const closureOk = def.closure === "roll-on-caps" ? rollOnCaps.length > 0 : def.closure === "caps" ? capGroups.length > 0 : true;
        const available = closureOk && (def.partType ? finishes.length > 0
            : def.key === "reducer" ? bottles.some((b) => b.fitments.includes("Reducer"))
            : insert ? Boolean(parts[insert]) && bottles.some((b) => def.fitment && b.fitments.includes(def.fitment)) : true);
        const elsewhere = def.partType ? necksWith(def.partType).filter((n) => n !== neck) : def.key === "reducer" ? ["18-415"].filter((n) => n !== neck) : [];
        if (!available && !(ALWAYS_SHOWN.includes(def.key) && elsewhere.length)) return [];
        // The insert id is kept even without art (the reducer): products list it, so a build still matches its SKU.
        return [{ key: def.key, label: def.label, note: def.note, insert, fitment: def.fitment, finishes, closure: def.closure, available, elsewhere }];
    });
    // A finish gets a builder only when its closures have art: a builder with nothing to pick would only mislead.
    if (!applicators.some((a) => a.available) || Object.keys(parts).length === 0) return null;
    return { neck, ruling: neckRuling(neck), bottles, parts, rollOnCaps, capGroups, applicators };
}

/** Can this bottle take this applicator? */
export function applicatorFits(bottle: Pick<BuilderBottle, "fits" | "fitments">, applicator: Applicator): boolean {
    if (!applicator.available) return false;
    if (applicator.finishes.length) return applicator.finishes.some((id) => bottle.fits.includes(id));
    if (applicator.fitment) return bottle.fitments.includes(applicator.fitment);
    return true;
}

/** The product a chosen build matches, if we sell it as one item. */
export function matchProduct(bottle: Pick<BuilderBottle, "products">, partIds: string[]): string | null {
    // Reducer products list only their cap; the reducer is in the product code ("Rdcr"), not the parts.
    const reducer = partIds.some((id) => id.endsWith("-Reducer"));
    const want = partIds.filter((id) => !id.endsWith("-Reducer")).sort().join("|");
    return bottle.products.find((product) => product.parts.join("|") === want && /Rdcr/i.test(product.sku) === reducer)?.sku ?? null;
}
