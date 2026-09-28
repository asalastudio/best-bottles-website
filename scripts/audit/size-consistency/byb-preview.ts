/**
 * Size-consistency audit, Build Your Bottle side.
 *
 * For every body of every builder family, load the configurations and kits the
 * way /matrix does (loadBuilderFamily + loadBuilderBodyKits + attachBuilderKits),
 * then for each configuration compute the main preview exactly as MatrixClient
 * and BuilderImage do: the colour's reference body, builderPreviewLayout, and
 * builderBodyFrame across the body's configurations. Records the SVG viewBox
 * (the frame) and the body layer's placement, or the fallback photo when the
 * configuration has no kit. Stages: "body" once per glass colour (the Glass
 * step), "complete" once per configuration (a chosen SKU).
 *
 *   NEXT_PUBLIC_CONVEX_URL=https://precise-raccoon-123.convex.cloud \
 *   npx tsx --tsconfig scripts/audit/size-consistency/tsconfig.json scripts/audit/size-consistency/byb-preview.ts
 */
import fs from "node:fs";
import path from "node:path";
import { loadBuilderFamilies, loadBuilderFamily, loadBuilderBodyKits } from "@/lib/bottle-builder/server";
import { attachBuilderKits } from "@/lib/bottle-builder/payload";
import { builderBodyFrame, builderPreviewLayout } from "@/lib/bottle-builder/preview-layout";
import { previewFrame } from "@/lib/bottle-builder/preview-frame";
import { previewParts, type BuilderConfiguration } from "@/lib/bottle-builder/model";
import exposedSprayers from "@/lib/bottle-builder/exposed-sprayers.generated.json";

const OUT = path.resolve("output/size-audit");

function referenceFor(configs: readonly BuilderConfiguration[], color: string, fallback: BuilderConfiguration | undefined) {
    const colored = configs.filter((c) => c.color === color);
    return colored.find((c) => c.fitment === "Vintage Bulb Sprayer" && c.kit?.completeness === "full")
        ?? colored.find((c) => c.kit?.completeness === "full" && c.fitment !== "Reducer")
        ?? colored.find((c) => c.kit?.completeness === "full")
        ?? colored[0] ?? fallback;
}

function preview(config: BuilderConfiguration, all: readonly BuilderConfiguration[], stage: "body" | "complete") {
    const bodyReference = referenceFor(all, config.color, all[0]);
    const kit = stage === "body" ? config.previewKit ?? config.kit ?? config.chooserKit : config.kit;
    const parts = previewParts(config, stage);
    if (!kit) {
        const exposed = (exposedSprayers as Record<string, { url: string }>)[config.id];
        const fallbackUrl = stage === "complete" && config.photoUrl ? (exposed ? exposed.url : config.photoUrl) : config.bodyImage?.url ?? null;
        return { source: "photo", fallback: fallbackUrl, reference: bodyReference?.id ?? null };
    }
    const layout = builderPreviewLayout(config, parts, { stage, showCover: false, bodyReference });
    if (!layout || !parts.length) return { source: "none", reference: bodyReference?.id ?? null };
    const frame = all.length
        ? builderBodyFrame(config, all, bodyReference, layout, { expanded: false })
        : previewFrame(layout.anchors ?? kit.anchors, layout.layers.map((l) => l.bounds), {});
    const body = layout.layers.find((l) => l.part.slot === "body");
    return {
        source: (kit as { register?: unknown }).register ? "register" : "kit",
        reference: bodyReference?.id ?? null,
        referenceSameSource: bodyReference?.kit ? Boolean((bodyReference.kit as { register?: unknown }).register) === Boolean((kit as { register?: unknown }).register) : null,
        frame,
        body: body ? {
            url: body.part.image.url, imageWidth: body.part.image.width, imageHeight: body.part.image.height,
            box: body.part.box ?? null, partBounds: body.part.bounds, layerBounds: body.bounds, transform: body.transform ?? null,
        } : null,
    };
}

async function main() {
    const families = await loadBuilderFamilies();
    const rows: Record<string, unknown>[] = [];
    for (const { family } of families as Array<{ family: string }>) {
        const bodies = await loadBuilderFamily(family);
        for (const body of bodies) {
            let kits: Record<string, unknown> = {};
            try { kits = await loadBuilderBodyKits(family, body.id); } catch (error) { console.error(family, body.id, error); }
            const [attached] = attachBuilderKits([body], kits as never);
            const all = attached.configurations;
            const base = { family, bodyId: body.id, capacityMl: body.capacityMl, neck: body.neck };
            for (const color of [...new Set(all.map((c) => c.color))]) {
                const first = all.find((c) => c.color === color)!;
                rows.push({ ...base, stage: "body", color, sku: first.id, fitment: null, ...preview(first, all, "body") });
            }
            for (const config of all) {
                rows.push({ ...base, stage: "complete", color: config.color, sku: config.id, fitment: config.fitment, closure: config.closure, ...preview(config, all, "complete") });
            }
        }
        console.log(family, bodies.length, "bodies");
    }
    fs.writeFileSync(path.join(OUT, "byb-preview.json"), JSON.stringify(rows, null, 1));
    const counts: Record<string, number> = {};
    for (const row of rows) counts[`${row.stage}:${row.source}`] = (counts[`${row.stage}:${row.source}`] ?? 0) + 1;
    console.log(`byb-preview: ${rows.length} previews`, counts);
}

main().catch((error) => { console.error(error); process.exit(1); });
