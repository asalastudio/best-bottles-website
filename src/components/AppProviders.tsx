"use client";

import { Suspense, type ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { CartProvider } from "@/components/CartProvider";
import {
    SanityMegaMenuProvider,
    type MegaMenuPanelsData,
} from "@/components/SanityMegaMenuProvider";
import MobileTabBar from "@/components/mobile/MobileTabBar";
import GraceProvider from "@/components/grace/GraceProvider";
import GraceChatDrawer from "@/components/grace/GraceChatDrawer";
import GraceLauncher from "@/components/grace/GraceLauncher";
import GraceLayoutShell from "@/components/grace/GraceLayoutShell";
import { MixpanelProvider } from "@/components/MixpanelProvider";
import { CLERK_ENABLED } from "@/lib/clerk";
import { clerkAppearance } from "@/lib/clerkAppearance";

// megaMenuPanels is fetched in the Server Component root layout and passed
// down as a prop, because this file is a Client Component boundary and cannot
// render an async Server Component inside it (Next.js constraint).
type AppProvidersProps = {
    children: ReactNode;
    megaMenuPanels: MegaMenuPanelsData | null | undefined;
};

function ProviderContent({
    children,
    withClerk,
    megaMenuPanels,
}: {
    children: ReactNode;
    withClerk: boolean;
    megaMenuPanels: MegaMenuPanelsData | null | undefined;
}) {
    return (
        <ConvexClientProvider withClerk={withClerk}>
            <CartProvider>
                <Suspense
                    fallback={
                        <div className="min-h-screen bg-bone flex items-center justify-center">
                            <div className="w-10 h-10 border-2 border-muted-gold/30 border-t-muted-gold rounded-full animate-spin" />
                        </div>
                    }
                >
                    <GraceProvider withClerk={withClerk}>
                        <GraceLayoutShell>
                            <SanityMegaMenuProvider initialData={megaMenuPanels}>
                                {children}
                                <MobileTabBar />
                            </SanityMegaMenuProvider>
                        </GraceLayoutShell>
                        <GraceChatDrawer />
                        <GraceLauncher />
                    </GraceProvider>
                </Suspense>
                <MixpanelProvider withClerk={withClerk} />
            </CartProvider>
        </ConvexClientProvider>
    );
}

export default function AppProviders({ children, megaMenuPanels }: AppProvidersProps) {
    // withClerk must be constant for the whole session. When it was derived
    // from the pathname, navigating between a non-Clerk page and a Clerk page
    // (e.g. expanding the Grace drawer into /grace-workspace) changed the
    // provider tree shape (ClerkProvider wrapper, ConvexProviderWithClerk,
    // GraceProviderWithClerk), so React remounted everything below — killing
    // the live Grace conversation and its message state mid-session.
    const withClerk = CLERK_ENABLED;

    if (withClerk) {
        return (
            // appearance is set here (not per-page) so every Clerk surface —
            // SignIn, SignUp, UserButton, UserProfile — renders in the Best
            // Bottles design rather than Clerk's default third-party card.
            <ClerkProvider appearance={clerkAppearance}>
                <ProviderContent withClerk={withClerk} megaMenuPanels={megaMenuPanels}>
                    {children}
                </ProviderContent>
            </ClerkProvider>
        );
    }

    return (
        <ProviderContent withClerk={false} megaMenuPanels={megaMenuPanels}>
            {children}
        </ProviderContent>
    );
}
