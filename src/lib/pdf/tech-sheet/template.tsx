/**
 * The branded tech sheet (one US Letter page) behind the product page's
 * "Download PDF": wordmark, the product and its SKUs, the tech-sheet figures,
 * the technical drawing from the locked Blender body with the caliper
 * readings, the item description and the company line. Rendered to HTML here
 * and printed to PDF by the catalogue's Chromium renderer (../catalog/puppeteer).
 */
import PdpTechnicalDrawing from "@/components/pdp/PdpTechnicalDrawing";
import type { TechnicalDrawingData } from "@/lib/products/pdp-redesign/tech-drawing";
import type { TechRow } from "@/lib/products/pdp-redesign/model";

export type TechSheetData = {
    title: string;
    eyebrow: string;
    selection: string | null;
    websiteSku: string | null;
    graceSku: string | null;
    rows: TechRow[];
    description: string | null;
    technical: TechnicalDrawingData | null;
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
`;

function TechSheetDocument({ data }: { data: TechSheetData }) {
    const date = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(data.generatedAt);
    return (
        <div className="sheet">
            <div className="head">
                <div className="lockup">
                    {/* eslint-disable-next-line @next/next/no-img-element -- printed by Chromium, not served by Next */}
                    <img className="wordmark" src={data.wordmarkUrl} alt="Best Bottles" />
                    <span className="tagline">FRAGRANCE &amp; BEAUTY PACKAGING</span>
                </div>
                <div className="docType">
                    <b>TECH SHEET</b>
                    <span>{date}</span>
                </div>
            </div>

            <div className="titleBlock">
                <div className="eyebrow">{data.eyebrow}</div>
                <h1>{data.title}</h1>
                {data.selection ? <div className="selection">{data.selection}</div> : null}
                <div className="skus">
                    {data.websiteSku ? <span>Item<b>{data.websiteSku}</b></span> : null}
                    {data.graceSku ? <span>Reference<b>{data.graceSku}</b></span> : null}
                </div>
            </div>

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

            <div className="foot">
                <span><b>BEST BOTTLES</b> · a division of Nemat International · Union City, California</span>
                <span>1-800-936-3628 · sales@nematinternational.com</span>
            </div>
        </div>
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
