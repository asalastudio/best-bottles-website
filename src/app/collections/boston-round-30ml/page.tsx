import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
    title: { absolute: "30ml Boston Round Bottles | Best Bottles" },
    description: "Browse 30ml Boston Round wholesale glass bottle options in the Best Bottles catalog.",
    alternates: { canonical: `${SITE_URL}/catalog?families=Boston%20Round&search=30ml` },
};

export default function BostonRound30mlCollectionRedirect() {
    redirect("/catalog?families=Boston%20Round&search=30ml");
}
