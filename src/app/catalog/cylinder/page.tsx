import type { Metadata } from "next";
import Footer from "@/components/Footer";
import { searchCatalogServer } from "@/lib/catalogServer";
import { buildCylinderFamilyPageModel } from "@/lib/products/cylinder-family-page";
import { getProductFamilyPageContent } from "@/sanity/lib/queries";
import { SITE_URL } from "@/lib/seo";
import CylinderFamilyPageClient from "./CylinderFamilyPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
    title: { absolute: "Cylinder Bottle Family — Build or Browse | Best Bottles" },
    description: "Explore Cylinder bottles by capacity, glass color, applicator, and neck finish, or build a compatible 9 mL 17-415 Cylinder configuration.",
    alternates: { canonical: `${SITE_URL}/catalog/cylinder` },
};

export default async function CylinderFamilyPage() {
    const [catalog, editorial] = await Promise.all([
        searchCatalogServer({
            filters: { families: ["Cylinder"] },
            sort: "capacity-asc",
            view: "visual",
            limit: 240,
            cursor: null,
        }),
        getProductFamilyPageContent("Cylinder"),
    ]);
    const model = buildCylinderFamilyPageModel(catalog.items, catalog.variantPreviewRows);

    return (
        <>
            <CylinderFamilyPageClient
                catalog={catalog}
                model={model}
                editorial={editorial}
            />
            <Footer />
        </>
    );
}
