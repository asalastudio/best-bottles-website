/**
 * The tech sheet's dimension drawing: the traced art placed on a 200 × 280
 * canvas with the SKU's figures drawn over it as hairline dimension lines.
 * Pure SVG in the page's own type, so the figures print and scale with the
 * card; the art is the only image.
 *
 * Layout: the assembly (closure top to foot) fills 70% of the height, axis
 * centred; "height without cap" on the left from the seat to the foot,
 * "height with cap" on the right from the closure's top, the diameter under
 * the foot, and the neck finish on a leader. A figure the SKU lacks is
 * simply not drawn.
 */
import type { DrawingSpec } from "@/lib/products/pdp-redesign/drawings";

const W = 200;
const H = 280;
const GOLD = "var(--pdp-gold, #9e814a)";
const INK = "var(--pdp-ink, #1c1c1e)";

export default function PdpDimensionDrawing({ spec }: { spec: DrawingSpec }) {
    const { art, figures } = spec;
    const scale = (H * 0.7) / Math.max(1, art.footY - art.closureTopY);
    const x = (v: number) => W / 2 + (v - art.axisX) * scale;
    const y = (v: number) => H * 0.1 + (v - art.closureTopY) * scale;
    const imgX = x(0), imgY = y(0), imgW = art.width * scale, imgH = art.height * scale;
    const gl = x(art.glassLeft), gr = x(art.glassRight);
    const yTop = y(art.closureTopY), ySeat = y(art.seatY), yFoot = y(art.footY);
    const tick = 3;
    const gap = 14;
    const left = gl - gap * 2.2;
    const right = gr + gap * 2.2;
    const dia = yFoot + gap * 1.1;
    const showWithCap = figures.heightWithCapMm != null && art.closureTopY < art.seatY - 1;

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            role="img"
            aria-label={[
                figures.heightWithCapMm != null ? `${figures.heightWithCapMm} mm with cap` : null,
                figures.heightWithoutCapMm != null ? `${figures.heightWithoutCapMm} mm without cap` : null,
                figures.diameterMm != null ? `${figures.diameterMm} mm across` : null,
                figures.neck ? `${figures.neck} neck` : null,
            ].filter(Boolean).join(", ") || "Dimension drawing"}
            data-testid="pdp-dimension-drawing"
            data-style={spec.style}
            data-closure={spec.closure}
            style={{ display: "block", fontFamily: "inherit" }}
        >
            <image href={art.src} x={imgX} y={imgY} width={imgW} height={imgH} preserveAspectRatio="none" />
            <g stroke={GOLD} strokeWidth={0.75} fill="none" shapeRendering="geometricPrecision">
                {figures.heightWithoutCapMm != null && (
                    <>
                        <line x1={left - tick} y1={ySeat} x2={gl - 2} y2={ySeat} />
                        <line x1={left - tick} y1={yFoot} x2={gl - 2} y2={yFoot} />
                        <line x1={left} y1={ySeat} x2={left} y2={yFoot} />
                    </>
                )}
                {showWithCap && (
                    <>
                        <line x1={gr + 2} y1={yTop} x2={right + tick} y2={yTop} />
                        <line x1={gr + 2} y1={yFoot} x2={right + tick} y2={yFoot} />
                        <line x1={right} y1={yTop} x2={right} y2={yFoot} />
                    </>
                )}
                {figures.diameterMm != null && (
                    <>
                        <line x1={gl} y1={yFoot + 2} x2={gl} y2={dia + tick} />
                        <line x1={gr} y1={yFoot + 2} x2={gr} y2={dia + tick} />
                        <line x1={gl} y1={dia} x2={gr} y2={dia} />
                    </>
                )}
                {figures.neck && (
                    <>
                        <line x1={gl + 1} y1={ySeat + 4} x2={left + 26} y2={yTop - 2 + 6} />
                        <circle cx={gl + 1} cy={ySeat + 4} r={1.2} fill={GOLD} stroke="none" />
                    </>
                )}
            </g>
            <g fill={INK} fontSize={9} fontWeight={500} textAnchor="middle">
                {figures.heightWithoutCapMm != null && (
                    <text x={left} y={(ySeat + yFoot) / 2 + 3} transform={`rotate(-90 ${left} ${(ySeat + yFoot) / 2 + 3})`}>{figures.heightWithoutCapMm} mm</text>
                )}
                {showWithCap && (
                    <text x={right} y={(yTop + yFoot) / 2 + 3} transform={`rotate(-90 ${right} ${(yTop + yFoot) / 2 + 3})`}>{figures.heightWithCapMm} mm</text>
                )}
                {figures.diameterMm != null && <text x={(gl + gr) / 2} y={dia + 11}>Ø {figures.diameterMm} mm</text>}
                {figures.neck && <text x={left + 18} y={yTop - 6} fontSize={8} fontWeight={400}>Neck {figures.neck}</text>}
            </g>
        </svg>
    );
}
