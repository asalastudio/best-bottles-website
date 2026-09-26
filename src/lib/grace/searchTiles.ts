import { getCanonicalProductSlug } from "@/lib/products/legacy-product-route-overrides";

/**
 * Product tiles Grace drops into the chat after a search.
 *
 * Until 2026-09-26 the tiles a plain searchCatalog produced carried neither a
 * product link nor a photo: only showProducts set `verifiedPdpHref`, and only
 * the components tray set `heroImageUrl`. A tile with no link fell back to the
 * generic finder, so tapping "9 ml amber Cylinder" opened /catalog?grace=1,
 * and every tile showed the family's initial instead of the bottle.
 *
 * Photos follow the catalogue card's own recipe (Jordan, 2026-09-26: "actual
 * photos … the brand-new Sunburst photos, if we have them on deck"):
 *   1. the group's released Sunburst hero, chosen among the rows the search
 *      returned (`getCatalogHero`), shown on the tile of exactly that SKU;
 *   2. otherwise that SKU's own cap-on plate from the plate index;
 *   3. otherwise nothing (the card draws its family placeholder).
 * A photo never belongs to another finish: the link and the photo name the
 * same variant.
 */

export type GraceSearchTileSource = {
    slug?: string | null;
    websiteSku?: string | null;
    graceSku?: string | null;
};

export type GraceTileImageKind = "sunburst" | "plate";

export type GraceSearchTile<Row extends GraceSearchTileSource> = Row & {
    verifiedPdpHref: string | null;
    heroImageUrl: string | null;
    heroImageKind: GraceTileImageKind | null;
};

export type GraceTileImageSources<Row extends GraceSearchTileSource> = {
    /** The group's released Sunburst hero among these rows: the catalogue card recipe. */
    heroForGroup: (slug: string, rows: readonly Row[]) => { websiteSku: string; url: string } | null;
    /** A photo of exactly this SKU (its cap-on plate thumb) for rows that are not their group's hero. */
    plateForSku?: (websiteSku: string | null | undefined) => string | null;
};

/** `/products/{canonical slug}?sku={own SKU}` from a verified row, or null when the row cannot name its page. */
export function graceVerifiedProductHref(row: GraceSearchTileSource): string | null {
    const slug = row.slug?.trim();
    const sku = row.websiteSku?.trim() || row.graceSku?.trim();
    if (!slug || !sku) return null;
    return `/products/${getCanonicalProductSlug(slug)}?${new URLSearchParams({ sku }).toString()}`;
}

export const GRACE_SEARCH_TILE_CANDIDATES = 12;

function groupRows<Row extends GraceSearchTileSource>(rows: readonly Row[]): Map<string, Row[]> {
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
        const slug = row.slug?.trim();
        if (!slug) continue;
        groups.set(slug, [...(groups.get(slug) ?? []), row]);
    }
    return groups;
}

/** Every row with its own product link and photo, in place (no grouping): for returnRaw callers such as showProducts. */
export function annotateGraceSearchRows<Row extends GraceSearchTileSource>(
    rows: readonly Row[],
    sources: GraceTileImageSources<Row>,
): GraceSearchTile<Row>[] {
    const heroes = new Map<string, { websiteSku: string; url: string } | null>();
    for (const [slug, members] of groupRows(rows)) heroes.set(slug, sources.heroForGroup(slug, members));
    return rows.map((row) => {
        const hero = row.slug?.trim() ? heroes.get(row.slug.trim()) ?? null : null;
        const ownHero = hero && row.websiteSku && hero.websiteSku === row.websiteSku ? hero.url : null;
        const plate = ownHero ? null : sources.plateForSku?.(row.websiteSku) ?? null;
        return {
            ...row,
            verifiedPdpHref: graceVerifiedProductHref(row),
            heroImageUrl: ownHero ?? plate,
            heroImageKind: ownHero ? "sunburst" : plate ? "plate" : null,
        };
    });
}

function imageRank(row: { heroImageUrl?: string | null; heroImageKind?: GraceTileImageKind | null }): number {
    if (row.heroImageKind === "sunburst") return 2;
    return row.heroImageUrl ? 1 : 0;
}

/**
 * One row per group, in first-seen order: the group's Sunburst hero row when
 * the search returned it, else a row with its own plate, else the first row.
 */
export function preferHeroRepresentative<Row extends { slug?: string | null; graceSku?: string | null; itemName?: string | null; heroImageUrl?: string | null; heroImageKind?: GraceTileImageKind | null }>(
    rows: readonly Row[],
): Row[] {
    const order: string[] = [];
    const byKey = new Map<string, Row>();
    rows.forEach((row, index) => {
        const key = row.slug || row.graceSku || row.itemName || `row:${index}`;
        const current = byKey.get(key);
        if (!current) {
            order.push(key);
            byKey.set(key, row);
        } else if (imageRank(row) > imageRank(current)) {
            byKey.set(key, row);
        }
    });
    return order.map((key) => byKey.get(key)!);
}

/** One tile per product group, in search order, up to `limit`, each linking to the exact variant it pictures. */
export function buildGraceSearchTiles<Row extends GraceSearchTileSource>(
    rows: readonly Row[],
    sources: GraceTileImageSources<Row>,
    limit = GRACE_SEARCH_TILE_CANDIDATES,
): GraceSearchTile<Row>[] {
    return preferHeroRepresentative(annotateGraceSearchRows(rows, sources)).slice(0, Math.max(0, limit));
}
