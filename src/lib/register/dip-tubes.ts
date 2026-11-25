/**
 * The dip tube, and the pump shaft it rides into, that a sprayer or a pump draws on a catalogue glass plate.
 *
 * The catalogue plates are Sunburst renders baked on the stage bone, so the shared tube drawn behind the glass never
 * shows, and the 18-415 lotion pumps and perfume sprayers carry no tube at all. Jordan 2026-09-30: the tube must look
 * the way the product shows up in the real world, with the mechanism, consistent with the catalogue heroes. So each
 * glass draws the shaft and tube cut from its own released catalogue hero (scripts/register/tubes/, hero-tubes.json),
 * one per fitment family: registered to the plate, it stands exactly where that bottle's tube stands, and every
 * finish of the family shares it. It draws in front of the glass and under the hardware. In EXPLODED it lifts out with
 * its sprayer or pump as one piece (Jordan 2026-09-30: "attaching it to the actual actuator and then expanding out so
 * that they can see the whole mechanism"); out of frosted glass it is the clear bottle's clear tube.
 * Bodies with their own measured Blender tubes (the 5 mL and 9 mL Cylinders) are not in the table and keep theirs.
 */
import type { Frame, PlateGeometry } from "./compose";
import heroTubes from "./hero-tubes.json";
import psdTubes from "./psd-tubes.generated.json";

type TubeLayer = { url: string; width: number; height: number; x: number; y: number };
/** seated: the tube in the glass; exploded: the tube lifted out with its actuator, when it looks different there. */
type TubeEntry = { seated: TubeLayer | null; exploded: TubeLayer | null };
const TUBES = (heroTubes as unknown as { tubes: Record<string, TubeEntry> }).tubes;

/**
 * Photographed PSD tubes fitted by measurement (scripts/paperdoll/seated-dip-tubes.py --register, 24 Nov 2026 dip-tube
 * audit P1). They replace the hero cuts above for the bodies with no approved kit (Circle, Round, Slim, and the 13-415
 * Elegant 15, Circle 15, Flair, Royal, Square, Bell and rectangles): one real tube per glass and fitment, its top tucked
 * into the measured stem exit, its foot 1 mm above the inner floor, at the plate's px/mm, on the neck axis. Clear glass
 * shows it at 0.9, frosted at 0.3 with no blur; EXPLODED lifts the same tube, whole, with its sprayer or pump.
 */
type PsdTube = {
    seated: { url: string; width: number; height: number };
    exploded: { url: string; width: number; height: number };
    box: { x: number; y: number; width: number; height: number };
    floorY: number;
    opaque: { left: number; right: number };
    opacity: number;
    datum: { axisX: number; seatY: number; pxPerMm: number };
};
const PSD_TUBES = (psdTubes as unknown as { tubes: Record<string, PsdTube> }).tubes;

/** The fitment family a component's type hangs its tube by (the register's component types). */
const FAMILY: Readonly<Record<string, string>> = {
    "vintage-bulb-sprayer": "bulb",
    "tassel-bulb-sprayer": "tassel",
    "fine-mist-sprayer": "spray",
    "lotion-pump": "lotion",
};

export type HeroTubeLayer = {
    url: string;
    width: number;
    height: number;
    box: { x: number; y: number; width: number; height: number };
    /** The tube's own pixels across the box (a PSD tube's box keeps transparent margin for its bend). */
    bounds?: { left: number; right: number; top: number; bottom: number };
    /** Glass treatment for a PSD tube seated in the glass: 0.9 clear, 0.3 frosted. */
    opacity?: number;
};
export type HeroTube = {
    /** In the glass (SIDECAR, CAP ON); null when the glass hides it (the amber Tulip 5 mL). */
    seated: HeroTubeLayer | null;
    /** Lifted out with its actuator in EXPLODED; null = the seated layer, which then draws in every view. */
    exploded: HeroTubeLayer | null;
    /** The sprayer or pump it hangs from: EXPLODED lifts them as one unit (exploded-stack.ts). */
    componentId: string;
};

/** The hero tube for one assembly on its frame, or null when it has no sprayer or pump, or its glass has no cut. */
export function heroTube(
    assembly: { plateKey: string; parts: ReadonlyArray<{ role: string; componentId: string }> },
    components: Readonly<Record<string, { type: string } | undefined>>,
    plate: PlateGeometry,
    frame: Frame,
): HeroTube | null {
    for (const part of assembly.parts) {
        if (part.role !== "sprayer" && part.role !== "pump") continue;
        const family = FAMILY[components[part.componentId]?.type ?? ""];
        const psd = family ? PSD_TUBES[`${assembly.plateKey}|${family}`] : undefined;
        if (psd) return { ...psdTube(psd, frame), componentId: part.componentId };
        const tube = family ? TUBES[`${assembly.plateKey}|${family}`] : undefined;
        if (!tube) continue;
        // Each layer was cut on the plate's own pixels: it draws at the plate's scale, from the plate's top-left.
        const scale = frame.pxPerMm / plate.pxPerMm;
        const round = (value: number) => Math.round(value * 100) / 100;
        const place = (layer: TubeLayer | null): HeroTubeLayer | null => layer && {
            url: layer.url,
            width: layer.width,
            height: layer.height,
            box: {
                x: round(frame.axisX + (layer.x - plate.anchors.axisX) * scale),
                y: round(frame.seatY + (layer.y - plate.anchors.seatY) * scale),
                width: round(layer.width * scale),
                height: round(layer.height * scale),
            },
        };
        return { seated: place(tube.seated), exploded: place(tube.exploded), componentId: part.componentId };
    }
    return null;
}

/** A fitted PSD tube on this frame: measured on the stage datum, carried to the frame's axis, seat and px/mm. */
function psdTube(tube: PsdTube, frame: Frame): Omit<HeroTube, "componentId"> {
    const scale = frame.pxPerMm / tube.datum.pxPerMm;
    const round = (value: number) => Math.round(value * 100) / 100;
    const x = (value: number) => round(frame.axisX + (value - tube.datum.axisX) * scale);
    const y = (value: number) => round(frame.seatY + (value - tube.datum.seatY) * scale);
    const box = { x: x(tube.box.x), y: y(tube.box.y), width: round(tube.box.width * scale), height: round(tube.box.height * scale) };
    const px = box.width / tube.seated.width;
    const bounds = { left: round(box.x + tube.opaque.left * px), right: round(box.x + tube.opaque.right * px),
        top: box.y, bottom: Math.min(round(box.y + box.height), y(tube.floorY)) };
    return {
        seated: { ...tube.seated, box, bounds, ...(tube.opacity < 1 ? { opacity: tube.opacity } : {}) },
        exploded: { ...tube.exploded, box, bounds },
    };
}
