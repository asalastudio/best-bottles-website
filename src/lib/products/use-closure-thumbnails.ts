"use client";

/**
 * Photographed closure thumbnails for the finish the PDP is configuring, keyed
 * by the token swatch name the component's website SKU spells. Same join the
 * desktop configurator rail makes (see closure-swatch-keys): the per-neck
 * component family, plus the plain caps some necks publish into the roll-on-cap
 * family. Convex shares the subscription when both trees ask for the same rows.
 */
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { familyForSlugOrDerived, type ClosureBase } from "@/lib/configurator/families";
import { componentPhotoSkuBelongsToBase, photoKeysForVariant } from "@/lib/products/closure-swatch-keys";

const COMPONENT_FAMILY: Partial<Record<ClosureBase, string>> = {
    roller: "roll-on-cap", sprayer: "sprayer", pump: "lotion-pump", dropper: "dropper", none: "cap-closure",
    reducer: "cap-closure",
};

/** The closure a product-group slug is configuring, mirroring the desktop stage. */
export function closureBaseFromSlug(slug: string): ClosureBase {
    const fam = familyForSlugOrDerived(slug);
    const token = slug.split("-").pop() ?? "";
    return fam?.closureFromSlug[token]
        ?? (/roll-?on/.test(slug) ? "roller" : fam?.derived ? "none" : "sprayer");
}

export function useClosureThumbnails(activeBase: ClosureBase, neckSize: string | null | undefined): Map<string, string> {
    const componentFamilyId = neckSize && COMPONENT_FAMILY[activeBase]
        ? `${COMPONENT_FAMILY[activeBase]}-${neckSize}` : null;
    const componentPlates = useQuery(api.productPlates.byFamily,
        componentFamilyId ? { familyId: componentFamilyId, limit: 200 } : "skip");
    const wantsCapFallback = (activeBase === "none" || activeBase === "reducer") && Boolean(neckSize)
        && componentPlates !== undefined && (componentPlates?.page.length ?? 0) === 0;
    const fallbackCapPlates = useQuery(api.productPlates.byFamily,
        wantsCapFallback ? { familyId: `roll-on-cap-${neckSize}`, limit: 200 } : "skip");

    return useMemo(() => {
        const out = new Map<string, string>();
        const rows = [
            ...(componentPlates?.page ?? []),
            ...(fallbackCapPlates?.page ?? []).filter((row) => row.websiteSku && /^CP(?!Roll)/i.test(row.websiteSku)),
        ];
        for (const row of rows) {
            if (!row.websiteSku || !componentPhotoSkuBelongsToBase(activeBase, row.websiteSku)) continue;
            const finish = photoKeysForVariant({ websiteSku: row.websiteSku })[0];
            if (finish && !out.has(finish)) out.set(finish, row.thumb);
        }
        return out;
    }, [componentPlates, fallbackCapPlates, activeBase]);
}
