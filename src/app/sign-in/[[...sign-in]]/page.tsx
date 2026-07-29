"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { CLERK_ENABLED } from "@/lib/clerk";
import AuthShell from "@/components/auth/AuthShell";

function getSafeRedirectUrl(value: string | null | undefined) {
    if (!value) return "/portal";

    if (value.startsWith("/") && !value.startsWith("//")) {
        return value;
    }

    try {
        const parsedUrl = new URL(value);
        return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` || "/portal";
    } catch {
        return "/portal";
    }
}

function getSignInContext(redirectUrl: string) {
    if (redirectUrl.startsWith("/team")) return "Team Hub";
    if (redirectUrl.startsWith("/executive")) return "Executive Hub";

    return "Client Portal";
}

/** Internal hubs shouldn't be sold on customer pricing and order history. */
function getSignInSubtitle(context: string) {
    if (context === "Team Hub") return "Sign in with your Best Bottles team account.";
    if (context === "Executive Hub") return "Sign in to view the executive dashboard.";

    return "Sign in to see your pricing, quotes, and order history.";
}

export default function SignInPage() {
    const searchParams = useSearchParams();
    const redirectUrl = getSafeRedirectUrl(searchParams?.get("redirect_url"));
    const signInContext = getSignInContext(redirectUrl);

    if (!CLERK_ENABLED) {
        return (
            <AuthShell
                context={signInContext}
                title="Sign-in is temporarily unavailable"
                subtitle="Authentication is disabled for this environment."
            >
                <p className="text-sm leading-relaxed text-slate">
                    Set{" "}
                    <code className="rounded-sm bg-obsidian/[0.05] px-1.5 py-0.5 font-mono text-[12px]">
                        NEXT_PUBLIC_CLERK_ENABLED=true
                    </code>{" "}
                    in{" "}
                    <code className="rounded-sm bg-obsidian/[0.05] px-1.5 py-0.5 font-mono text-[12px]">
                        .env.local
                    </code>{" "}
                    and restart the dev server.
                </p>
            </AuthShell>
        );
    }

    return (
        <AuthShell
            context={signInContext}
            title="Welcome back"
            subtitle={getSignInSubtitle(signInContext)}
        >
            <SignIn
                routing="path"
                path="/sign-in"
                signUpUrl={`/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`}
                forceRedirectUrl={redirectUrl}
                fallbackRedirectUrl={redirectUrl}
                signUpForceRedirectUrl={redirectUrl}
                signUpFallbackRedirectUrl={redirectUrl}
            />
        </AuthShell>
    );
}
