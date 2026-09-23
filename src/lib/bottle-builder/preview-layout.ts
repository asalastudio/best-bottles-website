import { previewParts, type BuilderConfiguration, type BuilderPart } from "./model";
import { canonicalBody, registerVintagePreview, seatPreviewLayers, type PreviewLayer } from "./preview-registration";
import { previewFrame } from "./preview-frame";

type Stage = "body" | "fitment" | "complete";

/** Display registration shared by drawing and framing. Measure the parts AFTER
 * neck seating and sidecar placement, in the same source coordinate system. */
export function builderPreviewLayout(config: BuilderConfiguration, parts: BuilderPart[], {
    stage = "body", thumbnail = false, showCover = false, bodyReference,
}: { stage?: Stage; thumbnail?: boolean; showCover?: boolean; bodyReference?: BuilderConfiguration } = {}) {
    const kit = stage === "body" ? config.previewKit ?? config.kit ?? config.chooserKit : config.kit;
    if (!kit) return null;
    const registration = !thumbnail || canonicalBody(config) ? registerVintagePreview(config, parts, bodyReference) : null;
    const anchors = registration?.anchors ?? kit.anchors;
    let layers = registration?.layers ?? parts.map(part => ({ part, bounds: part.bounds, transform: undefined as string | undefined }));
    if (!thumbnail && stage !== "body") layers = seatPreviewLayers(layers, anchors);
    if (!thumbnail && !showCover && stage !== "body" && layers.some(l => l.part.slot === "overcap")
        && layers.some(l => !["body", "overcap", "diptube"].includes(l.part.slot))) {
        const body = layers.find(l => l.part.slot === "body");
        const baseline = registration?.groundY ?? kit.anchors.baselineY;
        layers = layers.map(l => {
            if (l.part.slot !== "overcap" || !body) return l;
            const gap = Math.max(18, (body.bounds.right - body.bounds.left) * .08);
            const dx = body.bounds.right + gap - l.bounds.left, dy = baseline - l.bounds.bottom;
            return { ...l, bounds: { left: l.bounds.left + dx, right: l.bounds.right + dx, top: l.bounds.top + dy, bottom: l.bounds.bottom + dy },
                transform: `translate(${dx} ${dy})${l.transform ? ` ${l.transform}` : ""}` };
        });
    }
    return { anchors, layers };
}

/** Reserve room for every offered top on this exact glass body. Changing a
 * finish, fitment, or cover state must not change the camera. Chooser thumbnails
 * and unrelated bodies are deliberately excluded from this shared envelope. */
export function builderBodyFrame(config: BuilderConfiguration, candidates: readonly BuilderConfiguration[],
    bodyReference: BuilderConfiguration | undefined, selected: NonNullable<ReturnType<typeof builderPreviewLayout>>,
    { expanded = false } = {}) {
    const compatible = candidates.filter(c => c.bodyId === config.bodyId && c.family === config.family
        && c.capacityMl === config.capacityMl && c.neck === config.neck);
    const referenceFor = (color: string) => {
        if (color === config.color && bodyReference) return bodyReference;
        const colored = compatible.filter(c => c.color === color);
        return colored.find(c => c.fitment === "Vintage Bulb Sprayer" && c.kit?.completeness === "full")
            ?? colored.find(c => c.kit?.completeness === "full" && c.fitment !== "Reducer")
            ?? colored.find(c => c.kit?.completeness === "full") ?? colored[0];
    };
    const reference = referenceFor(config.color);
    const referenceLayout = reference && builderPreviewLayout(reference, previewParts(reference, "body"), { bodyReference: reference });
    const target = referenceLayout?.layers.find(l => l.part.slot === "body")?.bounds
        ?? selected.layers.find(l => l.part.slot === "body")?.bounds;
    if (!target || target.right <= target.left) return previewFrame(selected.anchors, selected.layers.map(l => l.bounds), { expanded });
    const bounds: PreviewLayer["bounds"][] = [];
    let bodyHeight = 0;
    const include = (layout: NonNullable<ReturnType<typeof builderPreviewLayout>>) => {
        const body = layout.layers.find(l => l.part.slot === "body")?.bounds;
        if (!body || body.right <= body.left) return;
        // Compare framing in glass-diameter units. This lets clear/frosted/etc
        // share a camera without borrowing any pixels across material variants.
        const width = body.right - body.left, axis = (body.left + body.right) / 2;
        bodyHeight = Math.max(bodyHeight, (body.bottom - body.top) / width);
        bounds.push(...layout.layers.map(({ bounds: b }) => ({
            left: (b.left - axis) / width, right: (b.right - axis) / width,
            top: (b.top - body.bottom) / width, bottom: (b.bottom - body.bottom) / width,
        })));
    };
    for (const candidate of compatible) {
        const ownReference = referenceFor(candidate.color);
        for (const stage of ["body", "complete"] as const) for (const showCover of [false, true]) {
            const layout = builderPreviewLayout(candidate, previewParts(candidate, stage), { stage, showCover, bodyReference: ownReference });
            if (layout) include(layout);
        }
    }
    include(selected);
    const frame = previewFrame({ axisX: 0, seatY: -bodyHeight, baselineY: 0 }, bounds, { expanded });
    const width = target.right - target.left, axis = (target.left + target.right) / 2;
    return { x: frame.x * width + axis, y: frame.y * width + target.bottom,
        width: frame.width * width, height: frame.height * width };
}
