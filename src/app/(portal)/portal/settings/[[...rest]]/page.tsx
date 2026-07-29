"use client";

import { UserProfile } from "@clerk/nextjs";
import { PageHeader } from "@/components/portal/ui";
import { CLERK_ENABLED } from "@/lib/clerk";
import { clerkPortalAppearance } from "@/lib/clerkPortalAppearance";

/**
 * Embedded account settings.
 *
 * Clerk's <UserProfile /> is mounted inline here — with `routing="path"` so
 * its sub-pages (security, connected accounts, email addresses) stay on
 * /portal/settings/* inside the portal shell, rather than bouncing the
 * customer out to Clerk's hosted Account Portal on accounts.dev.
 *
 * The optional catch-all segment ([[...rest]]) is required by Clerk for path
 * routing — without it the sub-routes 404.
 */
export default function PortalSettings() {
    if (!CLERK_ENABLED) {
        return (
            <div className="px-6 py-6 max-w-[1200px]">
                <PageHeader eyebrow="Settings" title="Profile & Security" />
                <div className="rounded-lg border border-neutral-200 bg-white px-6 py-6">
                    <p className="font-sans text-sm leading-relaxed text-neutral-500">
                        Account settings are unavailable while authentication is disabled for
                        this environment.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1200px] px-6 py-6">
            <PageHeader
                eyebrow="Settings"
                title="Profile & Security"
                subtitle="Update your name, email addresses, password, connected accounts, and active sessions."
            />

            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <UserProfile
                    routing="path"
                    path="/portal/settings"
                    appearance={clerkPortalAppearance}
                />
            </div>
        </div>
    );
}
