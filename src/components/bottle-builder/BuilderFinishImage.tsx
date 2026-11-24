"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CATALOG_CAP_FAMILY, catalogCapExactPhoto, catalogCapKind, catalogCapPhoto, catalogCapPhotoBounds, catalogCapPhotoFrame, catalogCapPsdPhoto } from "@/lib/products/catalog-cap-photos";
import { isClosurePart, type BuilderConfiguration } from "@/lib/bottle-builder/model";
import BuilderImage from "./BuilderImage";
import { builderPreviewLayout } from "@/lib/bottle-builder/preview-layout";
import exposedSprayers from "@/lib/bottle-builder/exposed-sprayers.generated.json";
import componentCutouts from "@/lib/bottle-builder/component-cutouts.generated.json";
import { displayImageUrl } from "@/lib/products/optimizable-image";

/** Share of a closure tile's height the tallest part fills, and the gap kept under every part. */
export const CLOSURE_HEIGHT = 0.86;
export const CLOSURE_BASELINE = 0.04;

/**
 * How a closure photo whose part has been measured (cap-swatch-bounds.generated.json, a spray top's
 * stored box) is cropped to that part: its aspect ratio, and the photo's size and offset as shares of
 * the part box. Undefined for a photo never measured, which is drawn whole.
 */
export function closurePartFrame(url: string) {
    const bounds = catalogCapPhotoBounds(url);
    if (!bounds) return undefined;
    const width = bounds.right - bounds.left, height = bounds.bottom - bounds.top;
    if (width <= 0 || height <= 0) return undefined;
    return {
        ratio: +(width / height).toFixed(4),
        image: {
            width: `${(bounds.width / width) * 100}%`, height: `${(bounds.height / height) * 100}%`,
            left: `${(-bounds.left / width) * 100}%`, top: `${(-bounds.top / height) * 100}%`,
        },
    };
}

/** Show the actual photographed finish, never a whole bottle in a cap tile. */
/** The layers a finish tile draws: the closure, or for a sprayer or pump its mechanism. */
function finishParts(config: BuilderConfiguration) {
    const mechanismFinish = /Sprayer|Pump/.test(config.fitment);
    return (config.kit?.parts ?? []).filter(part => mechanismFinish
        ? part.slot !== "body" && part.slot !== "diptube" && !isClosurePart(part)
        : isClosurePart(part));
}

/**
 * The layer bounds of every option in a finish grid that shares this option's registered canvas, so
 * each tile frames the same region: one scale and one baseline for the whole grid, and a short cap
 * draws shorter than a tall one beside it. Undefined when no peer shares the canvas, or when every
 * option is the same height (the tile then frames its own part, so all draw at one size).
 */
export function finishGridBounds(config: BuilderConfiguration, peers: readonly BuilderConfiguration[] = []) {
    const canvas = config.kit?.canvas, anchors = config.kit?.anchors;
    if (!canvas || !anchors) return undefined;
    const sameCanvas = peers.filter(peer => peer.kit && peer.kit.canvas.width === canvas.width && peer.kit.canvas.height === canvas.height
        && peer.kit.anchors.baselineY === anchors.baselineY && peer.kit.anchors.seatY === anchors.seatY && peer.kit.anchors.axisX === anchors.axisX);
    if (sameCanvas.length < 2 || !sameCanvas.some(peer => peer.id === config.id)) return undefined;
    const perOption = sameCanvas.map(peer => {
        const parts = finishParts(peer);
        return parts.length ? builderPreviewLayout(peer, parts, { thumbnail: true })?.layers.map(layer => layer.bounds) ?? [] : [];
    }).filter(bounds => bounds.length);
    const heights = perOption.map(bounds => Math.max(...bounds.map(b => b.bottom)) - Math.min(...bounds.map(b => b.top)));
    // One moulding in several finishes: each tile already fills the same height, which reads as one size
    // better than the register's few-percent differences between component boxes would at a shared scale.
    if (heights.length < 2 || Math.max(...heights) / Math.min(...heights) < MIXED_PART_HEIGHTS) return undefined;
    return perOption.flat();
}

/** Part heights spread at least this much (short and tall caps, leather wraps) share one frame. */
export const MIXED_PART_HEIGHTS = 1.12;

export default function BuilderFinishImage({ config, peers }: { config: BuilderConfiguration; peers?: readonly BuilderConfiguration[] }) {
    const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
    const parts = finishParts(config);
    const frameBounds = useMemo(() => finishGridBounds(config, peers), [config, peers]);
    const kind = config.fitment === "Screw Cap" || config.fitment === "Reducer" ? "plain"
        : catalogCapKind([config.fitment]);
    const preview = { id: config.id, websiteSku: config.id, label: config.closure };
    const exposed = (exposedSprayers as Record<string, { mechanismUrl: string }>)[config.id]?.mechanismUrl;
    const cutout = exposed ?? (componentCutouts as Record<string, { url: string }>)[config.finishComponent.websiteSku]?.url;
    const exact = cutout && !failed.has(cutout) ? cutout : kind ? catalogCapExactPhoto(preview, kind, failed) ?? undefined : undefined;
    const needsComponentPhoto = !parts.length && !exact && kind !== null;
    const photos = useQuery(api.productPlates.byFamily, needsComponentPhoto
        ? { familyId: `${CATALOG_CAP_FAMILY[kind]}-${config.neck}`, limit: 200 } : "skip");
    // Some plain caps are indexed in the roll-on-cap merchandising family.
    // The shared resolver still rejects roller caps for a plain-cap choice.
    const plainCaps = useQuery(api.productPlates.byFamily, needsComponentPhoto && kind === "plain"
        ? { familyId: `roll-on-cap-${config.neck}`, limit: 200 } : "skip");
    const rows = [...(photos?.page ?? []), ...(plainCaps?.page ?? [])];
    const platesLoaded = !needsComponentPhoto || (photos !== undefined && (kind !== "plain" || plainCaps !== undefined));
    const url = exact
        ?? (kind ? catalogCapPhoto(preview, rows, kind, failed, { platesLoaded }) : catalogCapPsdPhoto(config.id)?.url)
        ?? (config.finishComponent.imageUrl && !failed.has(config.finishComponent.imageUrl) ? config.finishComponent.imageUrl : undefined);

    if (parts.length) return <BuilderImage config={config} parts={parts} label={config.closure} thumbnail frameBounds={frameBounds} />;
    if (!url) return <span role="img" aria-label={`${config.closure} — cap photo unavailable`}>Cap photo coming soon</span>;
    const part = closurePartFrame(url);
    if (part) {
        // Every measured closure in the grid is cropped to the part and fitted to the same box, standing on
        // the same baseline, so six roll-on caps of one moulding draw at one size whatever margin each
        // photo was published with.
        return <span data-closure-part style={{ position: "absolute", inset: 6, containerType: "size" }}>
            <span style={{ position: "absolute", inset: `0 0 ${CLOSURE_BASELINE * 100}% 0`, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                <span style={{ position: "relative", display: "block", flex: "none", overflow: "hidden", aspectRatio: `${part.ratio}`, width: `min(100cqw, calc(${CLOSURE_HEIGHT * 100}cqh * ${part.ratio}))` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={displayImageUrl(url, 640)} alt={config.closure} loading="lazy" onError={() => setFailed(current => new Set([...current, url]))}
                        style={{ position: "absolute", maxWidth: "none", maxHeight: "none", minHeight: 0, objectFit: "fill", ...part.image }} />
                </span>
            </span>
        </span>;
    }
    const frame = catalogCapPhotoFrame(url);
    // Component photos are already published at their own native aspect ratio.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={displayImageUrl(url, 640)} alt={config.closure} loading="lazy" onError={() => setFailed(current => new Set([...current, url]))}
        style={frame ? { position: "absolute", maxWidth: "none", ...frame }
            : { width: "100%", height: "100%", objectFit: "contain" }} />;
}
