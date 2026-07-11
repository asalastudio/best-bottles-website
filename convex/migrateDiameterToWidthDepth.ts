import { internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * One-shot migration: parse the legacy `diameter` formatted string into
 * proper numeric `widthMm` / `depthMm` fields on every product row.
 *
 * Why: `diameter` was stored as a formatted string (e.g. "37 ±0.5 mm",
 * "42.6", "8 ± 0.1 mm") which forced every consumer to parse it. Madison
 * Studio's image-generation edge function bakes this string into AI prompts
 * as the bottle's face width — any format drift broke the prompt. The name
 * was also misleading: ~5 families (Empire, Square, Elegant, Flair,
 * Rectangle) have non-circular cross-sections and use this field for face
 * width, not diameter.
 *
 * Parser: regex captures the leading numeric portion, tolerant of varying
 * whitespace and unit suffixes:
 *   "37 ±0.5 mm" → 37        "42.6"        → 42.6
 *   "8 ± 0.1 mm" → 8         " 16.5mm"     → 16.5
 * Free-form strings without a leading number are reported in `parseFailures`
 * and left for manual cleanup.
 *
 * Cross-section assumption:
 *   - Rectangular families (Elegant, Flair, Rectangle): face width ≠ depth.
 *     `depthMm` left null and surfaced via `needsDepthSourcing` — Madison's
 *     prompt builder should fall back to widthMm for these until depth
 *     values are sourced from Grace specs or the live site.
 *   - All other families (circular Cylinder/Sleek/Slim/Circle, square
 *     Empire/Square): `depthMm = widthMm`.
 *
 * Idempotent: rows already carrying a widthMm field are counted under
 * `alreadyMigrated` and skipped, so re-runs are safe.
 *
 * Pagination: products has ~2,285 rows — too many for a single mutation
 * read (16MB limit), so this batches via paginate(). Pattern matches
 * backfillTrimColor.ts.
 *
 * Usage:
 *   Dry-run dev:  npx convex run migrateDiameterToWidthDepth:migrateDiameterToWidthDepth '{"dryRun":true}'
 *   Apply dev:    npx convex run migrateDiameterToWidthDepth:migrateDiameterToWidthDepth
 *   Apply prod:   CONVEX_DEPLOY_KEY=<prod-key> npx convex run migrateDiameterToWidthDepth:migrateDiameterToWidthDepth
 */

// Captures the leading numeric portion (with optional decimal). Any prefix
// whitespace is consumed; trailing tolerance / unit chars are ignored.
const DIAMETER_NUMERIC_RX = /^\s*(\d+(?:\.\d+)?)/;

export function parseDiameterMm(raw: string | null | undefined): number | null {
    if (raw == null) return null;
    const m = DIAMETER_NUMERIC_RX.exec(raw);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
}

// Families with rectangular cross-sections — depth ≠ width. Until per-family
// depth values are sourced (see plan step 4), depthMm is left null and the
// rows are reported in needsDepthSourcing so a follow-up pass can fill them.
const RECTANGULAR_FAMILIES = new Set<string>([
    "Elegant",
    "Flair",
    "Rectangle",
]);

type ParseFailure = {
    graceSku: string;
    family: string | null;
    diameter: string;
};

type NeedsDepthSourcing = {
    graceSku: string;
    family: string;
    capacityMl: number | null;
    widthMm: number;
};

type BatchResult = {
    isDone: boolean;
    nextCursor: string | null;
    scanned: number;
    migrated: number;
    alreadyMigrated: number;
    nullDiameter: number;
    parseFailed: number;
    rectangularNeedsDepth: number;
    parseFailures: Array<ParseFailure>;
    needsDepthSourcing: Array<NeedsDepthSourcing>;
};

export const migrateBatch = internalMutation({
    args: {
        cursor: v.union(v.string(), v.null()),
        dryRun: v.optional(v.boolean()),
    },
    handler: async (ctx, args): Promise<BatchResult> => {
        const dryRun = !!args.dryRun;
        const { page, continueCursor, isDone } = await ctx.db
            .query("products")
            .paginate({ cursor: args.cursor, numItems: 250 });

        let scanned = 0;
        let migrated = 0;
        let alreadyMigrated = 0;
        let nullDiameter = 0;
        let parseFailed = 0;
        let rectangularNeedsDepth = 0;
        const parseFailures: Array<ParseFailure> = [];
        const needsDepthSourcing: Array<NeedsDepthSourcing> = [];

        for (const p of page) {
            scanned++;
            const docRec = p as unknown as Record<string, unknown>;

            // Idempotency: any row that already has a widthMm key (number or
            // explicit null) was processed by a prior run.
            if (docRec.widthMm !== undefined) {
                alreadyMigrated++;
                continue;
            }

            if (p.diameter == null) {
                nullDiameter++;
                continue;
            }

            const widthMm = parseDiameterMm(p.diameter);
            if (widthMm == null) {
                parseFailed++;
                if (parseFailures.length < 50) {
                    parseFailures.push({
                        graceSku: p.graceSku,
                        family: p.family,
                        diameter: p.diameter,
                    });
                }
                continue;
            }

            const isRectangular = !!p.family && RECTANGULAR_FAMILIES.has(p.family);
            const depthMm: number | null = isRectangular ? null : widthMm;

            if (!dryRun) {
                await ctx.db.patch(p._id, {
                    widthMm,
                    depthMm,
                } as Record<string, unknown>);
            }

            migrated++;
            if (isRectangular && p.family) {
                rectangularNeedsDepth++;
                if (needsDepthSourcing.length < 50) {
                    needsDepthSourcing.push({
                        graceSku: p.graceSku,
                        family: p.family,
                        capacityMl: p.capacityMl,
                        widthMm,
                    });
                }
            }
        }

        return {
            isDone,
            nextCursor: continueCursor,
            scanned,
            migrated,
            alreadyMigrated,
            nullDiameter,
            parseFailed,
            rectangularNeedsDepth,
            parseFailures,
            needsDepthSourcing,
        };
    },
});

type FinalResult = {
    dryRun: boolean;
    totalScanned: number;
    totalMigrated: number;
    totalAlreadyMigrated: number;
    totalNullDiameter: number;
    totalParseFailed: number;
    totalRectangularNeedsDepth: number;
    parseFailures: Array<ParseFailure>;
    needsDepthSourcing: Array<NeedsDepthSourcing>;
};

export const migrateDiameterToWidthDepth = action({
    args: { dryRun: v.optional(v.boolean()) },
    handler: async (ctx, args): Promise<FinalResult> => {
        const dryRun = !!args.dryRun;
        let cursor: string | null = null;
        let totalScanned = 0;
        let totalMigrated = 0;
        let totalAlreadyMigrated = 0;
        let totalNullDiameter = 0;
        let totalParseFailed = 0;
        let totalRectangularNeedsDepth = 0;
        const parseFailures: Array<ParseFailure> = [];
        const needsDepthSourcing: Array<NeedsDepthSourcing> = [];

        do {
            const res: BatchResult = await ctx.runMutation(
                internal.migrateDiameterToWidthDepth.migrateBatch,
                { cursor, dryRun },
            );
            totalScanned += res.scanned;
            totalMigrated += res.migrated;
            totalAlreadyMigrated += res.alreadyMigrated;
            totalNullDiameter += res.nullDiameter;
            totalParseFailed += res.parseFailed;
            totalRectangularNeedsDepth += res.rectangularNeedsDepth;
            for (const f of res.parseFailures) {
                if (parseFailures.length < 100) parseFailures.push(f);
            }
            for (const n of res.needsDepthSourcing) {
                if (needsDepthSourcing.length < 100) needsDepthSourcing.push(n);
            }
            cursor = res.nextCursor;
            if (res.isDone) break;
        } while (cursor !== null);

        return {
            dryRun,
            totalScanned,
            totalMigrated,
            totalAlreadyMigrated,
            totalNullDiameter,
            totalParseFailed,
            totalRectangularNeedsDepth,
            parseFailures,
            needsDepthSourcing,
        };
    },
});
