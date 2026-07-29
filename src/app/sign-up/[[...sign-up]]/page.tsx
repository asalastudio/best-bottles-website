"use client";

import { SignUp } from "@clerk/nextjs";
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

function getSignUpContext(redirectUrl: string) {
    if (redirectUrl.startsWith("/team")) return "Team Hub";
    if (redirectUrl.startsWith("/executive")) return "Executive Hub";

    return "Client Portal";
}

export default function SignUpPage() {
    const searchParams = useSearchParams();
    const redirectUrl = getSafeRedirectUrl(searchParams?.get("redirect_url"));
    const signUpContext = getSignUpContext(redirectUrl);

    if (!CLERK_ENABLED) {
        return (
            <AuthShell
                context={signUpContext}
                title="Sign-up is temporarily unavailable"
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
            context={signUpContext}
            title="Create your account"
            subtitle="Save your specs, track quotes, and reorder in a click."
        >
            <SignUp
                routing="path"
                path="/sign-up"
                signInUrl={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}
                forceRedirectUrl={redirectUrl}
                fallbackRedirectUrl={redirectUrl}
                signInForceRedirectUrl={redirectUrl}
                signInFallbackRedirectUrl={redirectUrl}
            />
        </AuthShell>
    );
}
