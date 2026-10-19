import "server-only";
import { unstable_cache } from "next/cache";
import { getMegaMenuPanels } from "@/sanity/lib/queries";

export const getCachedMegaMenuPanels = unstable_cache(
    () => getMegaMenuPanels(),
    ["mega-menu-panels-v1"],
    { revalidate: 300 },
);
