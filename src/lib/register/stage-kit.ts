/**
 * Component register, Phase 5: a SKU's register composition expressed as a
 * kit, so the storefront's two stages (the product page canvas and Build Your
 * Bottle) draw it with the code they already have.
 *
 * The register keeps one body plate per glass and one layer set per component,
 * each at its own px/mm with one anchor (docs/COMPONENT_REGISTER_PHASE_4_RENDERER.md).
 * `compose.ts` places them on a frame. This module chooses the frame — one
 * fixed datum per body, so every SKU of a glass stands in exactly the same
 * place and swapping a cap, a roller or the glass never moves the bottle —
 * and then describes each placed image as a kit part: its box on the canvas,
 * its bounds, its draw order and its EXPLODED offset. Legacy kits are
 * full-canvas layers (box = the canvas); register parts carry a real box.
 * Nothing here reads pixels or Convex.
 */
import { compose, footY, frameFromDatum, type Frame, type LayerGeometry, type PlateGeometry } from "./compose";
import { stackedExplodeOffsets } from "@/lib/products/exploded-stack";

export type StageDatum = { axisX: number; seatY: number; baselineY: number };
/** The slots a kit part can occupy (convex/productKits.ts and the register's registerSlotV agree). */
export type KitSlot = "body" | "fitment" | "roller" | "cap" | "overcap" | "sprayer" | "pump" | "diptube" | "collar" | "bulb" | "tassel" | "reducer" | "pipette";
export type PartBox = { x: number; y: number; width: number; height: number };
export type Bounds = { left: number; top: number; right: number; bottom: number };

/** The builder's canvas and the product page's: 10:11, the plate standard. */
export const STAGE_CANVAS = { width: 1000, height: 1100 } as const;

/**
 * Where a body stands on the canvas. A body with no entry stands by `datumFromPlate`.
 * The 9 mL Cylinder stands at the storefront's true scale, 10.5 px/mm like every other body:
 * its Blender plates (data/register/blender-9ml/measurements.json) measure 71.6 mm seat to foot,
 * so the seat sits 752 px above the shared baseline. (The Phase 3 pilot stood at 286 for its 73.8 mm plate.)
 */
export const STAGE_DATUMS: Readonly<Record<string, StageDatum>> = {
    "cylinder-9ml-17-415": { axisX: 500, seatY: 309, baselineY: 1061 },
};

/** The pilot frame's scale: 775 px for 73.8 mm of glass. */
const DEFAULT_PX_PER_MM = 10.5;
/** Leave room above the seat for the tallest closure before the frame has to shrink the whole stack (the pilot glass is 775 px). */
const MAX_GLASS_PX = 800;
const FOOT_RATIO = 1061 / 1100;

/** A datum for a body with no recorded frame: axis centred, foot on the canvas baseline, the pilot's px/mm unless the glass is too tall. */
export function datumFromPlate(plate: PlateGeometry, canvas: { width: number; height: number } = STAGE_CANVAS): StageDatum {
    const seatToFootMm = (plate.anchors.baselineY - plate.anchors.seatY) / plate.pxPerMm;
    const pxPerMm = Math.min(DEFAULT_PX_PER_MM, MAX_GLASS_PX / Math.max(1, seatToFootMm));
    const baselineY = Math.round(canvas.height * FOOT_RATIO);
    return { axisX: canvas.width / 2, seatY: Math.round(baselineY - seatToFootMm * pxPerMm), baselineY };
}

export function stageDatum(bodyId: string, plate: PlateGeometry, canvas: { width: number; height: number } = STAGE_CANVAS): StageDatum {
    return STAGE_DATUMS[bodyId] ?? datumFromPlate(plate, canvas);
}

// ---------- the register payload (registerStage:forSkus) ----------

export type RegisterPlate = PlateGeometry & { plateKey: string; bodyId: string; glass: string; url: string; approved: boolean };
/** Which stage views a layer is for: a seated insert (clipped at the rim) for CAP ON and SIDECAR, its full plug for EXPLODED. */
export type LayerUsage = "seated" | "exploded";
export type StageViewName = "sidecar" | "capon" | "exploded";
/**
 * `glass`: a see-through layer rendered behind one plate glass ("Clear", "Amber", ...); drawn only on that glass. Absent = every glass.
 * `bodyId`: a layer made for one body. A component with layers for the assembly's body draws only those; other bodies keep its generic layers.
 */
export type RegisterLayer = LayerGeometry & { slot: KitSlot; url: string; approved: boolean; usage?: LayerUsage | null; glass?: string | null; bodyId?: string | null };

/** The layers a component draws on one assembly: its layers for that body if it has any, else its generic ones; then the glass filter. */
export function layersFor(component: { layers: RegisterLayer[] }, assembly: { bodyId: string; glass: string }): RegisterLayer[] {
    const own = component.layers.filter((layer) => layer.bodyId === assembly.bodyId);
    const pool = own.length ? own : component.layers.filter((layer) => !layer.bodyId);
    // A see-through layer belongs to the glass it was rendered behind; another glass draws its own.
    return pool.filter((layer) => !layer.glass || layer.glass === assembly.glass);
}
export type RegisterComponent = { componentId: string; type: string; layers: RegisterLayer[]; approved: boolean };
export type RegisterBody = {
    bodyId: string; family: string; capacityMl: number | null; neck: string;
    dims: { heightBareMm: number | null; diameterMm: number | null; widthMm: number | null };
};
export type RegisterAssembly = {
    graceSku: string; websiteSku: string | null; bodyId: string; plateKey: string; glass: string; neck: string;
    parts: Array<{ role: string; componentId: string }>;
    renderable: boolean;
    reason: string | null;
};
export type RegisterStagePayload = {
    plates: Record<string, RegisterPlate>;
    components: Record<string, RegisterComponent>;
    bodies: Record<string, RegisterBody>;
    assemblies: Record<string, RegisterAssembly | null>;
};

// ---------- the kit shape both stages draw ----------

export type RegisterKitPart = {
    slot: KitSlot;
    variantKey: string | null;
    zOrder: number;
    explodeIndex: number;
    bounds: Bounds;
    assembled: { x: number; y: number };
    exploded: { dx: number; dy: number };
    image: { url: string; key: string; sha256: string; bytes: number; width: number; height: number };
    image2x: null;
    mask: null;
    derivation: "psd-layer";
    /** Where the image sits on the canvas. Legacy kit parts have no box: they are the canvas. */
    box: PartBox;
    /** The register component this layer came from (a plate has none). */
    componentId: string | null;
    /** The views this part is drawn in; absent = every view. */
    views?: StageViewName[];
};

export type RegisterKitMeta = {
    bodyId: string;
    plateKey: string;
    glass: string;
    datum: StageDatum;
    pxPerMm: number;
    componentIds: string[];
};

export type RegisterKit = {
    sku: string;
    familyId: string;
    plateSha256: string;
    canvas: { width: number; height: number };
    anchors: { axisX: number; neckAxisX: number | null; seatY: number; baselineY: number; pxPerMm: number | null };
    completeness: "full" | "capSplit" | "bodyOnly";
    parts: RegisterKitPart[];
    three: null;
    conflicts: string[];
    register: RegisterKitMeta;
};

type PlacedLayer = RegisterLayer & { componentId: string; role: string };

function round(value: number): number {
    return Math.round(value * 100) / 100;
}

/** The glass's own rectangle on the canvas: seat to foot, the body's diameter about the axis. The plate image is wider than the glass. */
function bodyBounds(plate: RegisterPlate, body: RegisterBody | undefined, frame: Frame, plateBox: PartBox): Bounds {
    const widthMm = body?.dims.diameterMm ?? body?.dims.widthMm ?? null;
    const halfWidth = widthMm && widthMm > 0 ? (widthMm * frame.pxPerMm) / 2 : plateBox.width / 2;
    return {
        left: round(frame.axisX - halfWidth),
        right: round(frame.axisX + halfWidth),
        top: round(frame.seatY),
        bottom: round(footY(plate, frame)),
    };
}

/**
 * The kit for one Grace SKU, or null when the register cannot draw it
 * (no assembly, unresolved parts, an unapproved plate or layer): the caller
 * then keeps the legacy kit. `datum` overrides the body's stage datum.
 */
export function kitFromRegister(
    graceSku: string,
    payload: RegisterStagePayload,
    options: { datum?: StageDatum; canvas?: { width: number; height: number } } = {},
): RegisterKit | null {
    const assembly = payload.assemblies[graceSku];
    if (!assembly?.renderable) return null;
    const plate = payload.plates[assembly.plateKey];
    if (!plate) return null;
    const layers: PlacedLayer[] = [];
    for (const part of assembly.parts) {
        const component = payload.components[part.componentId];
        if (!component) return null;
        for (const layer of layersFor(component, assembly)) layers.push({ ...layer, componentId: part.componentId, role: part.role });
    }
    if (layers.length === 0) return null;

    const canvas = options.canvas ?? STAGE_CANVAS;
    const datum = options.datum ?? stageDatum(assembly.bodyId, plate, canvas);
    const frame = frameFromDatum(canvas, datum, plate);
    const placements = compose(plate, layers, frame);

    const parts: RegisterKitPart[] = placements.map((placement) => {
        const box: PartBox = { x: round(placement.x), y: round(placement.y), width: round(placement.width), height: round(placement.height) };
        const isPlate = placement.kind === "plate";
        const source = placement.source as PlacedLayer | RegisterPlate;
        const layer = isPlate ? null : (source as PlacedLayer);
        const bounds: Bounds = isPlate
            ? bodyBounds(plate, payload.bodies[assembly.bodyId], frame, box)
            : { left: box.x, top: box.y, right: round(box.x + box.width), bottom: round(box.y + box.height) };
        return {
            slot: isPlate ? "body" : layer!.slot,
            variantKey: null,
            zOrder: placement.zIndex,
            explodeIndex: isPlate ? 0 : layer!.explodeIndex,
            bounds,
            assembled: { x: 0, y: 0 },
            exploded: { dx: 0, dy: 0 },
            image: { url: source.url, key: "", sha256: "", bytes: 0, width: source.width, height: source.height },
            image2x: null,
            mask: null,
            derivation: "psd-layer",
            box,
            componentId: layer?.componentId ?? null,
            ...(layer?.usage === "seated" ? { views: ["sidecar", "capon"] as StageViewName[] } : layer?.usage === "exploded" ? { views: ["exploded"] as StageViewName[] } : {}),
        };
    });
    // EXPLODED offsets are computed over the parts of each view separately, so a seated insert and its full plug never stack against each other.
    const lifts = stackedExplodeOffsets(parts.filter((part) => !part.views || part.views.includes("exploded")));
    const explodable = parts.filter((part) => !part.views || part.views.includes("exploded"));
    lifts.forEach((offset, index) => { explodable[index].exploded = offset; });

    const componentIds = [...new Set(assembly.parts.map((part) => part.componentId))];
    return {
        sku: assembly.websiteSku ?? graceSku,
        familyId: `register:${assembly.plateKey}`,
        plateSha256: "",
        canvas: { width: canvas.width, height: canvas.height },
        anchors: { axisX: datum.axisX, neckAxisX: datum.axisX, seatY: datum.seatY, baselineY: datum.baselineY, pxPerMm: round(frame.pxPerMm) },
        completeness: "full",
        parts,
        three: null,
        conflicts: [],
        register: { bodyId: assembly.bodyId, plateKey: assembly.plateKey, glass: assembly.glass, datum, pxPerMm: round(frame.pxPerMm), componentIds },
    };
}

/** Every renderable SKU in a payload, keyed by Grace SKU and by website SKU. */
export function kitsFromRegister(payload: RegisterStagePayload, options: { canvas?: { width: number; height: number } } = {}): Record<string, RegisterKit> {
    const kits: Record<string, RegisterKit> = {};
    for (const [graceSku, assembly] of Object.entries(payload.assemblies)) {
        if (!assembly) continue;
        const kit = kitFromRegister(graceSku, payload, options);
        if (!kit) continue;
        kits[graceSku] = kit;
        if (assembly.websiteSku) kits[assembly.websiteSku] = kit;
    }
    return kits;
}

/**
 * The kit as a stage without an EXPLODED view draws it (Build Your Bottle):
 * a seated insert stays, its full plug (an EXPLODED-only layer) is dropped, so
 * the two never paint on top of each other in an assembled preview.
 */
export function assembledKit<T extends { parts: Array<{ views?: StageViewName[] }> }>(kit: T): T {
    return { ...kit, parts: kit.parts.filter((part) => !part.views || part.views.includes("capon")) };
}

/** The SVG/CSS transform that puts a boxed part on the canvas; legacy full-canvas parts need none. */
export function partBoxTransform(part: { box?: PartBox | null; image: { width: number; height: number } }): string | null {
    if (!part.box) return null;
    const scale = part.image.width > 0 ? part.box.width / part.image.width : 1;
    return `translate(${part.box.x} ${part.box.y}) scale(${scale})`;
}
