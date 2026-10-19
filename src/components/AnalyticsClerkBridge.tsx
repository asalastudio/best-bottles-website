"use client";

import { useAuth } from "@clerk/nextjs";
import { AnalyticsProviderBase } from "@/components/AnalyticsProvider";

export default function AnalyticsClerkBridge() {
    const { userId, isSignedIn, isLoaded, orgId } = useAuth();

    return (
        <AnalyticsProviderBase
            userId={userId ?? null}
            isSignedIn={!!isSignedIn}
            isLoaded={isLoaded}
            organizationId={orgId ?? null}
        />
    );
}
