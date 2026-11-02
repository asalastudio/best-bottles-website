"use client";

import { useEffect, useId, useState } from "react";
import type { BuilderKit } from "@/lib/bottle-builder/model";
import { stageLayout } from "@/lib/products/pdp-redesign/stage";
import { registerImageSrc } from "@/lib/products/register-image";
import { cylinderMasterSource } from "@/lib/products/cylinder-master";

const requests = new Map<string, Promise<BuilderKit>>();
function loadKit(sku: string): Promise<BuilderKit> {
    const source = cylinderMasterSource(sku);
    if (!source) return Promise.reject(Error("Unknown master"));
    const prior = requests.get(sku);
    if (prior) return prior;
    const request = fetch(`/api/bottle-masters/${source.family}?sku=${encodeURIComponent(sku)}&v=${source.version}`)
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
export default function CylinderMasterPreview({ sku, title, fallback }: {
    sku: string; title: string; fallback: React.ReactNode;
}) {
    const clipPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
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
    const layout = kit ? stageLayout(kit, "sidecar", { websiteSku: sku }) : null;
    if (kit && !layout) return fallback;
    if (!layout) return <span className="absolute inset-0" role="status" aria-label="Loading bottle image" />;
    const { canvas, frame } = layout;
    const viewport = {
        x: -frame.x / 100 * canvas.width / frame.scale,
        y: -frame.y / 100 * canvas.height / frame.scale,
        width: canvas.width / frame.scale,
        height: canvas.height / frame.scale,
    };
    return <svg className="absolute inset-0 h-full w-full" viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
        role="img" aria-label={title} data-bb-master-version={cylinderMasterSource(sku)?.version} data-bb-master-sku={sku}>
        {layout.parts.map((part, i) => {
            const x = ((part.box?.leftPct ?? 0) + part.dxPct) / 100 * canvas.width;
            const y = ((part.box?.topPct ?? 0) + part.dyPct) / 100 * canvas.height;
            const width = (part.box?.widthPct ?? 100) / 100 * canvas.width;
            const height = (part.box?.heightPct ?? 100) / 100 * canvas.height;
            const clipId = `${clipPrefix}-master-${i}`;
            const visibleHeight = height * (1 - (part.clipBottomPct ?? 0) / 100);
            return <g key={part.key}>
                {part.clipBottomPct !== undefined && <defs>
                    <clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect x={x} y={y} width={width} height={visibleHeight} /></clipPath>
                </defs>}
                <image href={registerImageSrc(part.url, 640)} data-bb-master-source={part.url} x={x} y={y}
                    width={width} height={height} opacity={part.opacity ?? 1} style={{ mixBlendMode: part.blendMode }}
                    clipPath={part.clipBottomPct !== undefined ? `url(#${clipId})` : undefined} data-bb-master-part={part.slot} />
            </g>;
        })}
    </svg>;
}
