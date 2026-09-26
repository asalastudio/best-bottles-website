/**
 * Stage geometry for the product page canvas: one layout, three views.
 *
 * Every kit part is a full-canvas alpha layer registered to the SKU's plate
 * (1000×1100), so the stack lines up by construction. A view is nothing but
 * a set of per-part offsets plus one frame transform on the whole canvas:
 *   - CAP ON: every part at its assembled position;
 *   - SIDECAR: the removable closure parked beside the glass, foot on the
 *     baseline (kit-frame's detached-cap rule), the fitment still fitted;
 *   - EXPLODED: each part lifted by its own `exploded` offset.
 * Because the frame for CAP ON and SIDECAR reserves both cap positions, the
 * bottle stays put while the cap animates between them.
 *
 * Callout anchors are read off the real part bounds after framing, so the
 * leaders point at the layers actually on screen.
 */
import { explodedKitFrame, REMOVABLE_KIT_SLOTS, withDetachedCapOffsets } from "@/lib/products/kit-frame";
import { stackedExplodeOffsets } from "@/lib/products/exploded-stack";
import { PDP_PLATE_CANVAS, pdpStageFrame, pdpStageTransformCss, type PdpStageFrame } from "@/lib/products/pdp-stage-frame";
import { allowsExplodedClosure, requiresAssembledClosure } from "@/lib/products/closure-presentation";

export type StageView = "sidecar" | "capon" | "exploded";

export const STAGE_VIEWS: ReadonlyArray<{ id: StageView; label: string }> = [
    { id: "sidecar", label: "SIDECAR" },
    { id: "capon", label: "CAP ON" },
    { id: "exploded", label: "EXPLODED" },
];

export type PartBox = { x: number; y: number; width: number; height: number };

export type KitPartLike = {
    slot: string;
    zOrder: number;
    explodeIndex: number;
    bounds: { left: number; top: number; right: number; bottom: number };
    assembled: { x: number; y: number };
    exploded: { dx: number; dy: number };
    image: { url: string; width: number; height: number };
    /**
     * Where the image sits on the canvas. A legacy kit layer has none: it is a
     * full-canvas image. A register part (one plate per glass, one layer set
     * per component, placed by src/lib/register/stage-kit.ts) is a cut-out at
     * its native size standing in this box.
     */
    box?: PartBox | null;
    /** The register component the layer came from, when it has one. */
    componentId?: string | null;
    /** The views this part is drawn in; absent = every view (a seated insert vs its full plug). */
    views?: StageView[];
};

export type KitLike = {
    sku: string;
    canvas: { width: number; height: number };
    anchors: { axisX: number; neckAxisX: number | null; seatY: number; baselineY: number };
    parts: KitPartLike[];
    /** Set when the kit was composed from the component register rather than published per SKU. */
    register?: { bodyId: string; plateKey: string; glass: string } | null;
};

export type StagePart = {
    key: string;
    slot: string;
    url: string;
    /** translate() percentages of the canvas box. */
    dxPct: number;
    dyPct: number;
    zIndex: number;
    /** The part's box in percent of the canvas; absent for a full-canvas layer. */
    box?: { leftPct: number; topPct: number; widthPct: number; heightPct: number };
    /** Percent of the part's own height hidden from the bottom: a behind-glass layer never shows below the plate's baseline. */
    clipBottomPct?: number;
};

export function fullCanvasBox(canvas: { width: number; height: number }): PartBox {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };
}

export type StagePoint = { xPct: number; yPct: number };

export type StageLayout = {
    frame: PdpStageFrame;
    frameCss: string;
    parts: StagePart[];
    canvas: { width: number; height: number };
    /** Anchor points in percent of the canvas box, after the frame transform. */
    anchors: Partial<Record<"cap" | "fitment" | "neck" | "body", StagePoint>>;
    baseline: boolean;
    grid: boolean;
};

const FITMENT_SLOTS: ReadonlySet<string> = new Set(["roller", "fitment", "sprayer", "pump", "collar", "diptube", "bulb", "tassel", "reducer", "pipette"]);
/** Layers drawn behind the glass. A register plate is opaque, so these show only where they leave the glass; below
 *  the foot they must not show at all (a tube cut on the 100 mL Circle photo is longer than the Round 78). */
export const BEHIND_GLASS_SLOTS: ReadonlySet<string> = new Set(["diptube", "pipette"]);

export function isClosureSlot(slot: string): boolean {
    return REMOVABLE_KIT_SLOTS.has(slot);
}

export function isFitmentSlot(slot: string): boolean {
    return FITMENT_SLOTS.has(slot);
}

export type StageContext = {
    family?: string | null;
    capacityMl?: number | null;
    color?: string | null;
    applicator?: string | null;
    websiteSku?: string | null;
};

/** Which views the stage can honestly show for this SKU. */
export function availableViews(kit: KitLike | null | undefined, context: StageContext): StageView[] {
    const views: StageView[] = ["sidecar"];
    if (!kit?.parts?.length) return views;
    views.push("capon");
    if (allowsExplodedClosure(context.applicator, context.family, context.websiteSku)) views.push("exploded");
    return views;
}

/** Sidecar collapses to the assembled stack when the closure must stay on (droppers, reducers, bulb sprayers). */
export function effectiveView(view: StageView, kit: KitLike | null | undefined, context: StageContext): StageView {
    if (!kit?.parts?.length) return "sidecar";
    if (view === "sidecar" && requiresAssembledClosure(context.applicator, context.websiteSku)) return "capon";
    if (view === "exploded" && !allowsExplodedClosure(context.applicator, context.family, context.websiteSku)) return "capon";
    return view;
}

function center(part: KitPartLike, offset: { dx: number; dy: number }): { x: number; y: number } {
    return {
        x: (part.bounds.left + part.bounds.right) / 2 + offset.dx,
        y: (part.bounds.top + part.bounds.bottom) / 2 + offset.dy,
    };
}

function rightEdge(part: KitPartLike, offset: { dx: number; dy: number }, y: number): { x: number; y: number } {
    return { x: part.bounds.right + offset.dx, y };
}

function toStagePoint(point: { x: number; y: number }, frame: PdpStageFrame, canvas: { width: number; height: number }): StagePoint {
    return {
        xPct: frame.x + (point.x * frame.scale) / canvas.width * 100,
        yPct: frame.y + (point.y * frame.scale) / canvas.height * 100,
    };
}

export function stageLayout(kit: KitLike | null | undefined, requested: StageView, context: StageContext): StageLayout | null {
    if (!kit?.parts?.length) return null;
    const canvas = kit.canvas ?? PDP_PLATE_CANVAS;
    const view = effectiveView(requested, kit, context);
    const sorted = [...kit.parts].filter((part) => !part.views || part.views.includes(view)).sort((a, b) => a.zOrder - b.zOrder);
    if (!sorted.length) return null;

    let offsets: Map<KitPartLike, { dx: number; dy: number }>;
    let frame: PdpStageFrame;
    if (view === "exploded") {
        // Every kit explodes the same way: units stacked above the glass in assembly order, a
        // sprayer's head, collar and tube travelling together. Recorded per-part offsets are not used.
        const lifted = stackedExplodeOffsets(sorted);
        offsets = new Map(sorted.map((part, index) => [part, lifted.get(index) ?? { dx: 0, dy: 0 }]));
        const stacked = sorted.map((part, index) => ({ ...part, exploded: lifted.get(index) ?? { dx: 0, dy: 0 } }));
        frame = explodedKitFrame(stacked, canvas.width, canvas.height);
    } else {
        const detached = withDetachedCapOffsets(sorted);
        // Only the removable closure moves in SIDECAR; the fitment stays seated in the glass.
        offsets = new Map(sorted.map((part, index) => [
            part,
            view === "sidecar" && isClosureSlot(part.slot) ? detached[index].exploded : { dx: 0, dy: 0 },
        ]));
        // The same frame for both views: unionBounds reserves the detached cap, so the glass never moves.
        frame = pdpStageFrame({
            family: context.family, capacityMl: context.capacityMl, color: context.color,
            view: "capOff", parts: sorted, width: canvas.width, height: canvas.height,
        });
    }

    const parts: StagePart[] = sorted.map((part, index) => {
        const offset = offsets.get(part) ?? { dx: 0, dy: 0 };
        let clipBottomPct: number | undefined;
        if (part.box && BEHIND_GLASS_SLOTS.has(part.slot)) {
            const over = part.box.y + part.box.height + offset.dy - kit.anchors.baselineY;
            if (over > 0.5) clipBottomPct = Math.min(100, (over / part.box.height) * 100);
        }
        return {
            key: `${part.slot}-${index}`,
            slot: part.slot,
            url: part.image.url,
            dxPct: (offset.dx / canvas.width) * 100,
            dyPct: (offset.dy / canvas.height) * 100,
            zIndex: part.zOrder + 1,
            ...(part.box ? {
                box: {
                    leftPct: (part.box.x / canvas.width) * 100,
                    topPct: (part.box.y / canvas.height) * 100,
                    widthPct: (part.box.width / canvas.width) * 100,
                    heightPct: (part.box.height / canvas.height) * 100,
                },
            } : {}),
            ...(clipBottomPct !== undefined ? { clipBottomPct } : {}),
        };
    });

    const anchors: StageLayout["anchors"] = {};
    const body = sorted.find((part) => part.slot === "body") ?? null;
    const closure = [...sorted].reverse().find((part) => isClosureSlot(part.slot)) ?? null;
    const fitment = sorted.find((part) => isFitmentSlot(part.slot)) ?? null;
    if (closure) anchors.cap = toStagePoint(rightEdge(closure, offsets.get(closure)!, center(closure, offsets.get(closure)!).y), frame, canvas);
    if (fitment) anchors.fitment = toStagePoint(rightEdge(fitment, offsets.get(fitment)!, center(fitment, offsets.get(fitment)!).y), frame, canvas);
    if (body) {
        const bodyOffset = offsets.get(body)!;
        anchors.neck = toStagePoint({ x: body.bounds.right + bodyOffset.dx, y: kit.anchors.seatY + bodyOffset.dy }, frame, canvas);
        anchors.body = toStagePoint(rightEdge(body, bodyOffset, center(body, bodyOffset).y), frame, canvas);
    }

    return {
        frame,
        frameCss: pdpStageTransformCss(frame),
        parts,
        canvas,
        anchors,
        baseline: view !== "exploded",
        grid: view === "exploded",
    };
}

/**
 * The crop that shows one part at a given height: the layer's image scaled
 * so the part's bounds fill the box, then shifted so the bounds sit at the
 * origin. A legacy layer's image is the whole canvas; a register part's image
 * is its box. Used for the cap rail, the glass lineup and the Build Your
 * Bottle tiles.
 */
export function partCrop(part: KitPartLike, canvas: { width: number; height: number }, height: number, bounds: KitPartLike["bounds"] = part.bounds): { width: number; height: number; imgWidth: number; imgHeight: number; left: number; top: number } {
    const box = part.box ?? fullCanvasBox(canvas);
    const boundsW = Math.max(1, bounds.right - bounds.left);
    const boundsH = Math.max(1, bounds.bottom - bounds.top);
    const scale = height / boundsH;
    return {
        width: boundsW * scale,
        height,
        imgWidth: box.width * scale,
        imgHeight: box.height * scale,
        left: (box.x - bounds.left) * scale,
        top: (box.y - bounds.top) * scale,
    };
}

/** The rectangle around several parts, for a thumbnail that stacks them. */
export function unionBounds(parts: readonly KitPartLike[]): KitPartLike["bounds"] {
    return {
        left: Math.min(...parts.map((part) => part.bounds.left)),
        top: Math.min(...parts.map((part) => part.bounds.top)),
        right: Math.max(...parts.map((part) => part.bounds.right)),
        bottom: Math.max(...parts.map((part) => part.bounds.bottom)),
    };
}

/**
 * The layers that show a SKU's finish in a thumbnail: for a sprayer or pump,
 * the head with its collar (the trim), never the overcap that hides them; for
 * everything else, the closure. Seated layers only (a full plug is for EXPLODED).
 */
export function closureParts(kit: KitLike | null | undefined): KitPartLike[] {
    if (!kit?.parts?.length) return [];
    const seated = kit.parts.filter((part) => !part.views || part.views.includes("capon"));
    const mechanism = seated.filter((part) => part.slot === "sprayer" || part.slot === "pump");
    if (mechanism.length) {
        return [...seated.filter((part) => part.slot === "collar"), ...mechanism].sort((a, b) => a.zOrder - b.zOrder);
    }
    const one = closurePart({ ...kit, parts: seated });
    return one ? [one] : [];
}

/** Which layer stands for the closure in a thumbnail, most to least cap-like. */
const CLOSURE_THUMB_PRIORITY = ["cap", "overcap", "sprayer", "pump", "bulb", "tassel", "roller", "fitment", "reducer", "pipette", "collar", "diptube"];

/** The layer to show for a closure thumbnail: the cap, else the overcap, else the most cap-like part (never the dip tube before the pump). */
export function closurePart(kit: KitLike | null | undefined): KitPartLike | null {
    if (!kit?.parts?.length) return null;
    for (const slot of CLOSURE_THUMB_PRIORITY) {
        const candidates = kit.parts.filter((part) => part.slot === slot);
        if (candidates.length) return candidates.sort((a, b) => a.bounds.top - b.bounds.top)[0];
    }
    const candidates = kit.parts.filter((part) => part.slot !== "body");
    return candidates.sort((a, b) => a.bounds.top - b.bounds.top)[0] ?? null;
}

export function bodyPart(kit: KitLike | null | undefined): KitPartLike | null {
    return kit?.parts?.find((part) => part.slot === "body") ?? null;
}

/**
 * The layer that shows a fitment on its own (the Build Your Bottle strip's
 * tile 02): the whole insert with its plug when the register carries one for
 * EXPLODED (Jordan 2026-09-25: a stub cut at the rim reads as a broken part),
 * else the seated layer. Follows the selected SKU, so metal and plastic each
 * surface their own insert.
 */
export function fitmentPart(kit: KitLike | null | undefined): KitPartLike | null {
    const fitments = kit?.parts?.filter((part) => isFitmentSlot(part.slot)) ?? [];
    return fitments.find((part) => part.views?.includes("exploded") && !part.views.includes("capon")) ?? fitments[0] ?? null;
}
