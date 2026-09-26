/**
 * Component register, Phase 4: placing a body plate and its component layers
 * on a canvas (docs/COMPONENT_REGISTER_PHASE_4_RENDERER.md).
 *
 * The coordinate contract (Phase 2 §4): every image is stored at its native
 * size with its own px/mm. A plate carries its anchors in its own pixels; a
 * layer carries one anchor, the point that must land on the plate's
 * (axisX, seatY). A frame says where that seat is on the output canvas and at
 * what px/mm. Placement is then arithmetic: scale each image by
 * frame.pxPerMm / image.pxPerMm and translate so the anchors coincide. The
 * same numbers drive the Node renderer (the parity gate) and the storefront's
 * CSS. Nothing here reads pixels.
 *
 * Draw order: behind-body layers, then the plate, then the front layers with
 * the highest explodeIndex first, except the overcap: it covers the sprayer or
 * pump head, so it draws over the mechanism and under the collar, whose rim
 * reads in front (Jordan 2026-09-26: the clear overcap drew behind the nozzle).
 */

export type PlateGeometry = {
    width: number;
    height: number;
    pxPerMm: number;
    anchors: { axisX: number; seatY: number; baselineY: number; shoulderY?: number | null };
};

export type LayerGeometry = {
    slot: string;
    z: "behind-body" | "front";
    explodeIndex: number;
    width: number;
    height: number;
    pxPerMm: number;
    anchor: { x: number; y: number };
};

/** Where the seat sits on the output canvas, and the output scale. */
export type Frame = {
    width: number;
    height: number;
    axisX: number;
    seatY: number;
    pxPerMm: number;
};

export type Placement<T> = {
    source: T;
    kind: "plate" | "layer";
    /** Top-left of the scaled image on the canvas, in canvas px (may be off-canvas). */
    x: number;
    y: number;
    /** Scaled size on the canvas. */
    width: number;
    height: number;
    /** frame.pxPerMm / image.pxPerMm */
    scale: number;
    /** Draw order, 0 first. */
    zIndex: number;
};

function scaleFor(frame: Frame, pxPerMm: number): number {
    if (!(pxPerMm > 0)) throw new Error(`pxPerMm must be positive, got ${pxPerMm}`);
    return frame.pxPerMm / pxPerMm;
}

export function placePlate<P extends PlateGeometry>(plate: P, frame: Frame, zIndex: number): Placement<P> {
    const scale = scaleFor(frame, plate.pxPerMm);
    return {
        source: plate,
        kind: "plate",
        scale,
        x: frame.axisX - plate.anchors.axisX * scale,
        y: frame.seatY - plate.anchors.seatY * scale,
        width: plate.width * scale,
        height: plate.height * scale,
        zIndex,
    };
}

export function placeLayer<L extends LayerGeometry>(layer: L, frame: Frame, zIndex: number): Placement<L> {
    const scale = scaleFor(frame, layer.pxPerMm);
    return {
        source: layer,
        kind: "layer",
        scale,
        x: frame.axisX - layer.anchor.x * scale,
        y: frame.seatY - layer.anchor.y * scale,
        width: layer.width * scale,
        height: layer.height * scale,
        zIndex,
    };
}

/**
 * Draw order: behind-body layers (explodeIndex ascending), the plate, front layers (explodeIndex descending) with
 * the overcap moved over the mechanism it covers and under the collar (a one-piece sprayer has no collar layer, so
 * its overcap draws last and hides it, as the 13-415 metal overcaps do).
 */
export function orderLayers<L extends LayerGeometry>(layers: readonly L[]): { behind: L[]; front: L[] } {
    const behind = layers.filter((layer) => layer.z === "behind-body").sort((a, b) => a.explodeIndex - b.explodeIndex);
    const sorted = layers.filter((layer) => layer.z !== "behind-body").sort((a, b) => b.explodeIndex - a.explodeIndex);
    const overcaps = sorted.filter((layer) => layer.slot === "overcap");
    const rest = sorted.filter((layer) => layer.slot !== "overcap");
    const at = rest.findIndex((layer) => layer.slot === "collar");
    const front = at < 0 ? [...rest, ...overcaps] : [...rest.slice(0, at), ...overcaps, ...rest.slice(at)];
    return { behind, front };
}

/** Everything the canvas draws, in draw order. */
export function compose<P extends PlateGeometry, L extends LayerGeometry>(
    plate: P,
    layers: readonly L[],
    frame: Frame,
): Array<Placement<P> | Placement<L>> {
    const { behind, front } = orderLayers(layers);
    const out: Array<Placement<P> | Placement<L>> = [];
    let z = 0;
    for (const layer of behind) out.push(placeLayer(layer, frame, z++));
    out.push(placePlate(plate, frame, z++));
    for (const layer of front) out.push(placeLayer(layer, frame, z++));
    return out;
}

/**
 * The frame that stands the plate exactly where an existing kit stands its
 * bottle: same axis, same seat, foot on the same baseline. The cut-over gate
 * compares the new render and the legacy composite in this frame, and a
 * consumer that switches over keeps the bottle still.
 */
export function frameFromLegacyKit(
    kit: { canvas: { width: number; height: number }; anchors: { axisX: number; seatY: number; baselineY: number } },
    plate: PlateGeometry,
): Frame {
    const plateSeatToFootMm = (plate.anchors.baselineY - plate.anchors.seatY) / plate.pxPerMm;
    const kitSeatToFootPx = kit.anchors.baselineY - kit.anchors.seatY;
    if (!(plateSeatToFootMm > 0) || !(kitSeatToFootPx > 0)) throw new Error("the seat must sit above the foot on both the plate and the kit");
    return {
        width: kit.canvas.width,
        height: kit.canvas.height,
        axisX: kit.anchors.axisX,
        seatY: kit.anchors.seatY,
        pxPerMm: kitSeatToFootPx / plateSeatToFootMm,
    };
}

/**
 * A frame from a stage's own datum (axis, seat and foot in canvas px), for a
 * SKU with no legacy kit to inherit one from. The datum is the family's, so
 * every SKU of a body stands identically.
 */
export function frameFromDatum(
    canvas: { width: number; height: number },
    datum: { axisX: number; seatY: number; baselineY: number },
    plate: PlateGeometry,
): Frame {
    return frameFromLegacyKit({ canvas, anchors: datum }, plate);
}

/** Where the plate's foot lands on the canvas for a frame (a check, not an input). */
export function footY(plate: PlateGeometry, frame: Frame): number {
    return frame.seatY + (plate.anchors.baselineY - plate.anchors.seatY) * scaleFor(frame, plate.pxPerMm);
}

/** CSS for one placement inside a stage box sized to the frame: absolute, top-left origin, percentages. */
export function placementStyle(placement: Placement<unknown>, frame: Frame): {
    position: "absolute"; left: string; top: string; width: string; height: string; zIndex: number;
} {
    return {
        position: "absolute",
        left: `${(placement.x / frame.width) * 100}%`,
        top: `${(placement.y / frame.height) * 100}%`,
        width: `${(placement.width / frame.width) * 100}%`,
        height: `${(placement.height / frame.height) * 100}%`,
        zIndex: placement.zIndex,
    };
}
