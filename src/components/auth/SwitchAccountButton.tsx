"use client";

import { SignOutButton } from "@clerk/nextjs";

type SwitchAccountButtonProps = {
    redirectUrl: string;
    children: string;
    className?: string;
};

export function SwitchAccountButton({ redirectUrl, children, className }: SwitchAccountButtonProps) {
    const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`;

    return (
        <SignOutButton redirectUrl={signInUrl}>
            <button type="button" className={className}>
                {children}
            </button>
        </SignOutButton>
    );
}
