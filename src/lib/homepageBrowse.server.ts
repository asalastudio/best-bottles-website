import 'server-only';
import { getCatalogVisibilitySnapshot } from './catalogServer';
import heroes from './products/catalog-heroes.json';
import { buildHomeBrowseData, type HomeBrowseGroup } from './homepageBrowse';

/**
 * Keep full group records on the server; send only navigation cards to clients.
 * Built from the catalog's shared visibility snapshot (30 s, catalogServer.ts) instead of a second
 * cached read of every product group, so the homepage and the catalog agree on which groups are
 * visible and share one Convex read.
 */
export async function getHomepageBrowse() {
    const { groups } = await getCatalogVisibilitySnapshot();
    // The snapshot holds the same `products.getAllCatalogGroups` documents this file read before; its
    // search type only widens `family` to nullable.
    return buildHomeBrowseData(groups as unknown as HomeBrowseGroup[], heroes);
}
