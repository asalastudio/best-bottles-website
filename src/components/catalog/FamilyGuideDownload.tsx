"use client";

import { familyGuide, formatGuideSize } from "@/lib/products/family-guides";
import { familyToSlug } from "@/lib/products/focused-shopping";
import { useCopy } from "@/i18n/useCopy";

/**
 * "Compatibility guide (PDF)" link for a family page: every size, fitment, finish and item number for the
 * family, to download or print. Renders nothing until the family's guide has been published
 * (see src/lib/products/family-guides.ts).
 */
export default function FamilyGuideDownload({ family, className }: { family: string; className?: string }) {
    const t = useCopy("catalog");
    const guide = familyGuide(familyToSlug(family));
    if (!guide) return null;
    return (
        <a
            href={guide.url}
            target="_blank"
            rel="noopener"
            className={[
                "inline-flex items-baseline gap-2 text-sm font-semibold text-obsidian underline underline-offset-4",
                "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold",
                className ?? "",
            ].join(" ")}
            data-family-guide={familyToSlug(family)}
        >
            {t("compatibilityGuide")}
            <span className="text-xs font-normal text-slate no-underline">
                {t("compatibilityGuideMeta", { pages: guide.pages, size: formatGuideSize(guide.bytes) })}
            </span>
        </a>
    );
}
