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
import sourceTubes from "./local-source-tubes.json";

type TubeLayer = { url: string; width: number; height: number; x: number; y: number; scale?: number };
/** seated: the tube in the glass; exploded: the tube lifted out with its actuator, when it looks different there. */
type TubeEntry = { seated: TubeLayer | null; exploded: TubeLayer | null };
type PumpRegistration = { url: string; width: number; height: number; pxPerMm: number; anchor: { x: number; y: number } };
type TubeSourceGuard = { componentIds?: string[]; expectedPumpLayers?: Record<string, PumpRegistration> };
function matchesPump(row: TubeSourceGuard, id: string, layers?: ReadonlyArray<PumpRegistration & { slot: string }>) {
    if (row.componentIds && !row.componentIds.includes(id)) return false;
    if (!row.expectedPumpLayers) return true;
    const expected = row.expectedPumpLayers[id], actual = layers?.find(l => l.slot === 'pump');
    return !!expected && !!actual && actual.url === expected.url && actual.width === expected.width &&
        actual.height === expected.height && actual.pxPerMm === expected.pxPerMm &&
        actual.anchor.x === expected.anchor.x && actual.anchor.y === expected.anchor.y;
}
const TUBES = (heroTubes as unknown as { tubes: Record<string, TubeEntry> }).tubes;

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
    components: Readonly<Record<string, { type: string; layers?: ReadonlyArray<PumpRegistration & { slot: string }> } | undefined>>,
    plate: PlateGeometry,
    frame: Frame,
): HeroTube | null {
    for (const part of assembly.parts) {
        if (part.role !== "sprayer" && part.role !== "pump") continue;
        const family = FAMILY[components[part.componentId]?.type ?? ""];
        const key = `${assembly.plateKey}|${family}`;
        let tube = family ? TUBES[key] : undefined;
        // Local source-layer pilot. The original pixels replace both flattened
        // cuts, with a uniform source-to-plate scale and no change to the body.
        // A changed plate invalidates this measured placement.
        const source = process.env.NODE_ENV === "development" && !process.env.VERCEL ? sourceTubes.find(row => row.key === key
            && matchesPump(row as TubeSourceGuard, part.componentId, components[part.componentId]?.layers)
            && row.expectedPlate.width === plate.width && row.expectedPlate.height === plate.height
            && row.expectedPlate.pxPerMm === plate.pxPerMm
            && Object.entries(row.expectedPlate.anchors).every(([name, value]) => plate.anchors[name as keyof typeof plate.anchors] === value)) : undefined;
        if (source && "url" in plate && plate.url === source.expectedPlate.url) tube = { seated: source, exploded: source };
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
                width: round(layer.width * (layer.scale ?? 1) * scale),
                height: round(layer.height * (layer.scale ?? 1) * scale),
            },
        };
        return { seated: place(tube.seated), exploded: place(tube.exploded), componentId: part.componentId };
    }
    return null;
}
