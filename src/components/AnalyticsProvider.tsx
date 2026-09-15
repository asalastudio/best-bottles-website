"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useCart } from "@/components/CartProvider";
import { usePathname } from "next/navigation";
import { analytics } from "@/lib/analytics";
import { mayRecordSession } from "@/lib/analytics/sessionReplayScope";

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

function AnalyticsProviderBase({
  userId,
  isSignedIn,
  user,
}: {
  userId: string | null;
  isSignedIn: boolean;
  user: {
    fullName?: string | null;
    primaryEmailAddress?: { emailAddress?: string | null } | null;
    createdAt?: Date | null;
  } | null;
}) {
  const { itemCount } = useCart();
  const pathname = usePathname();
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ANALYTICS_KEY) return;
    // The initial route decides whether recording starts at all. Calling
    // startSessionRecording() after an init that disabled it does not
    // reliably take effect — the recorder script is never fetched — so the
    // first page must be decided here rather than corrected afterwards.
    // Still fail-closed: an unrecognised path disables it.
    analytics.init(ANALYTICS_KEY, {
      disable_session_recording: !mayRecordSession(window.location.pathname),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init runs once; the
    // route is read from the live location, not from a render-time value.
  }, []);

  useEffect(() => {
    if (isSignedIn && userId && userId !== prevUserIdRef.current) {
      prevUserIdRef.current = userId;
      analytics.identify(userId, {
        $name: user?.fullName ?? undefined,
        $email: user?.primaryEmailAddress?.emailAddress ?? undefined,
        signUpDate: user?.createdAt?.toISOString() ?? undefined,
      });
    } else if (!isSignedIn && prevUserIdRef.current) {
      prevUserIdRef.current = null;
      analytics.reset();
    }
  }, [isSignedIn, userId, user]);

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
    analytics.setSessionRecording(ANALYTICS_KEY ? mayRecordSession(pathname) : false);
  }, [pathname]);

  return null;
}

function AnalyticsProviderWithClerk() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();

  return (
    <AnalyticsProviderBase
      userId={userId ?? null}
      isSignedIn={!!isSignedIn}
      user={user ?? null}
    />
  );
}

export function AnalyticsProvider({ withClerk = false }: { withClerk?: boolean }) {
  if (withClerk) {
    return <AnalyticsProviderWithClerk />;
  }

  return <AnalyticsProviderBase userId={null} isSignedIn={false} user={null} />;
}
