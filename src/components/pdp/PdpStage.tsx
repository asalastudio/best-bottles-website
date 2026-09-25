"use client";

/**
 * The canvas: pick line and view switch, the cap rail, the stage with its
 * three views, and the glass lineup. One DOM for desktop and mobile; the
 * stylesheet's grid areas move the rail beside or under the stage.
 *
 * Imagery is kit layers only (bare body, fitment, cap as true-alpha layers on
 * the canvas). A SKU with no kit falls back to its catalogue photograph in
 * SIDECAR, and the other views are disabled with a tooltip.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "./pdp.module.css";
import PdpKitPartImage from "./PdpKitPartImage";
import PdpKitStackImage from "./PdpKitStackImage";
import { displayImageUrl } from "@/lib/products/optimizable-image";
import { markRegisterOptimizerUnavailable, registerImageSrc } from "@/lib/products/register-image";
import { getMaterialSwatchStyle } from "@/lib/products/material-swatches";
import { glassSwatchImage } from "@/lib/products/glass-swatches";
import type { Callout } from "@/lib/products/pdp-redesign/model";
import {
    STAGE_VIEWS,
    bodyPart,
    closureParts,
    stageLayout,
    type KitLike,
    type StageContext,
    type StageView,
} from "@/lib/products/pdp-redesign/stage";

export type CapRailItem = {
    id: string;
    name: string;
    swatchName: string;
    kit: KitLike | null;
    unavailable: boolean;
};

export type GlassLineupItem = {
    slug: string;
    label: string;
    active: boolean;
    kit: KitLike | null;
    /** Nothing of this glass is in stock or sellable online. */
    unavailable?: boolean;
};

export type PdpStageProps = {
    pickLine: string;
    view: StageView;
    availableViews: StageView[];
    onViewChange: (view: StageView) => void;
    kit: KitLike | null;
    context: StageContext;
    fallbackImageUrl: string | null;
    fallbackAlt: string;
    callouts: Callout[];
    caps: CapRailItem[];
    activeCapId: string | null;
    onCapPick: (id: string) => void;
    glasses: GlassLineupItem[];
    onGlassPick: (slug: string) => void;
    activeCapName: string | null;
    activeGlassLabel: string;
};

/** Two callout labels need this much of the stage's height between their anchors (a three-line label is ~48 px in a ~560 px stage, plus breathing room). */
const CALLOUT_MIN_GAP_PCT = 10;

/**
 * A canvas percentage as a length inside the stage box. The 10:11 canvas is
 * centred in the fluid stage (`.stage` defines --pdp-canvas-*), so a callout
 * placed in stage percentages drifts off its part as the stage widens.
 */
const canvasX = (pct: number) => `calc(var(--pdp-canvas-x) + var(--pdp-canvas-w) * ${pct / 100})`;
const canvasY = (pct: number) => `calc(var(--pdp-canvas-y) + var(--pdp-canvas-h) * ${pct / 100})`;

/** The mobile layout (option 4a) applies below 900px; thumbnails shrink with it. */
export function useIsPdpMobile(): boolean {
    const [mobile, setMobile] = useState(false);
    useEffect(() => {
        const media = window.matchMedia("(max-width: 899px)");
        const update = () => setMobile(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);
    return mobile;
}

export default function PdpStage({
    pickLine, view, availableViews, onViewChange, kit, context, fallbackImageUrl, fallbackAlt, callouts,
    caps, activeCapId, onCapPick, glasses, onGlassPick, activeCapName, activeGlassLabel,
}: PdpStageProps) {
    const layout = useMemo(() => stageLayout(kit, view, context), [kit, view, context]);
    const railRef = useRef<HTMLDivElement>(null);
    // Register masters are served display-sized through the optimizer; when that
    // proxy cannot reach the Blob host (a local network quirk) the master is shown.
    const [rawUrls, setRawUrls] = useState<ReadonlySet<string>>(() => new Set());
    const showRaw = (url: string) => setRawUrls((current) => (current.has(url) ? current : new Set(current).add(url)));
    const mobile = useIsPdpMobile();
    const capThumbHeight = mobile ? 42 : 48;
    const glassThumbHeight = mobile ? 60 : 96;

    // Mobile strip: keep the selected cap in view on load and on change.
    useEffect(() => {
        const rail = railRef.current;
        if (!rail || !activeCapId) return;
        // Cap ids are slugs ([a-z0-9-]); a quote is the only character that could break the selector.
        const button = rail.querySelector<HTMLButtonElement>(`[data-cap-id="${activeCapId.replace(/"/g, "")}"]`);
        if (!button || typeof button.scrollIntoView !== "function") return;
        if (rail.scrollWidth > rail.clientWidth) {
            button.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
        }
    }, [activeCapId]);

    const showCallouts = Boolean(layout?.grid) && callouts.length > 0;
    const calloutRows = useMemo(() => {
        if (!layout) return [];
        const rows = callouts.map((callout) => ({ callout, anchor: layout.anchors[callout.key] ?? null, shiftPct: 0 }));
        // Labels read top to bottom. When two anchors sit closer than a label is
        // tall (the roller insert seats right at the neck), the lower label steps
        // down and its leader jogs; the dot stays on the part.
        let floor = Number.NEGATIVE_INFINITY;
        for (const row of rows.filter((entry) => entry.anchor).sort((a, b) => a.anchor!.yPct - b.anchor!.yPct)) {
            const y = Math.max(row.anchor!.yPct, floor);
            row.shiftPct = y - row.anchor!.yPct;
            floor = y + CALLOUT_MIN_GAP_PCT;
        }
        return rows;
    }, [callouts, layout]);

    return (
        <section className={styles.canvas} aria-label="Product canvas" data-testid="pdp-canvas">
            <div className={styles.canvasHead}>
                <span className={styles.pickLine} data-testid="pdp-pick-line">{pickLine}</span>
                <div className={styles.viewSwitch} role="group" aria-label="View">
                    {STAGE_VIEWS.map((option) => {
                        const enabled = availableViews.includes(option.id);
                        return (
                            <button
                                key={option.id}
                                type="button"
                                className={styles.viewButton}
                                aria-pressed={view === option.id}
                                disabled={!enabled}
                                title={enabled ? undefined : "Layered view not yet available"}
                                onClick={() => onViewChange(option.id)}
                                data-testid={`pdp-view-${option.id}`}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className={styles.rail} role="group" aria-label="Caps" data-testid="pdp-cap-rail">
                <span className={styles.railLabel}>
                    <span className={styles.railLabelDesktop}>CAPS {caps.length}</span>
                    {activeCapName ? <span className={styles.railLabelMobile}>CAP · {activeCapName}</span> : null}
                </span>
                <div className={styles.railTrack} ref={railRef}>
                {caps.map((cap) => {
                    const parts = closureParts(cap.kit);
                    return (
                        <button
                            key={cap.id}
                            type="button"
                            className={styles.railButton}
                            aria-pressed={cap.id === activeCapId}
                            aria-label={`${cap.name} cap`}
                            title={cap.name}
                            data-cap-id={cap.id}
                            data-unavailable={cap.unavailable ? "true" : undefined}
                            onClick={() => onCapPick(cap.id)}
                        >
                            {parts.length && cap.kit
                                ? <PdpKitStackImage parts={parts} canvas={cap.kit.canvas} height={capThumbHeight} />
                                : <span className={styles.railSwatch} style={getMaterialSwatchStyle(cap.swatchName, {})} aria-hidden />}
                        </button>
                    );
                })}
                </div>
            </div>

            <div
                className={styles.stage}
                data-testid="pdp-stage"
                data-view={view}
                data-layered={layout ? "true" : "false"}
                data-source={layout ? (kit?.register ? "register" : "kit") : fallbackImageUrl ? "photo" : "none"}
            >
                <div className={styles.stageGrid} data-on={layout?.grid ? "true" : "false"} aria-hidden />
                <div className={styles.stageBaseline} data-on={layout ? (layout.baseline ? "true" : "false") : "true"} aria-hidden />
                {layout ? (
                    <div className={styles.stageCanvasHost} role="img" aria-label={fallbackAlt}>
                        <div className={styles.stageCanvas}>
                            <div className={styles.stageFrame} style={{ transform: layout.frameCss }}>
                                {layout.parts.map((part) => part.box ? (
                                    // A register part: a native cut-out standing in its box on the canvas. The
                                    // canvas-sized wrapper carries the view offset so the percentages stay the canvas's.
                                    <span
                                        key={part.key}
                                        className={styles.stagePart}
                                        data-slot={part.slot}
                                        style={{ transform: `translate(${part.dxPct}%, ${part.dyPct}%)`, zIndex: part.zIndex }}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={rawUrls.has(part.url) ? part.url : registerImageSrc(part.url, 640)}
                                            alt=""
                                            draggable={false}
                                            decoding="async"
                                            onError={() => { if (markRegisterOptimizerUnavailable(part.url)) showRaw(part.url); }}
                                            style={{
                                                position: "absolute", display: "block", maxWidth: "none",
                                                left: `${part.box.leftPct}%`, top: `${part.box.topPct}%`,
                                                width: `${part.box.widthPct}%`, height: `${part.box.heightPct}%`,
                                            }}
                                        />
                                    </span>
                                ) : (
                                    // Kit layers stay plain <img>: their pixel canvas and alpha must not change.
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        key={part.key}
                                        src={displayImageUrl(part.url)}
                                        alt=""
                                        draggable={false}
                                        decoding="async"
                                        className={styles.stagePart}
                                        data-slot={part.slot}
                                        style={{ transform: `translate(${part.dxPct}%, ${part.dyPct}%)`, zIndex: part.zIndex }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                ) : fallbackImageUrl ? (
                    <div className={styles.stageFallback}>
                        {/* Kit layers and plates stay plain <img>: their pixel canvas and alpha must not change. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={displayImageUrl(fallbackImageUrl)} alt={fallbackAlt} decoding="async" />
                    </div>
                ) : (
                    <div className={styles.stageEmpty}>Photography coming soon</div>
                )}

                <div className={styles.callouts} data-on={showCallouts ? "true" : "false"} aria-hidden={!showCallouts} data-testid="pdp-callouts">
                    {calloutRows.map(({ callout, anchor, shiftPct }) => {
                        if (!anchor) return null;
                        const rowStyle: CSSProperties = {
                            left: canvasX(anchor.xPct),
                            top: `calc(${canvasY(anchor.yPct + shiftPct)} - 8px)`,
                        };
                        return (
                            <div key={callout.key} className={styles.calloutGroup} data-callout={callout.key} data-shifted={shiftPct > 0 ? "true" : undefined}>
                                <span className={styles.calloutDot} style={{ left: canvasX(anchor.xPct), top: canvasY(anchor.yPct) }} />
                                {shiftPct > 0 ? <span className={styles.calloutJog} style={{ left: canvasX(anchor.xPct), top: canvasY(anchor.yPct), height: `calc(var(--pdp-canvas-h) * ${shiftPct / 100})` }} /> : null}
                                <div className={styles.callout} style={rowStyle}>
                                    <span className={styles.calloutLeader} />
                                    <span className={styles.calloutLabel}>
                                        <b>{callout.title}</b>
                                        {callout.line1}
                                        {callout.line2 ? <><br />{callout.line2}</> : null}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className={styles.lineup} data-testid="pdp-glass-lineup">
                <span className={styles.lineupLabel}>
                    <span className={styles.railLabelDesktop}>GLASS · {glasses.length}</span>
                    <span className={styles.railLabelMobile}>GLASS · {activeGlassLabel}</span>
                </span>
                <div className={styles.lineupGrid} role="group" aria-label="Glass">
                    {glasses.map((glass) => {
                        const body = bodyPart(glass.kit);
                        const swatch = glassSwatchImage(glass.label);
                        return (
                            <button
                                key={glass.slug}
                                type="button"
                                className={styles.glassButton}
                                aria-pressed={glass.active}
                                onClick={() => onGlassPick(glass.slug)}
                                data-glass-slug={glass.slug}
                                data-unavailable={glass.unavailable ? "true" : undefined}
                                title={glass.unavailable ? `${glass.label}: out of stock` : undefined}
                            >
                                {body && glass.kit
                                    ? <PdpKitPartImage part={body} canvas={glass.kit.canvas} height={glassThumbHeight} />
                                    : <span className={styles.glassTile} style={swatch ? { backgroundImage: `url(${swatch})`, backgroundSize: "cover" } : getMaterialSwatchStyle(glass.label, {})} aria-hidden />}
                                <span className={styles.glassName}>{glass.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
