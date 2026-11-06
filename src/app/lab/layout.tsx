import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

/** Engineering surfaces: Preview and local builds only. Production answers 404 (they were
 * noindexed and disallowed, but reachable, and each ships its own three.js route chunk). */
export default function LabLayout({ children }: { children: ReactNode }) {
    if (process.env.VERCEL_ENV === "production") notFound();
    return children;
}
