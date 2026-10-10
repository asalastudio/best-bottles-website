"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useCart } from "@/components/CartProvider";
import { usePathname } from "next/navigation";
import { analytics } from "@/lib/analytics";
import { mayRecordSession } from "@/lib/analytics/sessionReplayScope";

const AnalyticsClerkBridge = dynamic(() => import("@/components/AnalyticsClerkBridge"));

/**
 * The analytics token used to be a hardcoded Mixpanel key, which meant every
 * preview deployment wrote into the production project — there was no way to
 * separate environments. The PostHog key comes from the environment instead,
 * so a preview can point at its own project or at nothing.
 *
 * Absent key means analytics simply does not start. That is deliberate: a
 * missing key is a configuration gap, not a reason to fail a page render.
 */
const ANALYTICS_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();

export function AnalyticsProviderBase({
  userId,
  isSignedIn,
  isLoaded,
  organizationId,
}: {
  userId: string | null;
  isSignedIn: boolean;
  isLoaded: boolean;
  organizationId: string | null;
}) {
  const { itemCount } = useCart();
  const pathname = usePathname();
  useEffect(() => {
    if (!ANALYTICS_KEY) return;
    analytics.syncIdentity(isLoaded ? {
      userId: isSignedIn ? userId : null,
      organizationId: isSignedIn ? organizationId : null,
    } : null);
  }, [isLoaded, isSignedIn, userId, organizationId, pathname]);

  useEffect(() => {
    if (!ANALYTICS_KEY || !isLoaded) return;
    let cancelled = false;
    let idleId: number | undefined;
    let timerId: number | undefined;

    const start = () => {
      if (cancelled) return;
      const run = () => {
        if (cancelled) return;
        void analytics.init(ANALYTICS_KEY).then(() => {
          if (!cancelled) analytics.setSessionRecording(mayRecordSession(window.location.pathname));
        });
      };
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(run, { timeout: 4000 });
      } else {
        timerId = window.setTimeout(run, 1);
      }
    };

    if (document.readyState === "complete") {
      start();
    } else {
      window.addEventListener("load", start, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [isLoaded]);

  useEffect(() => {
    analytics.setSuperProperties({
      cartItemCount: itemCount,
      isSignedIn: !!isSignedIn,
    });
  }, [itemCount, isSignedIn]);

  useEffect(() => {
    const pageType = pathname === "/" ? "home"
      : pathname.startsWith("/catalog") ? "catalog"
      : pathname.startsWith("/products/") ? "pdp"
      : pathname.startsWith("/cart") ? "cart"
      : pathname.startsWith("/contact") || pathname.startsWith("/request") ? "form"
      : pathname.startsWith("/portal") ? "portal"
      : "other";

    analytics.setSuperProperties({ currentPageType: pageType });

    // Replay is scoped by route, re-evaluated on every navigation rather than
    // decided once at init: this is a single-page app, so a customer can walk
    // from the catalogue into the portal without a page load, and a recording
    // started on the storefront would happily follow them in.
    analytics.setSessionRecording(ANALYTICS_KEY && isLoaded ? mayRecordSession(pathname) : false);
    if (ANALYTICS_KEY && isLoaded) analytics.pageViewed();
  }, [pathname, isLoaded]);

  return null;
}

export function AnalyticsProvider({ withClerk = false }: { withClerk?: boolean }) {
  if (withClerk) {
    return <AnalyticsClerkBridge />;
  }

  return <AnalyticsProviderBase userId={null} isSignedIn={false} isLoaded organizationId={null} />;
}
