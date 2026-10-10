"use client";

import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import type { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

export default function ConvexClerkProvider({
    client,
    children,
}: {
    client: ConvexReactClient;
    children: ReactNode;
}) {
    return (
        <ConvexProviderWithClerk client={client} useAuth={useAuth}>
            {children}
        </ConvexProviderWithClerk>
    );
}
