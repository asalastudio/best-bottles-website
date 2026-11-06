import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Staff-only. Every Team Hub page inherits noindex; pages that set their own robots agree. */
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

export default function TeamLayout({ children }: { children: ReactNode }) {
    return children;
}
