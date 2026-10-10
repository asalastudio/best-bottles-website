"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import dynamic from "next/dynamic";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const ConvexClerkProvider = dynamic(() => import("@/components/ConvexClerkProvider"));

export default function ConvexClientProvider({
    children,
    withClerk = false,
}: {
    children: ReactNode;
    withClerk?: boolean;
}) {
    if (!withClerk) {
        return <ConvexProvider client={convex}>{children}</ConvexProvider>;
    }

    return <ConvexClerkProvider client={convex}>{children}</ConvexClerkProvider>;
}
