/**
 * The tech sheet's label placement drawing: the bottle in elevation with the
 * label in place, and the flat label beside it at the same scale with bleed,
 * safe line, crop marks and (on a wrap) the part that faces the customer.
 * Drawn from the numbers in label-fit.ts, so every standard bottle gets one.
 * Pure SVG with no hooks: it renders on the page and in the PDF template.
 */
import {
    discCentreMm,
    formatLabelMm,
    frontZoneMm,
    type LabelFit,
} from "@/lib/products/pdp-redesign/label-fit";

const VB_W = 200;
const VB_H = 130;
const INK = "#1c1c1e";
const GOLD = "#9a7a48";
const MUTED = "#8a8580";
const PAPER = "#f4efe4";
const PAPER_SHADE = "#e2d9c6";
const BLEED = "#b4533c";
const SAFE = "#5d7fa3";
const HAIR = 0.18;
const LINE = 0.34;
const TEXT = 3.1;
const SMALL = 2.4;
const BLEED_MM = 1.6;
const SAFE_MM = 1.6;

function Arrow({ x, y, dir }: { x: number; y: number; dir: "up" | "down" | "left" | "right" }) {
    const l = 1.5, w = 0.48;
    const pts = {
        up: `${x},${y} ${x - w},${y + l} ${x + w},${y + l}`,
        down: `${x},${y} ${x - w},${y - l} ${x + w},${y - l}`,
        left: `${x},${y} ${x + l},${y - w} ${x + l},${y + w}`,
        right: `${x},${y} ${x - l},${y - w} ${x - l},${y + w}`,
    }[dir];
    return <polygon points={pts} fill={GOLD} stroke="none" />;
}

function VDim({ x, y1, y2, text, side = "left" }: { x: number; y1: number; y2: number; text: string; side?: "left" | "right" }) {
    const mid = (y1 + y2) / 2;
    const tx = side === "left" ? x - 1.2 : x + 1.2 + TEXT * 0.72;
    return (
        <g>
            <line x1={x} y1={y1} x2={x} y2={y2} stroke={GOLD} strokeWidth={HAIR} />
            <Arrow x={x} y={y1} dir="up" />
            <Arrow x={x} y={y2} dir="down" />
            {text ? <text x={tx} y={mid} fontSize={TEXT} fontWeight={500} fill={INK} textAnchor="middle" transform={`rotate(-90 ${tx} ${mid})`}>{text}</text> : null}
        </g>
    );
}

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
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={GOLD} strokeWidth={HAIR} strokeDasharray="0.9 0.7" />;
}

function CropMarks({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
    const gap = 1.4, len = 3.2;
    const corners: Array<[number, number, number, number]> = [[x, y, -1, -1], [x + w, y, 1, -1], [x, y + h, -1, 1], [x + w, y + h, 1, 1]];
    return (
        <g stroke={INK} strokeWidth={HAIR}>
            {corners.map(([cx, cy, sx, sy]) => (
                <g key={`${cx}-${cy}`}>
                    <line x1={cx + sx * gap} y1={cy} x2={cx + sx * (gap + len)} y2={cy} />
                    <line x1={cx} y1={cy + sy * gap} x2={cx} y2={cy + sy * (gap + len)} />
                </g>
            ))}
        </g>
    );
}

/** A small sample label so the drawing reads as a label, not a box. Scales down or drops lines as the label shrinks. */
function SampleArt({ cx, top, w, h }: { cx: number; top: number; w: number; h: number }) {
    if (w < 7 || h < 5) return null;
    const size = Math.min(TEXT * 0.95, w / 7.5, h / 5);
    const lines = h > size * 6;
    return (
        <g textAnchor="middle">
            <text x={cx} y={top + h * (lines ? 0.36 : 0.56)} fontSize={size * 0.78} fontWeight={600} letterSpacing={size * 0.22} fill={GOLD}>YOUR BRAND</text>
            {lines ? (
                <>
                    <line x1={cx - w * 0.14} y1={top + h * 0.43} x2={cx + w * 0.14} y2={top + h * 0.43} stroke={GOLD} strokeWidth={HAIR} />
                    <text x={cx} y={top + h * 0.55} fontSize={size * 1.05} fontStyle="italic" fontFamily="Georgia, 'Times New Roman', serif" fill={INK}>Fragrance</text>
                </>
            ) : null}
        </g>
    );
}

export default function PdpLabelPlacement({ fit, idPrefix = "lp" }: { fit: LabelFit; idPrefix?: string }) {
    const g = fit.glass;
    const lab = fit.label;
    const glassId = `${idPrefix}-glass`;
    const wrapId = `${idPrefix}-wrap`;
    const disc = fit.shape === "disc";

    // One scale for the bottle and the flat label, as large as the sheet allows.
    const templateW = lab.widthMm;
    const scale = Math.min((VB_H - 36) / g.heightMm, (VB_W - 22 - 26 - 12) / (g.widthMm + templateW), 4);
    const half = (g.widthMm / 2) * scale;
    const AX = 22 + half;
    const BY = VB_H - 24;
    const Z = (mm: number) => BY - mm * scale;

    // ── the glass outline
    let bodyPath: string;
    if (disc) {
        const r = (g.widthMm / 2) * scale;
        const cz = Z(discCentreMm(fit));
        const foot = ((g.footMm ?? g.widthMm * 0.62) / 2) * scale;
        const junction = cz + Math.sqrt(Math.max(r * r - foot * foot, 0));
        bodyPath = `M${AX - foot} ${BY} H${AX + foot} V${junction} A${r} ${r} 0 1 0 ${AX - foot} ${junction} Z`;
    } else {
        const heel = Math.min(Math.max(g.heelMm, 0.4), g.widthMm * 0.18) * scale;
        const neck = (g.finishMm / 2) * scale;
        const top = Z(g.shoulderMm);
        const neckBase = Z(g.neckBaseMm);
        bodyPath = [
            `M${AX - half + heel} ${BY}`, `H${AX + half - heel}`, `Q${AX + half} ${BY} ${AX + half} ${BY - heel}`,
            `V${top}`, `Q${AX + half} ${neckBase} ${AX + neck} ${neckBase}`, `H${AX - neck}`,
            `Q${AX - half} ${neckBase} ${AX - half} ${top}`, `V${BY - heel}`, `Q${AX - half} ${BY} ${AX - half + heel} ${BY}`, "Z",
        ].join(" ");
    }
    const finishHalf = (g.finishMm / 2) * scale;
    const finishTop = Z(g.heightMm);
    const finishBottom = Z(g.neckBaseMm) + (disc ? 1.2 : 0.3);
    const threadStep = Math.max((finishBottom - finishTop) / 3.2, 0.8);

    // ── the label on the bottle
    const labelTop = disc ? 0 : Z(lab.fromBaseMm + lab.heightMm);
    const labelH = lab.heightMm * scale;
    let onBottle: { x: number; w: number } = { x: AX - half, w: half * 2 };
    if (fit.shape === "face") onBottle = { x: AX - (lab.widthMm / 2) * scale, w: lab.widthMm * scale };
    if (fit.shape === "wrap" && lab.panels > 1) {
        // A panel narrower than the circumference shows as its chord.
        const r = g.widthMm / 2;
        const chord = 2 * r * Math.sin(Math.min(lab.widthMm / r, Math.PI) / 2);
        onBottle = { x: AX - (chord / 2) * scale, w: chord * scale };
    }

    // ── the flat label, level with it
    const TX = AX + half + 26;
    const tw = templateW * scale;
    const bleed = BLEED_MM * scale;
    const safe = SAFE_MM * scale;
    const front = frontZoneMm(fit);
    const discCentre = disc ? Z(discCentreMm(fit)) : 0;
    const stockRound = disc && fit.stock.front?.round ? fit.stock.front.widthIn * 25.4 : null;

    const title = disc
        ? `Round label, up to Ø ${formatLabelMm(lab.widthMm)} mm on each face`
        : fit.shape === "face"
            ? `${formatLabelMm(lab.widthMm)} × ${formatLabelMm(lab.heightMm)} mm label on each of ${lab.panels} faces`
            : lab.panels > 1
                ? `Two ${formatLabelMm(lab.widthMm)} × ${formatLabelMm(lab.heightMm)} mm labels, front and back`
                : `${formatLabelMm(lab.widthMm)} × ${formatLabelMm(lab.heightMm)} mm wrap label`;

    return (
        <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            width="100%"
            role="img"
            aria-label={`Label placement: ${title}`}
            data-testid="pdp-label-placement"
            style={{ display: "block", fontFamily: "inherit" }}
        >
            <defs>
                <linearGradient id={glassId} x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" stopColor="#d4d9dc" />
                    <stop offset="0.18" stopColor="#f3f4f4" />
                    <stop offset="0.32" stopColor="#ffffff" />
                    <stop offset="0.46" stopColor="#eef0f0" />
                    <stop offset="0.86" stopColor="#eceeee" />
                    <stop offset="1" stopColor="#d4d9dc" />
                </linearGradient>
                <linearGradient id={wrapId} x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" stopColor={PAPER_SHADE} />
                    <stop offset="0.24" stopColor={PAPER} />
                    <stop offset="0.76" stopColor={PAPER} />
                    <stop offset="1" stopColor={PAPER_SHADE} />
                </linearGradient>
            </defs>

            {/* ── the bottle ─────────────────────────────────────────── */}
            <line x1={AX} y1={finishTop - 3} x2={AX} y2={BY + 2.5} stroke={MUTED} strokeWidth={HAIR} strokeDasharray="3 0.8 0.6 0.8" />
            <path d={bodyPath} fill={`url(#${glassId})`} stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
            <rect x={AX - finishHalf} y={finishTop} width={finishHalf * 2} height={Math.max(finishBottom - finishTop, 0.5)} rx={0.5} fill="#eef0f0" stroke={INK} strokeWidth={LINE} />
            {[1, 2].map((i) => (
                <line key={i} x1={AX - finishHalf} y1={finishTop + threadStep * i} x2={AX + finishHalf} y2={finishTop + threadStep * i + 0.9} stroke={INK} strokeWidth={HAIR} opacity={0.55} />
            ))}

            {disc ? (
                <g>
                    <circle cx={AX} cy={discCentre} r={(lab.widthMm / 2) * scale} fill="none" stroke={GOLD} strokeWidth={HAIR} strokeDasharray="1.4 0.9" />
                    <circle cx={AX} cy={discCentre} r={((stockRound ?? lab.widthMm) / 2) * scale} fill={PAPER} stroke={INK} strokeWidth={LINE} />
                    <SampleArt cx={AX} top={discCentre - ((stockRound ?? lab.widthMm) / 2) * scale * 0.7} w={(stockRound ?? lab.widthMm) * scale * 0.7} h={(stockRound ?? lab.widthMm) * scale * 0.7} />
                </g>
            ) : (
                <g>
                    <rect x={onBottle.x} y={labelTop} width={onBottle.w} height={labelH} fill={fit.shape === "wrap" ? `url(#${wrapId})` : PAPER} stroke={INK} strokeWidth={LINE} />
                    <SampleArt cx={AX} top={labelTop} w={Math.min(onBottle.w, (front ?? lab.widthMm) * scale)} h={labelH} />
                </g>
            )}

            {/* overall height */}
            <Ext x1={AX - finishHalf - 0.8} y1={finishTop} x2={AX - half - 9} y2={finishTop} />
            <Ext x1={AX - half - 0.8} y1={BY} x2={AX - half - 9} y2={BY} />
            <VDim x={AX - half - 7.5} y1={finishTop} y2={BY} text={`${formatLabelMm(g.heightMm)}`} />

            {/* width under the foot */}
            <Ext x1={AX - half} y1={BY + 0.8} x2={AX - half} y2={BY + 6.4} />
            <Ext x1={AX + half} y1={BY + 0.8} x2={AX + half} y2={BY + 6.4} />
            <HDim
                y={BY + 5.2}
                x1={AX - half}
                x2={AX + half}
                text={disc ? `${formatLabelMm(g.widthMm)} disc` : fit.shape === "face" ? `${formatLabelMm(g.widthMm)} face` : `Ø ${formatLabelMm(g.widthMm)}`}
                below
            />

            {/* the label's height and where it starts */}
            {!disc ? (
                <g>
                    <Ext x1={onBottle.x + onBottle.w + 0.8} y1={labelTop} x2={AX + half + 8.5} y2={labelTop} />
                    <Ext x1={onBottle.x + onBottle.w + 0.8} y1={labelTop + labelH} x2={AX + half + 8.5} y2={labelTop + labelH} />
                    <VDim x={AX + half + 7} y1={labelTop} y2={labelTop + labelH} text={`${formatLabelMm(lab.heightMm)} label`} side="right" />
                    {lab.fromBaseMm * scale > 3.2 ? (
                        <VDim x={AX + half + 7} y1={labelTop + labelH} y2={BY} text="" side="right" />
                    ) : null}
                    <text x={AX + half + 9.5} y={BY - 0.4} fontSize={SMALL} fill={MUTED}>{formatLabelMm(lab.fromBaseMm)}</text>
                </g>
            ) : null}

            <text x={AX} y={VB_H - 2} fontSize={SMALL} fill={MUTED} textAnchor="middle" letterSpacing={0.3}>ON THE BOTTLE</text>

            {/* ── the flat label, same scale ─────────────────────────── */}
            {disc ? (
                <g>
                    <circle cx={TX + tw / 2} cy={discCentre} r={((stockRound ?? lab.widthMm) / 2) * scale + bleed} fill="none" stroke={BLEED} strokeWidth={HAIR} strokeDasharray="1.2 0.8" />
                    <circle cx={TX + tw / 2} cy={discCentre} r={((stockRound ?? lab.widthMm) / 2) * scale} fill={PAPER} stroke={INK} strokeWidth={LINE} />
                    <circle cx={TX + tw / 2} cy={discCentre} r={((stockRound ?? lab.widthMm) / 2) * scale - safe} fill="none" stroke={SAFE} strokeWidth={HAIR} strokeDasharray="0.8 0.8" />
                    <circle cx={TX + tw / 2} cy={discCentre} r={(lab.widthMm / 2) * scale} fill="none" stroke={GOLD} strokeWidth={HAIR} strokeDasharray="1.4 0.9" />
                    <SampleArt cx={TX + tw / 2} top={discCentre - ((stockRound ?? lab.widthMm) / 2) * scale * 0.7} w={(stockRound ?? lab.widthMm) * scale * 0.7} h={(stockRound ?? lab.widthMm) * scale * 0.7} />
                    <text x={TX + tw / 2} y={discCentre - (lab.widthMm / 2) * scale - 2} fontSize={TEXT} fontWeight={500} fill={INK} textAnchor="middle">
                        {stockRound ? `Ø ${formatLabelMm(Math.round(stockRound * 10) / 10)} shown · max Ø ${formatLabelMm(lab.widthMm)}` : `max Ø ${formatLabelMm(lab.widthMm)}`}
                    </text>
                </g>
            ) : (
                <g>
                    <Ext x1={AX + half + 11} y1={labelTop} x2={TX - 3} y2={labelTop} />
                    <Ext x1={AX + half + 11} y1={labelTop + labelH} x2={TX - 3} y2={labelTop + labelH} />
                    <rect x={TX - bleed} y={labelTop - bleed} width={tw + bleed * 2} height={labelH + bleed * 2} fill="none" stroke={BLEED} strokeWidth={HAIR} strokeDasharray="1.2 0.8" />
                    <rect x={TX} y={labelTop} width={tw} height={labelH} fill={PAPER} stroke={INK} strokeWidth={LINE} />
                    {front ? <rect x={TX + (tw - front * scale) / 2} y={labelTop} width={front * scale} height={labelH} fill={SAFE} opacity={0.1} /> : null}
                    {tw > safe * 3 && labelH > safe * 3 ? (
                        <rect x={TX + safe} y={labelTop + safe} width={tw - safe * 2} height={labelH - safe * 2} fill="none" stroke={SAFE} strokeWidth={HAIR} strokeDasharray="0.8 0.8" />
                    ) : null}
                    <CropMarks x={TX} y={labelTop} w={tw} h={labelH} />
                    <SampleArt cx={TX + tw / 2} top={labelTop} w={front ? front * scale : tw} h={labelH} />
                    <HDim y={labelTop - bleed - 3} x1={TX} x2={TX + tw} text={`${formatLabelMm(lab.widthMm)}${fit.shape === "wrap" && lab.panels === 1 ? " wrap" : ""}`} />
                    {front ? (
                        <HDim y={labelTop + labelH + bleed + 3.2} x1={TX + (tw - front * scale) / 2} x2={TX + (tw + front * scale) / 2} text={`front ${formatLabelMm(front)}`} below />
                    ) : null}
                </g>
            )}
            <text x={TX + tw / 2} y={VB_H - 2} fontSize={SMALL} fill={MUTED} textAnchor="middle" letterSpacing={0.3}>
                {lab.panels > 1 ? `FLAT LABEL · SAME SCALE · × ${lab.panels}` : "FLAT LABEL · SAME SCALE"}
            </text>
        </svg>
    );
}

/**
 * The label at true size for the PDF: print at 100%, cut on the line and wrap
 * it round a sample. Sized in millimetres so Chromium prints it 1:1.
 */
export function PdpLabelTemplate({ fit }: { fit: LabelFit }) {
    const lab = fit.label;
    const disc = fit.shape === "disc";
    const stockRound = disc && fit.stock.front?.round ? fit.stock.front.widthIn * 25.4 : null;
    const w = disc ? lab.widthMm : lab.widthMm;
    const h = disc ? lab.widthMm : lab.heightMm;
    const pad = 8;
    const vw = w + pad * 2;
    const vh = h + pad * 2;
    const front = frontZoneMm(fit);
    return (
        <svg
            viewBox={`0 0 ${vw} ${vh}`}
            width={`${vw}mm`}
            height={`${vh}mm`}
            data-testid="pdp-label-template"
            style={{ display: "block", fontFamily: "inherit" }}
        >
            {disc ? (
                <g>
                    <circle cx={vw / 2} cy={vh / 2} r={w / 2} fill="none" stroke={GOLD} strokeWidth={0.2} strokeDasharray="1.4 0.9" />
                    {stockRound ? <circle cx={vw / 2} cy={vh / 2} r={stockRound / 2} fill="none" stroke={INK} strokeWidth={0.25} /> : null}
                    <line x1={vw / 2 - 1.5} y1={vh / 2} x2={vw / 2 + 1.5} y2={vh / 2} stroke={MUTED} strokeWidth={0.15} />
                    <line x1={vw / 2} y1={vh / 2 - 1.5} x2={vw / 2} y2={vh / 2 + 1.5} stroke={MUTED} strokeWidth={0.15} />
                </g>
            ) : (
                <g>
                    <rect x={pad} y={pad} width={w} height={h} fill="none" stroke={INK} strokeWidth={0.25} />
                    {front ? (
                        <>
                            <line x1={pad + (w - front) / 2} y1={pad} x2={pad + (w - front) / 2} y2={pad + h} stroke={SAFE} strokeWidth={0.15} strokeDasharray="1 1" />
                            <line x1={pad + (w + front) / 2} y1={pad} x2={pad + (w + front) / 2} y2={pad + h} stroke={SAFE} strokeWidth={0.15} strokeDasharray="1 1" />
                            <text x={pad + w / 2} y={pad + h / 2} fontSize={2.6} fill={SAFE} textAnchor="middle">FRONT</text>
                        </>
                    ) : null}
                    <CropMarks x={pad} y={pad} w={w} h={h} />
                </g>
            )}
        </svg>
    );
}
