import type { ReactNode } from "react";

const layoutCss = `
.focused-pdp-grid{display:grid;grid-template-columns:minmax(0, 1fr);gap:1.5rem;align-items:start}
.focused-pdp-stage{min-width:0;padding-bottom:2.75rem}
.focused-pdp-stage-plate{aspect-ratio:10 / 11;max-height:min(72vh,720px);width:100%;margin-inline:auto}
.focused-pdp-purchase{min-width:0;border-top:1px solid rgb(216 203 183 / .65);padding-top:1.25rem}
@container focused-pdp (min-width: 720px){.focused-pdp-grid{grid-template-columns:minmax(0, 1fr) minmax(320px, 1fr);gap:clamp(1.5rem,3vw,3.5rem)}.focused-pdp-purchase{border-top:0;border-left:1px solid rgb(216 203 183 / .65);padding-top:0;padding-left:clamp(1.5rem,2.5vw,2.75rem)}.pdp-mobile-sticky-summary{display:none}}
@media (min-width: 1024px){[data-grace-layout="push"] .focused-pdp-grid{grid-template-columns:minmax(0, 0.72fr) minmax(280px, 1.28fr);gap:clamp(1rem,2vw,2rem)}[data-grace-layout="push"] .focused-pdp-purchase{border-top:0;border-left:1px solid rgb(216 203 183 / .65);padding-top:0;padding-left:clamp(1rem,2vw,2rem)}[data-grace-layout="push"] .focused-pdp-stage-plate{max-height:min(52vh,520px)}[data-grace-layout="push"] .pdp-mobile-sticky-summary{display:none}}
`;

export default function FocusedPdpLayout({
    stage,
    purchase,
    mobileStickySummary,
    className = "",
}: {
    stage: ReactNode;
    purchase: ReactNode;
    mobileStickySummary?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`focused-pdp-shell w-full ${className}`}
            style={{ containerType: "inline-size", containerName: "focused-pdp" }}
        >
            <style>{layoutCss}</style>
            <div className="focused-pdp-grid">
                <section className="focused-pdp-stage" data-pdp-primary-panel="stage">
                    <div className="focused-pdp-stage-plate" data-pdp-stage-plate="10:11">
                        {stage}
                    </div>
                </section>
                <aside className="focused-pdp-purchase" data-pdp-primary-panel="purchase">
                    {purchase}
                </aside>
            </div>
            {mobileStickySummary ? (
                <div className="pdp-mobile-sticky-summary">{mobileStickySummary}</div>
            ) : null}
        </div>
    );
}
