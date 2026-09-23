import links from "../../../convex/catalog-component-links.json";
import type { CatalogRow } from "./model";
import { reviewedCatalogLink } from "../../../convex/catalogComponentEvidence";

/** Reviewed complete-assembly evidence, never a thread-wide compatibility rule.
 * See docs/reviews/builder-thread-repair-2026-09-08/README.md. */
export const sourceComponentLinks = links;
export function sourceComponentLink(row: CatalogRow) {
    return reviewedCatalogLink(row);
}
