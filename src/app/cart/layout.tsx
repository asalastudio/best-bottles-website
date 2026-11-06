import type { Metadata } from "next";
import type { ReactNode } from "react";

/** The cart is personal and already disallowed in robots.txt; the page itself says so too. */
export const metadata: Metadata = {
    title: "Your Cart",
    robots: { index: false, follow: false },
};

export default function CartLayout({ children }: { children: ReactNode }) {
    return children;
}
