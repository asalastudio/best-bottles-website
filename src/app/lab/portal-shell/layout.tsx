import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: { absolute: "Portal shell lab — Best Bottles" },
    robots: { index: false, follow: false },
};

export default function PortalShellLabLayout({ children }: { children: ReactNode }) {
    return children;
}
