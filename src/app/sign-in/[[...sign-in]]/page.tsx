"use client";

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { CLERK_ENABLED } from "@/lib/clerk";

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

export default function SignInPage() {
    const searchParams = useSearchParams();
    const redirectUrl = getSafeRedirectUrl(searchParams?.get("redirect_url"));
    const signInContext = getSignInContext(redirectUrl);

    if (!CLERK_ENABLED) {
        return (
            <div className="min-h-screen bg-bone flex flex-col items-center justify-center px-6">
                <div className="max-w-md text-center">
                    <p className="font-sans text-[9px] tracking-[0.3em] uppercase text-muted-gold mb-2">
                        {signInContext}
                    </p>
                    <h1 className="font-serif text-3xl text-obsidian font-normal tracking-[0.02em] mb-4">
                        Sign-in is temporarily unavailable
                    </h1>
                    <p className="text-sm text-slate leading-relaxed">
                        Clerk auth is disabled for this environment. Set{" "}
                        <code className="font-mono text-[12px] bg-obsidian/[0.05] px-1.5 py-0.5 rounded">
                            NEXT_PUBLIC_CLERK_ENABLED=true
                        </code>{" "}
                        in <code className="font-mono text-[12px] bg-obsidian/[0.05] px-1.5 py-0.5 rounded">.env.local</code> and restart
                        the dev server.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bone flex flex-col items-center justify-center">
            <div className="mb-8 text-center">
                <p className="font-sans text-[9px] tracking-[0.3em] uppercase text-muted-gold mb-2">
                    {signInContext}
                </p>
                <h1 className="font-serif text-3xl text-obsidian font-normal tracking-[0.02em]">
                    Best Bottles
                </h1>
            </div>
            <SignIn
                forceRedirectUrl={redirectUrl}
                fallbackRedirectUrl={redirectUrl}
                signUpForceRedirectUrl={redirectUrl}
                signUpFallbackRedirectUrl={redirectUrl}
            />
        </div>
    );
}
