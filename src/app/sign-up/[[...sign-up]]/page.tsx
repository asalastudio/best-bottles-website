"use client";

import { SignUp } from "@clerk/nextjs";
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
            <div className="min-h-screen bg-bone flex flex-col items-center justify-center px-6">
                <div className="max-w-md text-center">
                    <p className="font-sans text-[9px] tracking-[0.3em] uppercase text-muted-gold mb-2">
                        {signUpContext}
                    </p>
                    <h1 className="font-serif text-3xl text-obsidian font-normal tracking-[0.02em] mb-4">
                        Sign-up is temporarily unavailable
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
                    {signUpContext}
                </p>
                <h1 className="font-serif text-3xl text-obsidian font-normal tracking-[0.02em]">
                    Create your Best Bottles account
                </h1>
            </div>
            <SignUp
                forceRedirectUrl={redirectUrl}
                fallbackRedirectUrl={redirectUrl}
                signInForceRedirectUrl={redirectUrl}
                signInFallbackRedirectUrl={redirectUrl}
            />
        </div>
    );
}
