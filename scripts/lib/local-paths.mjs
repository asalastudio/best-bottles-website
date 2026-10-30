/**
 * Where this machine keeps the things the scripts need outside the repository.
 *
 * Every path used to be hard-coded under /Users/jordanrichter/Projects/Clients/…;
 * the client folder moved under …/Projects/Asala/Clients/… on 8 Oct 2026 and the
 * PSD masters became a symlink to the "Achive" external drive. Scripts read
 * these constants (overridable by environment) instead of a literal path.
 *
 *   BB_PSD_MASTER_ROOT      the Best Bottles PSD master library (BB-PSD-Files-Master)
 *   BB_REPO_ROOT            this repository's checkout (defaults to the one holding this file)
 *   BB_IMAGE_PIPELINE_GRID  the old bottle-image-pipeline grid output (Sanity upload scripts)
 */
import { existsSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = process.env.BB_REPO_ROOT
    ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const PSD_MASTER_ROOT = process.env.BB_PSD_MASTER_ROOT
    ?? "/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/BB-PSD-Files-Master";

export const IMAGE_PIPELINE_GRID_ROOT = process.env.BB_IMAGE_PIPELINE_GRID
    ?? "/Users/jordanrichter/Projects/Clients/Best Bottles/bottle-image-pipeline/output_collections/grid";

/** True when the PSD master library can actually be read (the symlink's drive is mounted). */
export function isPsdMasterMounted(root = PSD_MASTER_ROOT) {
    try {
        return existsSync(root) && statSync(realpathSync(root)).isDirectory();
    } catch {
        return false;
    }
}

/** The real directory behind the PSD master path, for reports. */
export function psdMasterTarget(root = PSD_MASTER_ROOT) {
    try { return realpathSync(root); } catch { return null; }
}
