/**
 * Map items with bounded parallelism, results in input order. Query handlers use it instead of one
 * `await` per item: reads in a batch run concurrently, as `products.getCatalogGroupVariantPreviewData`
 * already does with batches of 16.
 */
export const READ_BATCH_SIZE = 16;

export async function mapInBatches<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R>, size = READ_BATCH_SIZE): Promise<R[]> {
    const out: R[] = [];
    for (let start = 0; start < items.length; start += size) {
        out.push(...await Promise.all(items.slice(start, start + size).map((item, offset) => fn(item, start + offset))));
    }
    return out;
}
