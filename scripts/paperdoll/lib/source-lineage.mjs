import { existsSync, realpathSync } from "node:fs";
import { basename, extname, isAbsolute, relative, resolve, sep } from "node:path";

export const PSD_MASTER_ROOT = "/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master";

function isInside(root, candidate) {
    const rel = relative(root, candidate);
    return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

function skuKey(value) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sourceSku(sourcePath) {
    const file = basename(sourcePath, extname(sourcePath));
    return file.replace(/^\s*\d+[.-]?\s*/, "").replace(/\.+$/, "").trim();
}

export function validatePlateSource(row, { masterRoot = PSD_MASTER_ROOT } = {}) {
    const issues = [];
    const sourcePath = row.sourcePath?.trim();
    const displayName = sourcePath ? basename(sourcePath) : "(missing)";

    if (!sourcePath) {
        return [{ issue: "source_path_missing", detail: "front plate has no PSD source path" }];
    }

    const lexicalRoot = resolve(masterRoot);
    if (!existsSync(lexicalRoot)) {
        return [{ issue: "master_root_missing", detail: "configured PSD master root does not exist" }];
    }

    const candidate = isAbsolute(sourcePath) ? resolve(sourcePath) : resolve(lexicalRoot, sourcePath);
    if (!isInside(lexicalRoot, candidate)) {
        return [{ issue: "source_outside_master", detail: `${displayName} is outside the PSD master root` }];
    }

    if (!existsSync(candidate)) {
        issues.push({ issue: "source_missing_from_master", detail: `${displayName} does not exist in the PSD master root` });
    } else {
        const physicalRoot = realpathSync(lexicalRoot);
        const physicalCandidate = realpathSync(candidate);
        if (!isInside(physicalRoot, physicalCandidate)) {
            return [{ issue: "source_outside_master", detail: `${displayName} resolves outside the PSD master root` }];
        }
    }

    let folderState = null;
    for (const segment of sourcePath.split(/[/\\]/).slice(0, -1).reverse()) {
        const capped = /\bcapped\b/i.test(segment);
        const uncapped = /\buncapped\b/i.test(segment);
        if (capped !== uncapped) {
            folderState = uncapped ? "off" : "on";
            break;
        }
        if (capped) folderState = "ambiguous";
    }
    if (folderState === "off" || folderState === "ambiguous") {
        issues.push({ issue: "front_source_uncapped", detail: `${displayName} is filed in an uncapped folder` });
    }

    const basenameSku = sourceSku(sourcePath);
    if (skuKey(basenameSku) !== skuKey(row.sku)) {
        issues.push({ issue: "front_source_sku_mismatch", detail: `${basenameSku} does not match ${row.sku}` });
    }

    return issues;
}
