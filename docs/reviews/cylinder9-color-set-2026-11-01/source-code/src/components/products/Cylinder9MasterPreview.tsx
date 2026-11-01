"use client";

import { useEffect, useState } from "react";
import type { BuilderKit } from "@/lib/bottle-builder/model";
import { detachedCapOffset, offBottle, REMOVABLE_KIT_SLOTS } from "@/lib/products/kit-frame";
import { pdpReviewedGlassViewport } from "@/lib/products/pdp-stage-frame";
import { CYLINDER9_MASTER_VERSION } from "@/lib/products/cylinder9-master";

const requests = new Map<string, Promise<BuilderKit>>();
function loadKit(sku: string): Promise<BuilderKit> {
    const prior = requests.get(sku);
    if (prior) return prior;
    const request = fetch(`/api/bottle-masters/cylinder9?sku=${encodeURIComponent(sku)}&v=${CYLINDER9_MASTER_VERSION}`)
        .then(async response => {
            if (!response.ok) throw Error("Master unavailable");
            const { kit } = await response.json() as { kit: BuilderKit };
            if (kit?.sku !== sku || !Array.isArray(kit.parts)) throw Error("Invalid master");
            return kit;
        });
    requests.set(sku, request);
    request.catch(() => { if (requests.get(sku) === request) requests.delete(sku); });
    return request;
}

/** Catalog uses the same registered files and sizing datum as PDP and Builder. */
export default function Cylinder9MasterPreview({ sku, title, fallback }: {
    sku: string; title: string; fallback: React.ReactNode;
}) {
    const [result, setResult] = useState<{ sku: string; kit?: BuilderKit; failed?: boolean } | null>(null);
    useEffect(() => {
        let active = true;
        loadKit(sku).then(kit => { if (active) setResult({ sku, kit }); },
            () => { if (active) setResult({ sku, failed: true }); });
        return () => { active = false; };
    }, [sku]);
    const current = result?.sku === sku ? result : null;
    if (current?.failed) return fallback;
    const kit = current?.kit;
    const body = kit?.parts.find(part => part.slot === "body");
    const frame = kit && body && kit.glassSizing
        ? pdpReviewedGlassViewport(body.bounds, kit.anchors.axisX, kit.glassSizing, 1000, 1100) : null;
    if (!kit || !body || !frame) return <span className="absolute inset-0" role="status" aria-label="Loading bottle image" />;
    return <svg className="absolute inset-0 h-full w-full" viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
        role="img" aria-label={title} data-bb-master-version={CYLINDER9_MASTER_VERSION} data-bb-master-sku={sku}>
        {kit.parts.filter(part => !part.views || part.views.includes("sidecar")).sort((a, b) => a.zOrder - b.zOrder).map((part, i) => {
            const removable = REMOVABLE_KIT_SLOTS.has(part.slot);
            const drawn = removable ? offBottle(part) : part;
            const offset = removable ? detachedCapOffset(drawn, body.bounds) : { dx: 0, dy: 0 };
            const box = drawn.box ?? { x: 0, y: 0, width: kit.canvas.width, height: kit.canvas.height };
            return <image key={`${part.slot}-${i}`} href={drawn.image.url} x={box.x + offset.dx} y={box.y + offset.dy}
                width={box.width} height={box.height} opacity={part.opacity ?? 1} data-bb-master-part={part.slot} />;
        })}
    </svg>;
}
