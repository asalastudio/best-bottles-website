import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageAlternates } from "@/i18n/metadata";

export const metadata: Metadata = {
    title: { absolute: "30ml Boston Round Bottles | Best Bottles" },
    description: "Browse 30ml Boston Round wholesale glass bottle options in the Best Bottles catalog.",
    alternates: pageAlternates("/collections/boston-round-30ml", "/catalog?families=Boston%20Round&search=30ml"),
};

export default function BostonRound30mlCollectionRedirect() {
    redirect("/catalog?families=Boston%20Round&search=30ml");
}
