import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Tech Stack Demo | Best Bottles",
    robots: { index: false, follow: false },
};

export default function TechStackLayout({ children }: { children: ReactNode }) {
    return children;
}
