/**
 * Size-consistency audit, product page side.
 *
 * For every live SKU, resolve what the redesigned product page draws on its
 * stage, the same way the page does (src/app/products/[slug]/page.tsx and
 * PdpRedesignPage): the register kit first, then the published kit, else the
 * fallback media in pdpFallbackMedia's order. For a layered SKU, run the page's
 * own stageLayout ("sidecar", the default view) and record the frame and the
 * body layer's placement. For a fallback, record the image the stage shows.
 *
 * Read-only: public production queries plus the snapshot files written by
 * `npx convex data <table> --prod` into output/size-audit/.
 *
 *   AUDIT_CONVEX_URL=https://precise-raccoon-123.convex.cloud \
 *   npx tsx --tsconfig scripts/audit/size-consistency/tsconfig.json scripts/audit/size-consistency/pdp-stage.ts
 */
import fs from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { loadRegisterKits } from "@/lib/register/load";
import { stageLayout, type KitLike } from "@/lib/products/pdp-redesign/stage";
import { pdpFallbackMedia } from "@/lib/products/pdp-redesign/fallback-media";

const OUT = path.resolve("output/size-audit");
const URL = process.env.AUDIT_CONVEX_URL;
if (!URL) throw new Error("Set AUDIT_CONVEX_URL (production: https://precise-raccoon-123.convex.cloud)");

type Row = Record<string, unknown>;
const readJsonl = (file: string): Row[] => fs.readFileSync(path.join(OUT, file), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));

type Product = {
    websiteSku: string; graceSku: string; family: string | null; capacityMl: number | null; color: string | null;
    neckThreadSize: string | null; applicator: string | null; productGroupId: string | null; category: string | null;
    shopifySellable?: boolean; stockStatus?: string | null; imageUrl?: string | null; capColor?: string | null;
    heightWithoutCap?: string | null; diameter?: string | null; itemName?: string | null;
};
type Group = { _id: string; slug: string; family: string; capacityMl?: number | null; color?: string | null; displayName?: string };

const products = (readJsonl("products-prod.jsonl") as unknown as Product[])
    .filter((p) => p.websiteSku && !p.websiteSku.includes("__RETIRED__"));
const groups = new Map((readJsonl("productGroups-prod.jsonl") as unknown as Group[]).map((g) => [g._id, g]));

function kitFor(kits: Record<string, KitLike | null>, variant: { websiteSku?: string | null; graceSku?: string | null }): KitLike | null {
    return (variant.websiteSku ? kits[variant.websiteSku] : null) ?? (variant.graceSku ? kits[variant.graceSku] : null) ?? null;
}

async function main() {
    const convex = new ConvexHttpClient(URL!);

    // 1. Register kits, exactly as the page asks for them (Grace SKUs, 50 per call inside the loader).
    const registerKits = await loadRegisterKits(convex, products.map((p) => p.graceSku));
    const kitsBySku: Record<string, KitLike | null> = {};
    const pending: Array<{ websiteSku: string | null; graceSku: string | null }> = [];
    for (const p of products) {
        const kit = (registerKits[p.graceSku] ?? registerKits[p.websiteSku] ?? null) as KitLike | null;
        if (!kit) { pending.push({ websiteSku: p.websiteSku, graceSku: p.graceSku }); continue; }
        kitsBySku[p.websiteSku] = kit;
        kitsBySku[p.graceSku] = kit;
    }

    // 2. Published kits for the rest, 50 pairs per call, keyed back to both SKUs.
    for (let i = 0; i < pending.length; i += 50) {
        const chunk = await convex.query(api.productKits.forSkus, { pairs: pending.slice(i, i + 50) });
        for (const [key, kit] of Object.entries(chunk)) {
            kitsBySku[key] = kit as KitLike | null;
            if (kit) {
                const owner = pending.find((pair) => pair.websiteSku === key || pair.graceSku === key);
                if (owner?.websiteSku) kitsBySku[owner.websiteSku] = kit as KitLike;
                if (owner?.graceSku) kitsBySku[owner.graceSku] = kit as KitLike;
            }
        }
    }

    // 3. Plates, as loadPlatesForVariants reads them.
    const plates: Record<string, { image: string; imageCapOff: string | null }> = {};
    const skus = [...new Set(products.flatMap((p) => [p.graceSku, p.websiteSku]).filter(Boolean))];
    for (let i = 0; i < skus.length; i += 100) {
        const result = await convex.query(api.productPlates.forSkus, { skus: skus.slice(i, i + 100) });
        Object.assign(plates, result.plates);
    }

    // 4. Per SKU: what the stage draws.
    const rows = products.map((p) => {
        const group = p.productGroupId ? groups.get(p.productGroupId) : undefined;
        const kit = kitFor(kitsBySku, p);
        const context = {
            family: group?.family ?? p.family, capacityMl: group?.capacityMl ?? p.capacityMl ?? null, color: group?.color ?? p.color ?? null,
            applicator: p.applicator ?? null, websiteSku: p.websiteSku ?? null,
        };
        const base = {
            websiteSku: p.websiteSku, graceSku: p.graceSku, slug: group?.slug ?? null, family: p.family, capacityMl: p.capacityMl,
            color: p.color, neck: p.neckThreadSize, applicator: p.applicator, category: p.category, capColor: p.capColor ?? null,
            itemName: p.itemName ?? null, heightWithoutCap: p.heightWithoutCap ?? null, diameter: p.diameter ?? null,
            sellable: p.shopifySellable !== false,
        };
        const layout = stageLayout(kit, "sidecar", context);
        if (kit && layout) {
            const body = kit.parts.find((part) => part.slot === "body");
            const placed = layout.parts.find((part) => part.slot === "body");
            const register = (kit as KitLike & { register?: { bodyId: string; glass: string; pxPerMm: number } }).register ?? null;
            return {
                ...base,
                source: register ? "register" : "kit",
                registerBody: register?.bodyId ?? null,
                registerPxPerMm: register?.pxPerMm ?? null,
                canvas: layout.canvas,
                frame: layout.frame,
                body: body ? {
                    url: body.image.url, imageWidth: body.image.width, imageHeight: body.image.height,
                    box: body.box ?? null, bounds: body.bounds, dxPct: placed?.dxPct ?? 0, dyPct: placed?.dyPct ?? 0,
                } : null,
                parts: layout.parts.map((part) => part.slot),
            };
        }
        const plate = plates[p.graceSku] ?? plates[p.websiteSku];
        const media = pdpFallbackMedia({
            groupSlug: group?.slug ?? "",
            variant: { ...p, neckThreadSize: p.neckThreadSize },
            plateImageUrl: plate?.image ?? null,
        });
        return {
            ...base,
            source: media.images.length ? "photo" : media.bodyImageUrl ? "body" : "none",
            fallback: media.images[0] ?? media.bodyImageUrl ?? null,
            fallbackAll: media.images,
            fallbackBody: media.bodyImageUrl,
        };
    });

    fs.writeFileSync(path.join(OUT, "pdp-stage.json"), JSON.stringify(rows, null, 1));
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.source] = (counts[row.source] ?? 0) + 1;
    console.log(`pdp-stage: ${rows.length} SKUs`, counts);
}

main().catch((error) => { console.error(error); process.exit(1); });
