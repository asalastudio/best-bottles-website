/**
 * The branded tech sheet (US Letter) behind the product page's
 * "Download PDF": wordmark, the product and its SKUs, the tech-sheet figures,
 * the technical drawing from the locked Blender body with the caliper
 * readings, the item description and the company line. Rendered to HTML here
 * and printed to PDF by the catalogue's Chromium renderer (../catalog/puppeteer).
 * Standard bottles (label-fit.ts) add two pages: the label placement drawing
 * with its figures, and the label at true size to print and wrap round a sample.
 */
import PdpTechnicalDrawing from "@/components/pdp/PdpTechnicalDrawing";
import PdpLabelPlacement, { PdpLabelTemplate } from "@/components/pdp/PdpLabelPlacement";
import type { TechnicalDrawingData } from "@/lib/products/pdp-redesign/tech-drawing";
import type { TechRow } from "@/lib/products/pdp-redesign/model";
import { LABEL_FIT_DISCLAIMER, formatLabelMm, labelFitRows, type LabelFit } from "@/lib/products/pdp-redesign/label-fit";

export type TechSheetData = {
    title: string;
    eyebrow: string;
    selection: string | null;
    websiteSku: string | null;
    graceSku: string | null;
    rows: TechRow[];
    description: string | null;
    technical: TechnicalDrawingData | null;
    /** Where a label goes on this bottle (label-fit.ts): adds the label placement page and the print-and-wrap template. */
    labelFit?: LabelFit | null;
    wordmarkUrl: string;
    generatedAt: Date;
};

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=block");
@page { size: 8.5in 11in; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; }
body { font-family: "Montserrat", "Helvetica Neue", Arial, sans-serif; color: #1c1c1e; background: #fff; }
.sheet { width: 8.5in; height: 11in; padding: 0.55in 0.6in 0.5in; display: flex; flex-direction: column; background: #fff; }
.head { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 14px; border-bottom: 1px solid #1c1c1e; }
.lockup { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.wordmark { height: 19px; display: block; }
.tagline { font-size: 6.5px; font-weight: 500; letter-spacing: .34em; color: #1c1c1e; padding-left: .34em; }
.docType { text-align: right; }
.docType b { display: block; font-size: 10px; font-weight: 600; letter-spacing: .22em; color: #9a7a48; }
.docType span { display: block; margin-top: 4px; font-size: 8.5px; letter-spacing: .08em; color: #8a8580; }
.titleBlock { padding: 20px 0 16px; }
.eyebrow { font-size: 9px; font-weight: 600; letter-spacing: .2em; color: #9a7a48; text-transform: uppercase; }
h1 { margin: 6px 0 0; font-size: 21px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; line-height: 1.2; }
.selection { margin-top: 6px; font-size: 10.5px; color: #5d6b7e; }
.skus { margin-top: 10px; display: flex; gap: 22px; font-size: 8.5px; letter-spacing: .06em; color: #8a8580; }
.skus b { color: #1c1c1e; font-weight: 500; font-family: ui-monospace, Menlo, monospace; letter-spacing: 0; margin-left: 6px; }
.body { flex: 1; display: grid; grid-template-columns: 4.75in 1fr; gap: 0.3in; min-height: 0; }
.body.noDrawing { grid-template-columns: 1fr; }
.drawing { border: 1px solid #e6e2df; padding: 10px 10px 6px; align-self: start; }
.label { font-size: 8.5px; font-weight: 600; letter-spacing: .2em; color: #9a7a48; margin-bottom: 8px; }
.rows { border-top: 1px solid #e6e2df; }
.row { display: grid; grid-template-columns: 1.05in 1fr; padding: 7px 0; border-bottom: 1px solid #ece9e6; font-size: 9.5px; }
.row span:first-child { color: #5d6b7e; }
.desc { margin-top: 22px; font-size: 9.5px; line-height: 1.6; color: #4d5767; }
.note { margin-top: 18px; padding: 10px 12px; background: #f6f4f3; font-size: 8.5px; line-height: 1.55; color: #5d6b7e; }
.foot { margin-top: 16px; padding-top: 10px; border-top: 1px solid #e6e2df; display: flex; justify-content: space-between; align-items: baseline; gap: 16px; font-size: 7.5px; color: #8a8580; letter-spacing: .03em; white-space: nowrap; }
.foot b { color: #1c1c1e; font-weight: 600; letter-spacing: .08em; }
.lpBody { flex: 1; display: flex; flex-direction: column; gap: 18px; min-height: 0; }
.lpDrawing { border: 1px solid #e6e2df; padding: 12px 12px 6px; }
.lpFigures { display: grid; grid-template-columns: 1fr 1fr; gap: 0 0.3in; }
.lpNote { margin-top: 10px; font-size: 9px; line-height: 1.55; color: #4d5767; }
.templateBody { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 14px; padding-top: 6px; }
.steps { align-self: stretch; font-size: 9.5px; line-height: 1.6; color: #4d5767; margin: 0; padding-left: 16px; }
.scale { display: flex; align-items: center; gap: 10px; font-size: 8.5px; color: #8a8580; letter-spacing: .04em; }
`;

function SheetHead({ data, docType }: { data: TechSheetData; docType: string }) {
    const date = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(data.generatedAt);
    return (
        <div className="head">
            <div className="lockup">
                {/* eslint-disable-next-line @next/next/no-img-element -- printed by Chromium, not served by Next */}
                <img className="wordmark" src={data.wordmarkUrl} alt="Best Bottles" />
                <span className="tagline">FRAGRANCE &amp; BEAUTY PACKAGING</span>
            </div>
            <div className="docType">
                <b>{docType}</b>
                <span>{date}</span>
            </div>
        </div>
    );
}

function SheetFoot() {
    return (
        <div className="foot">
            <span><b>BEST BOTTLES</b> · a division of Nemat International · Union City, California</span>
            <span>1-800-936-3628 · sales@nematinternational.com</span>
        </div>
    );
}

function TitleBlock({ data, eyebrow }: { data: TechSheetData; eyebrow?: string }) {
    return (
        <div className="titleBlock">
            <div className="eyebrow">{eyebrow ?? data.eyebrow}</div>
            <h1>{data.title}</h1>
            {data.selection ? <div className="selection">{data.selection}</div> : null}
            <div className="skus">
                {data.websiteSku ? <span>Item<b>{data.websiteSku}</b></span> : null}
                {data.graceSku ? <span>Reference<b>{data.graceSku}</b></span> : null}
            </div>
        </div>
    );
}

/** Page 2: where the label goes, drawn from label-fit.ts, with its figures and the printer note. */
function LabelPlacementSheet({ data, fit }: { data: TechSheetData; fit: LabelFit }) {
    const rows = labelFitRows(fit);
    const half = Math.ceil(rows.length / 2);
    return (
        <div className="sheet">
            <SheetHead data={data} docType="LABEL PLACEMENT" />
            <TitleBlock data={data} />
            <div className="lpBody">
                <div className="lpDrawing">
                    <PdpLabelPlacement fit={fit} idPrefix="sheetlp" />
                </div>
                <div className="lpFigures">
                    {[rows.slice(0, half), rows.slice(half)].map((column, i) => (
                        <div key={i} className="rows">
                            {column.map((row) => (
                                <div key={row.k} className="row"><span>{row.k}</span><span>{row.v}</span></div>
                            ))}
                        </div>
                    ))}
                </div>
                {fit.note ? <p className="lpNote">{fit.note}</p> : null}
                <div className="note">{LABEL_FIT_DISCLAIMER}</div>
            </div>
            <SheetFoot />
        </div>
    );
}

/** Page 3: the label at true size, to print at 100%, cut out and wrap round a sample. */
function LabelTemplateSheet({ data, fit }: { data: TechSheetData; fit: LabelFit }) {
    const size = fit.shape === "disc"
        ? `a round label up to Ø ${formatLabelMm(fit.label.widthMm)} mm`
        : `${formatLabelMm(fit.label.widthMm)} × ${formatLabelMm(fit.label.heightMm)} mm`;
    return (
        <div className="sheet">
            <SheetHead data={data} docType="LABEL TEMPLATE" />
            <TitleBlock data={data} eyebrow="Print at 100% · actual size" />
            <div className="templateBody">
                <ol className="steps">
                    <li>Print this page at 100% (turn off &ldquo;fit to page&rdquo;). The bar below should measure exactly 50 mm.</li>
                    <li>Cut on the solid line: {size}{fit.label.panels > 1 ? `, one for each of ${fit.label.panels} faces` : ""}.</li>
                    <li>{fit.shape === "wrap" && fit.label.panels === 1
                        ? `Wrap it round a sample bottle, ${formatLabelMm(fit.label.fromBaseMm)} mm above the base, with the join at the back and the marked front facing you.`
                        : fit.shape === "disc"
                            ? "Hold it centred on the flat face of a sample bottle."
                            : `Hold it on a face of a sample bottle, ${formatLabelMm(fit.label.fromBaseMm)} mm above the base.`}</li>
                    <li>Share the result with your label printer before you order a full run.</li>
                </ol>
                <div className="scale">
                    <svg width="50mm" height="3mm" viewBox="0 0 50 3" style={{ display: "block" }}>
                        <rect x={0} y={0.5} width={50} height={2} fill="#1c1c1e" />
                        <rect x={10} y={0.5} width={10} height={2} fill="#fff" />
                        <rect x={30} y={0.5} width={10} height={2} fill="#fff" />
                        <rect x={0} y={0.5} width={50} height={2} fill="none" stroke="#1c1c1e" strokeWidth={0.2} />
                    </svg>
                    <span>50 mm</span>
                </div>
                <PdpLabelTemplate fit={fit} />
            </div>
            <div className="note">{LABEL_FIT_DISCLAIMER}</div>
            <SheetFoot />
        </div>
    );
}

function TechSheetDocument({ data }: { data: TechSheetData }) {
    return (
        <>
        <div className="sheet">
            <SheetHead data={data} docType="TECH SHEET" />

            <TitleBlock data={data} />

            <div className={data.technical ? "body" : "body noDrawing"}>
                {data.technical ? (
                    <div className="drawing">
                        <div className="label">TECHNICAL DRAWING</div>
                        <PdpTechnicalDrawing data={data.technical} idPrefix="sheet" />
                    </div>
                ) : null}
                <div>
                    <div className="label">SPECIFICATIONS</div>
                    <div className="rows">
                        {data.rows.map((row) => (
                            <div key={row.k} className="row"><span>{row.k}</span><span>{row.v}</span></div>
                        ))}
                    </div>
                    {data.description ? <p className="desc">{data.description}</p> : null}
                    {data.technical ? (
                        <div className="note">
                            The drawing is the production glass, measured with a caliper and a depth rod and modelled to those readings.
                            Specification figures are the catalogue&apos;s, with their tolerances; glass varies slightly from lot to lot.
                        </div>
                    ) : null}
                </div>
            </div>

            <SheetFoot />
        </div>
        {data.labelFit ? <LabelPlacementSheet data={data} fit={data.labelFit} /> : null}
        {data.labelFit ? <LabelTemplateSheet data={data} fit={data.labelFit} /> : null}
        </>
    );
}

export async function renderTechSheetHtml(data: TechSheetData): Promise<string> {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const markup = renderToStaticMarkup(<TechSheetDocument data={data} />);
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${data.title.replace(/[<&]/g, "")} · Tech sheet · Best Bottles</title>
<style>${CSS}</style>
</head>
<body>${markup}</body>
</html>`;
}
