"use client";

/**
 * The plate-and-kit stack the live PDP paints: a flat precomposed plate first,
 * replaced by the kit's alpha layers (body + fitment + closure) once every part
 * has decoded. Every part was written on the plate's own canvas, so the stack
 * needs no positioning — the parts line up by construction, which is what keeps
 * the bottle still when one layer changes.
 *
 * Shared by the mobile hero; the desktop configurator stage keeps its own
 * inline copy of the same contract (exploded transforms, 3D) untouched.
 */
import { useEffect, useMemo, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import { decodeImage } from "@/lib/paper-doll/decode-image";
import { resolveSelectedSkuKit } from "@/lib/products/pdp-selected-kit";

export type KitQueryResult = FunctionReturnType<typeof api.productKits.forSku> | undefined;
export type KitView = NonNullable<FunctionReturnType<typeof api.productKits.forSku>>;
export type KitPart = KitView["parts"][number];

/** Slots that leave the stack when the customer lifts the cap. */
export const REMOVABLE_KIT_SLOTS: ReadonlySet<string> = new Set(["cap", "overcap"]);

export function kitHasRemovableCap(kit: KitView | null | undefined): boolean {
    return Boolean(kit?.parts?.some((part) => REMOVABLE_KIT_SLOTS.has(part.slot)));
}

/**
 * The decoded parts that are safe to paint for the selected SKU, or null while
 * the query is pending, the SKU was never kitted, or a part failed to decode.
 * A pending next-SKU query never inherits a prior kit.
 */
export function useDecodedKitParts(
    selected: { websiteSku?: string | null; graceSku?: string | null },
    kitQuery: KitQueryResult,
    withCap: boolean,
): { kit: KitView | null; parts: KitPart[] | null } {
    const kit: KitView | null = resolveSelectedSkuKit(selected, kitQuery) ?? null;
    const targetParts = useMemo(() => {
        if (!kit?.parts?.length) return null;
        const sorted = [...kit.parts].sort((a, b) => a.zOrder - b.zOrder);
        return withCap ? sorted : sorted.filter((part) => !REMOVABLE_KIT_SLOTS.has(part.slot));
    }, [kit, withCap]);
    // Decoded sets are keyed by the exact target array, so a pending query, a
    // different SKU, or a cap toggle derives to "not ready" without a reset.
    const [decoded, setDecoded] = useState<{ sku: string; parts: KitPart[] } | null>(null);

    useEffect(() => {
        if (kitQuery === undefined || !kit?.sku || !targetParts?.length) return;
        let cancelled = false;
        Promise.all(targetParts.map((part) => decodeImage(part.image.url)))
            .then(() => { if (!cancelled) setDecoded({ sku: kit.sku, parts: targetParts }); })
            .catch(() => { /* fall back to the plate */ });
        return () => { cancelled = true; };
    }, [kit, kitQuery, targetParts]);

    const ready = Boolean(kit?.sku && targetParts && decoded?.sku === kit.sku && decoded.parts === targetParts);
    return { kit, parts: ready ? targetParts : null };
}

/**
 * The plate that is actually safe to paint: the previous one stays up until the
 * requested one has decoded, so a preview swap never flashes white and never
 * shifts the bottle. A URL that fails to load is reported and skipped.
 */
export function useDecodedPlate(
    wanted: string | null,
    onError?: (url: string) => void,
): { url: string | null; pending: boolean } {
    const [decoded, setDecoded] = useState<string | null>(null);
    useEffect(() => {
        if (!wanted) return;
        let cancelled = false;
        decodeImage(wanted)
            .then(() => { if (!cancelled) setDecoded(wanted); })
            .catch(() => { if (!cancelled) onError?.(wanted); });
        return () => { cancelled = true; };
        // onError is a reporting callback, not an input that should re-decode
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wanted]);
    return { url: wanted ? decoded : null, pending: Boolean(wanted) && decoded !== wanted };
}

type PaperDollLayersProps = {
    /** The precomposed plate for this configuration and cap state. */
    plateUrl: string | null;
    /** Decoded kit layers; when present the plate is dropped and the stack paints. */
    kitParts: KitPart[] | null;
    alt: string;
    onPlateError?: (url: string) => void;
    className?: string;
};

export default function PaperDollLayers({ plateUrl, kitParts, alt, onPlateError, className }: PaperDollLayersProps) {
    const stacked = Boolean(kitParts?.length);
    return (
        <div className={`relative h-full w-full bg-white ${className ?? ""}`} data-paper-doll={stacked ? "kit" : "plate"}>
            {!stacked && plateUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    key={plateUrl}
                    src={plateUrl}
                    alt={alt}
                    width={1000}
                    height={1100}
                    decoding="async"
                    onError={() => onPlateError?.(plateUrl)}
                    className="absolute inset-0 h-full w-full object-contain"
                />
            ) : null}
            {kitParts?.map((part) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    key={part.slot}
                    src={part.image.url}
                    alt={part.slot === "body" ? alt : `${part.slot} — ${part.variantKey ?? ""}`}
                    width={part.image.width}
                    height={part.image.height}
                    decoding="async"
                    style={{ zIndex: part.zOrder }}
                    className="absolute inset-0 h-full w-full object-contain"
                />
            ))}
        </div>
    );
}
