"use client";

import { useAuth } from "@clerk/nextjs";
import type { ReactNode } from "react";
import GraceProvider from "@/components/grace/GraceProvider";

/** Isolated so GraceProvider.tsx does not statically import @clerk/nextjs. */
export default function GraceProviderWithClerk({ children }: { children: ReactNode }) {
    const { userId } = useAuth();
    return <GraceProvider userId={userId ?? null}>{children}</GraceProvider>;
}
