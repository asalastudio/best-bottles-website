import 'server-only';
import { unstable_cache } from 'next/cache';
import { api } from '../../convex/_generated/api';
import { getCatalogConvexClient } from './catalogServer';
import heroes from './products/catalog-heroes.json';
import { buildHomeBrowseData } from './homepageBrowse';

// Keep full group records on the server; send only navigation cards to clients.
export const getHomepageBrowse = unstable_cache(async () => {
    const groups = await getCatalogConvexClient().query(api.products.getAllCatalogGroups, {});
    return buildHomeBrowseData(groups, heroes);
}, ['homepage-browse-v1'], { revalidate: 60 });
