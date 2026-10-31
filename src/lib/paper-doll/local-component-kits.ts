import "server-only";
import { readFileSync } from "node:fs";
import type { BuilderKit } from "../bottle-builder/model";

type LocalKitReview = {
    rows: Record<string, BuilderKit>;
    /** Exact SKUs the operator wants to review through normal localhost navigation. */
    defaultPdpSkus?: string[];
};

function readLocalKitReview(): LocalKitReview | null {
    if (process.env.VERCEL) return null;
    const files = [process.env.BUILDER_LOCAL_KITS,
        process.env.NODE_ENV === "development" ? "public/local-kits/small-sprayers-2026-10-31/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/cylinder5-profiles-2026-10-31/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/elegant60-reducer-2026-10-31/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/vial-4ml-measured-2026-10-31/kits.json" : undefined,
        process.env.NODE_ENV === "development" ? "public/local-kits/catalog-followups-2026-10-31/kits.json" : undefined];
    const rows: Record<string, BuilderKit> = {};
    const defaults = new Set<string>();
    let loaded = false;
    for (const file of files) {
        if (!file) continue;
        try {
            const next = JSON.parse(readFileSync(file, "utf8")) as LocalKitReview;
            Object.assign(rows, next.rows);
            for (const sku of next.defaultPdpSkus ?? []) defaults.add(sku);
            loaded = true;
        } catch { /* A review file may not be staged in this checkout. */ }
    }
    return loaded ? { rows, defaultPdpSkus: [...defaults] } : null;
}

/** Shared local artwork review input for Builder and PDP. Never used on Vercel. */
export function readLocalComponentKits(): Record<string, BuilderKit> | null {
    return readLocalKitReview()?.rows ?? null;
}

/** Localhost only: explicit preview, or exact SKUs enabled in the local review file. */
export function localPdpComponentKits(host: string | null, flag: unknown,
    variants: Array<{ websiteSku?: string | null }>): Record<string, BuilderKit> {
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host ?? "")) return {};
    const review = readLocalKitReview();
    if (!review?.rows) return {};
    const defaults = new Set(review.defaultPdpSkus ?? []);
    return Object.fromEntries(variants.flatMap(({ websiteSku }) => {
        if (!websiteSku || (flag !== "kits" && !defaults.has(websiteSku))) return [];
        const kit = review.rows[websiteSku];
        return kit && kit.sku === websiteSku ? [[websiteSku, kit]] : [];
    }));
}
