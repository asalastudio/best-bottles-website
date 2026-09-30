/**
 * Closures seated down onto the shoulder (Jordan 2026-09-30: "a lot of the caps are sitting too high up on the
 * bottles. The actual cap has to sit on the shoulder properly ... with its edge resting on the shoulder").
 *
 * compose() anchors every closure on the rim and only ever lifts it (shoulderLiftMm), so a cap shorter than its
 * bottle's neck stood above the shoulder with a band of neck showing. scripts/register/seats/audit-seats.ts measures,
 * in the composed CAP ON picture, the background showing between each closure's outer edge and the glass under it,
 * and writes that distance here as the drop that rests the edge on the shoulder.
 *
 * An entry is keyed by the plate image and the images of every layer that travels with the closure. Images are
 * content-addressed, so a re-rendered plate or cap finds no entry and draws as before until the audit runs again.
 */
import generated from "./seat-drops.generated.json";
import { isSeatedClosureLayer, type LayerGeometry } from "./compose";

type SeatDrop = { dropMm: number; plateKey: string; closure: string; skus: number; limitedByRim?: true };
type SeatDropsFile = { generatedAt: string | null; rule: string; entries: Record<string, SeatDrop> };

const TABLE = generated as unknown as SeatDropsFile;
let enabled = true;

/** The audit measures the closures where compose() alone puts them. */
export function setSeatDropsEnabled(on: boolean): void {
    enabled = on;
}

/** 53-bit FNV-1a over a string: two 32-bit lanes with different offsets. */
function hash(text: string): string {
    let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        a = Math.imul(a ^ c, 0x01000193) >>> 0;
        b = Math.imul(b ^ c, 0x01000193) >>> 0;
    }
    return a.toString(16).padStart(8, "0") + (b & 0x1fffff).toString(16).padStart(6, "0");
}

/** Which closure-on-glass a drop belongs to: the plate image and the images of the layers that travel with the closure. */
export function closureSeatSignature(plateUrl: string, layers: ReadonlyArray<LayerGeometry & { url: string }>): string | null {
    const urls = layers.filter(isSeatedClosureLayer).map((layer) => layer.url).sort();
    return urls.length ? hash([plateUrl, ...urls].join("|")) : null;
}

/** How far (mm) to lower this closure so its edge rests on the shoulder; 0 when the audit has no entry for it. */
export function closureDropMm(signature: string | null): number {
    if (!enabled || !signature) return 0;
    return TABLE.entries[signature]?.dropMm ?? 0;
}
