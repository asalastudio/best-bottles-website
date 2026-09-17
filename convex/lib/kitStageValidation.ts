/**
 * Shared rules for whether a stored kit can drive the PDP stage (exploded view,
 * cap-off layering). Kept in convex/ so integrity and forSku stay aligned with
 * the client gate in pdp-selected-kit.ts.
 */

export type KitIdentity = {
    sku: string;
    websiteSku?: string | null;
    graceSku?: string | null;
};

export type KitPartLike = {
    slot: string;
    bounds: { left: number; top: number; right: number; bottom: number };
    assembled: { x: number; y: number };
    image: { url: string; width: number; height: number };
    derivation?: string;
};

export type KitStageRowLike = KitIdentity & {
    plateSha256: string;
    canvas: { width: number; height: number };
    anchors: { seatY: number; baselineY: number };
    completeness: "full" | "capSplit" | "bodyOnly";
    parts: KitPartLike[];
};

const CLOSURE_SLOTS = new Set(["cap", "overcap"]);

/** True when the kit row belongs to the SKU the customer selected on the PDP. */
export function kitMatchesSelectedSku(
    kit: KitIdentity | null | undefined,
    selected: { websiteSku?: string | null; graceSku?: string | null },
): boolean {
    if (!kit?.sku?.trim()) return false;
    const kitIds = new Set(
        [kit.sku, kit.websiteSku, kit.graceSku]
            .filter((value): value is string => Boolean(value?.trim()))
            .map((value) => value.trim()),
    );
    const selectedKeys = [selected.websiteSku, selected.graceSku].filter((value): value is string => Boolean(value?.trim()));
    if (selectedKeys.length === 0) return false;
    return selectedKeys.some((key) => kitIds.has(key.trim()));
}

/** Structural checks the configurator stage requires before painting kit layers. */
export function kitStageStructureIssues(kit: KitStageRowLike): Array<{ issue: string; detail: string }> {
    const issues: Array<{ issue: string; detail: string }> = [];
    const { canvas, anchors, parts, completeness } = kit;

    if (!(canvas.width > 0 && canvas.height > 0)) {
        issues.push({ issue: "kit_invalid_canvas", detail: `${canvas.width}x${canvas.height}` });
    }
    if (!(anchors.baselineY > anchors.seatY && anchors.seatY >= 0 && anchors.baselineY <= canvas.height)) {
        issues.push({ issue: "kit_invalid_anchors", detail: `seatY=${anchors.seatY} baselineY=${anchors.baselineY}` });
    }
    if (!parts.some((part) => part.slot === "body")) {
        issues.push({ issue: "kit_without_body", detail: "" });
    }

    for (const part of parts) {
        if (part.image.width !== canvas.width || part.image.height !== canvas.height) {
            issues.push({ issue: "kit_part_canvas_mismatch", detail: `${part.slot} ${part.image.width}x${part.image.height}` });
            break;
        }
        if (!part.image.url.startsWith("https://")) {
            issues.push({ issue: "kit_part_url_not_https", detail: part.slot });
            break;
        }
        if (part.assembled.x !== 0 || part.assembled.y !== 0) {
            issues.push({ issue: "kit_part_not_registered", detail: `${part.slot} assembled=${part.assembled.x},${part.assembled.y}` });
            break;
        }
        if (!(part.bounds.right > part.bounds.left && part.bounds.bottom > part.bounds.top)) {
            issues.push({ issue: "kit_part_empty_bounds", detail: part.slot });
            break;
        }
        if (part.slot === "body" && part.derivation && part.derivation !== "psd-layer" && part.derivation !== "madison") {
            issues.push({ issue: "kit_body_derivation_unsupported", detail: part.derivation });
        }
    }

    if (completeness === "full") {
        const nonBody = parts.filter((part) => part.slot !== "body");
        const hasMechanism = nonBody.some((part) => !CLOSURE_SLOTS.has(part.slot));
        const hasClosure = nonBody.some((part) => CLOSURE_SLOTS.has(part.slot));
        if (nonBody.length === 0 || (!hasMechanism && !hasClosure)) {
            issues.push({ issue: "kit_full_missing_parts", detail: `${nonBody.length} non-body parts` });
        }
    }

    if (completeness === "capSplit") {
        if (!parts.some((part) => CLOSURE_SLOTS.has(part.slot))) {
            issues.push({ issue: "kit_capsplit_without_closure", detail: "" });
        }
    }

    return issues;
}
