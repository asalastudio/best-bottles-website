import "server-only";
import manifest from "./approved-kits.generated.json";
import type { BuilderKit } from "@/lib/bottle-builder/model";

/** Exact owner-approved recipes, independent of the localhost candidate loader. */
const rows = manifest.rows as unknown as Record<string, BuilderKit>;
export const APPROVED_KIT_VERSION = manifest.version;
export function approvedComponentKit(sku: string | null | undefined): BuilderKit | null {
    return sku && Object.hasOwn(rows, sku) ? rows[sku] : null;
}
export function approvedComponentKits(): Record<string, BuilderKit> { return rows; }
