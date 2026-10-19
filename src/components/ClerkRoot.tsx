"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ComponentProps, ReactNode } from "react";

type Appearance = ComponentProps<typeof ClerkProvider>["appearance"];

/** Loaded only on account and checkout routes so @clerk/nextjs stays out of the storefront bundle. */
export default function ClerkRoot({
    children,
    appearance,
}: {
    children: ReactNode;
    appearance?: Appearance;
}) {
    return <ClerkProvider appearance={appearance}>{children}</ClerkProvider>;
}
