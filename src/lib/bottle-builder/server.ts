import "server-only";
import { unstable_cache } from "next/cache";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { configurationFromRow, groupBuilderBodies, isBuilderCandidate, type CatalogRow } from "./model";

const client = () => new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Existing read-only APIs keep this frontend branch independent of a backend
// deployment. Bounded requests and a short cache avoid reloading every kit on navigation.
const cachedKit = unstable_cache(async (websiteSku: string, graceSku: string) =>
    client().query(api.productKits.forSku, { websiteSku, graceSku }), ["bottle-builder-kit-v1"], { revalidate: 300 });

export async function loadBuilderBodies(rows: CatalogRow[]) {
    const candidates = rows.filter(isBuilderCandidate);
    const configurations = new Array<ReturnType<typeof configurationFromRow>>(candidates.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(24, candidates.length) }, async () => {
        while (cursor < candidates.length) {
            const index = cursor++;
            const row = candidates[index];
            const kit = await cachedKit(row.websiteSku!, row.graceSku!);
            configurations[index] = configurationFromRow(row, kit);
        }
    }));
    return groupBuilderBodies(configurations.filter(config => config !== null));
}

export async function freshConfiguration(family: string, sku: string) {
    const convex = client();
    const data = await convex.query(api.matrix.getFamilyRows, { family });
    const rows = data.rows.filter(row => row.websiteSku === sku);
    if (rows.length !== 1) return null;
    const row = rows[0];
    const kit = await convex.query(api.productKits.forSku, { websiteSku: row.websiteSku ?? null, graceSku: row.graceSku ?? null });
    return configurationFromRow(row, kit);
}
