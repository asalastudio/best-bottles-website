import "server-only";
import { readFileSync } from "node:fs";
import type { BuilderKit } from "../bottle-builder/model";

/** Shared local artwork review input for Builder and PDP. Never used on Vercel. */
export function readLocalComponentKits(): Record<string, BuilderKit> | null {
    const file = process.env.BUILDER_LOCAL_KITS;
    if (!file || process.env.VERCEL) return null;
    try {
        return JSON.parse(readFileSync(file, "utf8")).rows as Record<string, BuilderKit>;
    } catch { return null; }
}

/** PDP review is opt-in on localhost and limited to the current group's exact SKUs. */
export function localPdpComponentKits(host: string | null, flag: unknown,
    variants: Array<{ websiteSku?: string | null }>): Record<string, BuilderKit> {
    if (flag !== "kits" || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host ?? "")) return {};
    const rows = readLocalComponentKits();
    if (!rows) return {};
    return Object.fromEntries(variants.flatMap(({ websiteSku }) => {
        const kit = websiteSku ? rows[websiteSku] : null;
        return kit && kit.sku === websiteSku ? [[websiteSku!, kit]] : [];
    }));
}
