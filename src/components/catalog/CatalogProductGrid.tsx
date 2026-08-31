import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export default function CatalogProductGrid({
    className,
    ...props
}: ComponentPropsWithoutRef<"div">) {
    return (
        <div
            className={cn(
                "grid grid-cols-1 gap-px border border-champagne/70 bg-champagne/70 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
                className,
            )}
            {...props}
        />
    );
}
