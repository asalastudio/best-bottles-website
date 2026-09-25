import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Master catalog grid (design 8a): at most three across, hairline #e6dccd
 * rules drawn as top/left on the grid and right/bottom on each card, so a
 * short last row leaves no filled gaps. Nothing here clips overflow: the
 * card's "Pack of" menu hangs below the card.
 */
export default function CatalogProductGrid({
    className,
    ...props
}: ComponentPropsWithoutRef<"div">) {
    return (
        <div
            className={cn(
                "grid grid-cols-1 border-l border-t border-[#e6dccd] sm:grid-cols-2 lg:grid-cols-3 [&>*]:border-b [&>*]:border-r [&>*]:border-[#e6dccd]",
                className,
            )}
            {...props}
        />
    );
}
