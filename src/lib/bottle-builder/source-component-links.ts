import links from "./source-component-links.json";
import type { CatalogRow } from "./model";

/** Reviewed complete-assembly evidence, never a thread-wide compatibility rule.
 * See docs/reviews/builder-thread-repair-2026-09-08/README.md. */
export const sourceComponentLinks = links;
export function sourceComponentLink(row: CatalogRow) {
    return links.find(link => link.assemblySku === row.websiteSku && link.assemblyGraceSku === row.graceSku
        && link.family === row.family && link.capacityMl === row.capacityMl && link.color === row.color
        && link.neck === row.neckThreadSize && link.applicator === row.applicator && link.finish === row.capColor);
}
