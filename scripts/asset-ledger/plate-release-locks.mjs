import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * A plate release lock is the immutable, exact-byte record of Jordan's visual
 * approval for one family's prepared plates.
 *
 * It is NOT publication. The lock states `publicationAuthorized` and
 * `indexingAuthorized` on its face, and reading it here only moves those rows
 * from "ready for review" to "approved, awaiting release". A row becomes
 * complete solely through the normal completion path, once its named release
 * has actually been published and its hosted bytes verified.
 *
 * Reading the lock is what stops the ledger asking Jordan to re-review images
 * he has already signed off. It never counts an unpublished candidate as an
 * indexed plate.
 */
export function readPlateReleaseLocks(root) {
    const dir = path.join(root, "docs/reviews");
    if (!existsSync(dir)) return [];
    const locks = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const file = path.join(dir, entry.name, "approved-lock.json");
        if (!existsSync(file)) continue;
        let lock;
        try {
            lock = JSON.parse(readFileSync(file, "utf8"));
        } catch {
            locks.push({ path: path.relative(root, file), release: entry.name, skipped: "lock file is not readable JSON" });
            continue;
        }
        // Hero locks are a plain `sku -> {sha256}` map. A plate lock names its
        // release and carries a row array. Anything else is left alone.
        if (!lock || typeof lock !== "object" || Array.isArray(lock)) continue;
        if (typeof lock.release !== "string" || !Array.isArray(lock.rows)) continue;
        const rel = path.relative(root, file);
        if (lock.visualApproved !== true) {
            locks.push({ path: rel, release: lock.release, skipped: "lock records no visual approval" });
            continue;
        }
        const mismatch = evidenceMismatch(root, lock);
        if (mismatch) {
            locks.push({ path: rel, release: lock.release, skipped: mismatch });
            continue;
        }
        const skus = [...new Set(lock.rows.map((r) => r.sku ?? r.websiteSku).filter(Boolean))];
        if (skus.length !== lock.rows.length) {
            locks.push({ path: rel, release: lock.release, skipped: "rows carry duplicate or missing SKU identity" });
            continue;
        }
        locks.push({
            path: rel,
            release: lock.release,
            approvedAt: lock.approvedAt ?? null,
            actor: lock.actor ?? null,
            rows: skus.length,
            skus,
            held: (lock.heldRows ?? []).map((h) => ({ sku: h.sku ?? h.websiteSku ?? null, reason: h.reason ?? null })),
            publicationAuthorized: lock.publicationAuthorized === true,
            indexingAuthorized: lock.indexingAuthorized === true,
        });
    }
    return locks.sort((a, b) => a.release.localeCompare(b.release));
}

/** The approval evidence must still hash to exactly what was approved. */
function evidenceMismatch(root, lock) {
    const checks = [
        [lock.approvalFile, lock.approvalFileSha256, "approval record"],
        [lock.preparedManifest?.file, lock.preparedManifest?.sha256, "prepared manifest"],
    ];
    for (const [file, expected, label] of checks) {
        if (!file || !expected) continue;
        const abs = path.isAbsolute(file) ? file : path.join(root, file);
        if (!existsSync(abs)) return `${label} is missing: ${file}`;
        if (sha256(readFileSync(abs)) !== expected) return `${label} no longer matches its approved hash: ${file}`;
    }
    return null;
}

/** sku -> release name, for every lock whose evidence still checks out. */
export function lockApprovedSkus(locks) {
    const approved = new Map();
    for (const lock of locks ?? []) {
        if (lock.skipped) continue;
        for (const sku of lock.skus ?? []) if (!approved.has(sku)) approved.set(sku, lock.release);
    }
    return approved;
}
