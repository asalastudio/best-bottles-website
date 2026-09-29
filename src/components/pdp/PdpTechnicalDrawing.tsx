/**
 * The tech sheet's technical drawing: the locked Blender body cut through its
 * axis, drawn as a half section (outside on the left with the cavity as a
 * hidden line, the cut glass hatched on the right), a 3:1 detail of the neck
 * finish, and the caliper figures. Units are millimetres (1 viewBox unit =
 * 1 mm on a 1:1 main view; a short bottle's data sets a larger scale), so the
 * page card and the PDF draw the same sheet.
 * Pure SVG with no hooks: it renders on the page and in the PDF template.
 */
import type { ReactNode } from "react";
import {
    clipPolygonAbove,
    clipPolylineAbove,
    drawingFigureRows,
    formatMm,
    pathOf,
    splitLeftHalf,
    type Point,
    type TechnicalDrawingData,
} from "@/lib/products/pdp-redesign/tech-drawing";

const W = 128;
const H = 158;
const INK = "#1c1c1e";
const GOLD = "#9a7a48";
const MUTED = "#8a8580";
const GLASS = "#eeecea";
const HAIR = 0.18;
const LINE = 0.32;
const TEXT = 3;
const SMALL = 2.5;

// Main view: the axis and the standing ring (the scale comes with the data).
const AX = 30;
const BASE_Y = 138;
// Neck detail, 3:1: its axis, the rim line, and, measured down from the rim (every 13-415 neck is the same finish),
// where the cut stops, the centre of the call-out on the main view and the height of the bore's figure.
const DETAIL = 3;
const DX = 92;
const RIM_Y = 22;
const DETAIL_CUT_DEPTH = 14.29;
const CALLOUT_DEPTH = 5.89;
const BORE_DIM_DEPTH = 4.09;

function Arrow({ x, y, dir }: { x: number; y: number; dir: "up" | "down" | "left" | "right" }) {
    const l = 1.6, w = 0.5;
    const pts = {
        up: `${x},${y} ${x - w},${y + l} ${x + w},${y + l}`,
        down: `${x},${y} ${x - w},${y - l} ${x + w},${y - l}`,
        left: `${x},${y} ${x + l},${y - w} ${x + l},${y + w}`,
        right: `${x},${y} ${x - l},${y - w} ${x - l},${y + w}`,
    }[dir];
    return <polygon points={pts} fill={GOLD} stroke="none" />;
}

/** A vertical dimension at x from y1 (top) to y2 (bottom), its figure turned along it. */
function VDim({ x, y1, y2, text, side = "left" }: { x: number; y1: number; y2: number; text: string; side?: "left" | "right" }) {
    const mid = (y1 + y2) / 2;
    const tx = side === "left" ? x - 1.2 : x + 1.2 + TEXT * 0.72;
    return (
        <g>
            <line x1={x} y1={y1} x2={x} y2={y2} stroke={GOLD} strokeWidth={HAIR} />
            <Arrow x={x} y={y1} dir="up" />
            <Arrow x={x} y={y2} dir="down" />
            <text x={tx} y={mid} fontSize={TEXT} fontWeight={500} fill={INK} textAnchor="middle" transform={`rotate(-90 ${tx} ${mid})`}>{text}</text>
        </g>
    );
}

/** A horizontal dimension at y from x1 to x2, its figure above (or below) the line. */
function HDim({ y, x1, x2, text, below = false }: { y: number; x1: number; x2: number; text: string; below?: boolean }) {
    return (
        <g>
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={GOLD} strokeWidth={HAIR} />
            <Arrow x={x1} y={y} dir="left" />
            <Arrow x={x2} y={y} dir="right" />
            <text x={(x1 + x2) / 2} y={below ? y + TEXT + 0.6 : y - 0.9} fontSize={TEXT} fontWeight={500} fill={INK} textAnchor="middle">{text}</text>
        </g>
    );
}

function Ext({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={GOLD} strokeWidth={HAIR} />;
}

export default function PdpTechnicalDrawing({ data, idPrefix = "td" }: { data: TechnicalDrawingData; idPrefix?: string }) {
    const { section, datums: d, figures: f } = data;
    const hatch = `${idPrefix}-hatch`;

    // ── main view
    const scale = data.scale ?? 1;
    const mx = (x: number) => AX + x * scale;
    const my = (z: number) => BASE_Y - z * scale;
    const left = splitLeftHalf(section.left, d.rimZ);
    const rightPath = pathOf(section.right, mx, my, true);
    const rimOuterR = Math.max(...section.right.filter((p) => p[1] >= d.rimZ - 1e-3).map((p) => p[0]));

    // ── neck detail (3:1)
    const dxf = (x: number) => DX + x * DETAIL;
    const dyf = (z: number) => RIM_Y + (d.rimZ - z) * DETAIL;
    const cutZ = d.rimZ - DETAIL_CUT_DEPTH;
    const detailRight = clipPolygonAbove(section.right, cutZ);
    const detailOutside = clipPolylineAbove(left.outside, cutZ);
    const detailInside = clipPolylineAbove(left.inside, cutZ);
    const cutY = dyf(cutZ);

    const heightText = formatMm(f.heightMm.value);
    const depthText = formatMm(f.insideDepthMm.value);
    const rows = drawingFigureRows(data);
    const tableTop = 86;
    const rowH = 5.1;

    const breakLine = (() => {
        const x0 = dxf(-d.bodyR) - 1.5, x1 = dxf(d.bodyR) + 1.5;
        const steps = 14;
        let path = `M${x0} ${cutY}`;
        for (let i = 1; i <= steps; i += 1) {
            const x = x0 + ((x1 - x0) * i) / steps;
            path += `L${x.toFixed(2)} ${(cutY + (i % 2 ? -0.7 : 0.7)).toFixed(2)}`;
        }
        return path;
    })();

    const figureLabel: ReactNode = (
        <text x={AX} y={H - 2} fontSize={SMALL} fill={MUTED} textAnchor="middle" letterSpacing={0.3}>HALF SECTION · {scale}:1</text>
    );

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            role="img"
            aria-label={`${data.title}: ${heightText} mm tall, Ø ${formatMm(f.diameterMm.value)} mm, ${formatMm(f.threadMm.value)} mm thread`}
            data-testid="pdp-technical-drawing"
            style={{ display: "block", fontFamily: "inherit" }}
        >
            <defs>
                <pattern id={hatch} width={1.1} height={1.1} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width={1.1} height={1.1} fill={GLASS} />
                    <line x1={0} y1={0} x2={0} y2={1.1} stroke="#b9b4ae" strokeWidth={0.14} />
                </pattern>
            </defs>

            {/* ── main view ─────────────────────────────────────── */}
            <line x1={AX} y1={my(d.rimZ) - 4} x2={AX} y2={my(0) + 3} stroke={MUTED} strokeWidth={HAIR} strokeDasharray="3 0.8 0.6 0.8" />
            <path d={rightPath} fill={`url(#${hatch})`} stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
            <path d={pathOf(left.outside, mx, my)} fill="none" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
            <path d={pathOf(left.inside, mx, my)} fill="none" stroke={INK} strokeWidth={HAIR} strokeDasharray="1 0.7" />

            {/* height: standing ring to rim */}
            <Ext x1={mx(-d.bodyR) - 0.8} y1={my(0)} x2={mx(-d.bodyR) - 10} y2={my(0)} />
            <Ext x1={mx(-rimOuterR) - 0.8} y1={my(d.rimZ)} x2={mx(-d.bodyR) - 10} y2={my(d.rimZ)} />
            <VDim x={mx(-d.bodyR) - 8.5} y1={my(d.rimZ)} y2={my(0)} text={heightText} />

            {/* inside depth: rim to the floor on the axis */}
            <Ext x1={mx(rimOuterR) + 0.8} y1={my(d.rimZ)} x2={mx(d.bodyR) + 9.5} y2={my(d.rimZ)} />
            <Ext x1={AX + 0.6} y1={my(d.floorZ)} x2={mx(d.bodyR) + 9.5} y2={my(d.floorZ)} />
            <VDim x={mx(d.bodyR) + 8} y1={my(d.rimZ)} y2={my(d.floorZ)} text={`${depthText} inside`} side="right" />

            {/* body diameter under the foot */}
            <Ext x1={mx(-d.bodyR)} y1={my(0) + 0.8} x2={mx(-d.bodyR)} y2={my(0) + 6.8} />
            <Ext x1={mx(d.bodyR)} y1={my(0) + 0.8} x2={mx(d.bodyR)} y2={my(0) + 6.8} />
            <HDim y={my(0) + 5.6} x1={mx(-d.bodyR)} x2={mx(d.bodyR)} text={`Ø ${formatMm(f.diameterMm.value)}`} below />

            {/* the detail's call-out on the main view */}
            <circle cx={AX} cy={my(d.rimZ - CALLOUT_DEPTH)} r={9.2 * scale} fill="none" stroke={GOLD} strokeWidth={HAIR} strokeDasharray="1.2 0.8" />
            <text x={AX + 7.4 * scale} y={my(d.rimZ - CALLOUT_DEPTH) - 7.4 * scale} fontSize={TEXT} fontWeight={600} fill={GOLD}>A</text>
            {figureLabel}

            {/* ── neck detail, 3:1 ──────────────────────────────── */}
            <line x1={DX} y1={RIM_Y - 9} x2={DX} y2={cutY + 3} stroke={MUTED} strokeWidth={HAIR} strokeDasharray="3 0.8 0.6 0.8" />
            <path d={pathOf(detailRight, dxf, dyf, true)} fill={`url(#${hatch})`} stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
            {detailOutside.map((run: Point[], i) => <path key={`o${i}`} d={pathOf(run, dxf, dyf)} fill="none" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />)}
            {detailInside.map((run: Point[], i) => <path key={`i${i}`} d={pathOf(run, dxf, dyf)} fill="none" stroke={INK} strokeWidth={HAIR} strokeDasharray="1 0.7" />)}
            <path d={breakLine} fill="none" stroke={INK} strokeWidth={HAIR} />

            {/* T: thread crest, above the rim */}
            <Ext x1={dxf(-d.threadR)} y1={dyf(d.threadCrestZ) - 0.8} x2={dxf(-d.threadR)} y2={RIM_Y - 6.6} />
            <Ext x1={dxf(d.threadR)} y1={dyf(d.threadCrestZ) - 0.8} x2={dxf(d.threadR)} y2={RIM_Y - 6.6} />
            <HDim y={RIM_Y - 5.4} x1={dxf(-d.threadR)} x2={dxf(d.threadR)} text={`Ø ${formatMm(f.threadMm.value)}  T`} />

            {/* I: the bore */}
            <HDim y={dyf(d.rimZ - BORE_DIM_DEPTH)} x1={dxf(-d.boreR)} x2={dxf(d.boreR)} text={`Ø ${formatMm(f.boreMm.value)}  I`} />

            {/* E: the plain neck under the thread */}
            <HDim y={dyf(d.neckPlainZ)} x1={dxf(-d.neckR)} x2={dxf(d.neckR)} text={`Ø ${formatMm(f.neckMm.value)}  E`} />

            {/* finish height: shoulder ledge to rim */}
            <Ext x1={dxf(rimOuterR) + 0.8} y1={RIM_Y} x2={dxf(d.bodyR) + 5.4} y2={RIM_Y} />
            <Ext x1={dxf(d.bodyR) + 0.8} y1={dyf(d.shoulderZ)} x2={dxf(d.bodyR) + 5.4} y2={dyf(d.shoulderZ)} />
            <VDim x={dxf(d.bodyR) + 4.2} y1={RIM_Y} y2={dyf(d.shoulderZ)} text={formatMm(f.finishHeightMm.value)} side="right" />

            <text x={DX} y={cutY + 7} fontSize={SMALL} fill={MUTED} textAnchor="middle" letterSpacing={0.3}>DETAIL A · NECK FINISH {data.body.split("-").slice(-2).join("-")} · 3:1</text>

            {/* ── caliper figures ───────────────────────────────── */}
            <text x={62} y={tableTop - 3} fontSize={SMALL} fontWeight={600} fill={GOLD} letterSpacing={0.4}>MEASURED · MM</text>
            {rows.map((row, i) => (
                <g key={row.label}>
                    <line x1={62} y1={tableTop + i * rowH + 1.6} x2={124} y2={tableTop + i * rowH + 1.6} stroke="#e6e2df" strokeWidth={HAIR} />
                    <text x={62} y={tableTop + i * rowH} fontSize={TEXT * 0.9} fill={MUTED}>{row.label}</text>
                    <text x={124} y={tableTop + i * rowH} fontSize={TEXT * 0.9} fontWeight={500} fill={INK} textAnchor="end">{row.value}</text>
                </g>
            ))}
            <text x={62} y={tableTop + rows.length * rowH + 2.2} fontSize={SMALL * 0.9} fill={MUTED}>Caliper readings; drawn from the production model.</text>
        </svg>
    );
}
