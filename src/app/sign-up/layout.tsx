import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: { absolute: "Create Account | Best Bottles" },
    robots: { index: false, follow: false },
};

export default function SignUpLayout({ children }: { children: ReactNode }) {
    return children;
}
