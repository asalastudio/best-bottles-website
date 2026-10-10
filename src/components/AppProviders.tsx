"use client";

import { Suspense, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { CartProvider } from "@/components/CartProvider";
import { RegionProvider } from "@/components/RegionProvider";
import {
    SanityMegaMenuProvider,
    type MegaMenuPanelsData,
} from "@/components/SanityMegaMenuProvider";
import MobileTabBar from "@/components/mobile/MobileTabBar";
import GraceProvider from "@/components/grace/GraceProvider";
import GraceChat from "@/components/grace/GraceChat";
import GraceLauncher from "@/components/grace/GraceLauncher";
import GraceLayoutShell from "@/components/grace/GraceLayoutShell";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { CLERK_ENABLED } from "@/lib/clerk";
import { clerkAppearance } from "@/lib/clerkAppearance";
import { isClerkRoute } from "@/lib/clerkRoutes";

const ClerkRoot = dynamic(() => import("@/components/ClerkRoot"));
const GraceProviderWithClerk = dynamic(() => import("@/components/grace/GraceProviderWithClerk"));

// megaMenuPanels is fetched in the Server Component root layout and passed
// down as a prop, because this file is a Client Component boundary and cannot
// render an async Server Component inside it (Next.js constraint).
type AppProvidersProps = {
    children: ReactNode;
    megaMenuPanels: MegaMenuPanelsData | null | undefined;
    initialMarketCode?: string | null;
};

function ProviderContent({
    children,
    withClerk,
    megaMenuPanels,
    initialMarketCode,
}: {
    children: ReactNode;
    withClerk: boolean;
    megaMenuPanels: MegaMenuPanelsData | null | undefined;
    initialMarketCode?: string | null;
}) {
    const shell = (
        <GraceLayoutShell>
            <SanityMegaMenuProvider initialData={megaMenuPanels}>
                {children}
                <MobileTabBar />
            </SanityMegaMenuProvider>
        </GraceLayoutShell>
    );
    const grace = withClerk
        ? <GraceProviderWithClerk>{shell}<GraceChat /><GraceLauncher /></GraceProviderWithClerk>
        : <GraceProvider>{shell}<GraceChat /><GraceLauncher /></GraceProvider>;
    return (
        <RegionProvider initialMarketCode={initialMarketCode}>
        <ConvexClientProvider withClerk={withClerk}>
            <CartProvider>
                <Suspense
                    fallback={
                        <div className="min-h-screen bg-bone flex items-center justify-center">
                            <div className="w-10 h-10 border-2 border-muted-gold/30 border-t-muted-gold rounded-full animate-spin" />
                        </div>
                    }
                >
                    {grace}
                </Suspense>
                <AnalyticsProvider withClerk={withClerk} />
            </CartProvider>
        </ConvexClientProvider>
        </RegionProvider>
    );
}

export default function AppProviders({ children, megaMenuPanels, initialMarketCode }: AppProvidersProps) {
    // Clerk's SDK loads only on account and checkout routes. Crossing that
    // boundary remounts the provider tree (ClerkProvider, ConvexProviderWithClerk).
    // Storefront pages — home, catalog, PDP — never pay for the handshake.
    const pathname = usePathname();
    const withClerk = CLERK_ENABLED && isClerkRoute(pathname);

    const content = (
        <ProviderContent withClerk={withClerk} megaMenuPanels={megaMenuPanels} initialMarketCode={initialMarketCode}>
            {children}
        </ProviderContent>
    );

    if (withClerk) {
        return (
            // appearance is set here (not per-page) so every Clerk surface —
            // SignIn, SignUp, UserButton, UserProfile — renders in the Best
            // Bottles design rather than Clerk's default third-party card.
            <ClerkRoot appearance={clerkAppearance}>
                {content}
            </ClerkRoot>
        );
    }

    return content;
}
