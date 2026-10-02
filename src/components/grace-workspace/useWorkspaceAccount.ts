"use client";

import { useEffect, useState } from "react";

type WorkspaceAccount = {
    userId: string;
    orgId: string;
    account: { companyName: string; tier: string } | null;
    projects: Array<{ name: string; updatedAt: number; savedBottleCount: number }>;
};

/** Fetch a narrow server-authorized view; never send org IDs or backend credentials. */
export function useWorkspaceAccount(userId: string | null, orgId: string | null) {
    const [data, setData] = useState<WorkspaceAccount | null>(null);
    useEffect(() => {
        if (!userId || !orgId) return;
        const controller = new AbortController();
        let requestVersion = 0;
        const refresh = async () => {
            const version = ++requestVersion;
            try {
                const response = await fetch("/api/grace/workspace-account", {
                    cache: "no-store", signal: controller.signal,
                });
                const next: WorkspaceAccount | null = response.ok ? await response.json() : null;
                if (!controller.signal.aborted && version === requestVersion) setData(next);
            } catch {
                if (!controller.signal.aborted && version === requestVersion) setData(null);
            }
        };
        void refresh();
        // Refresh saved projects while Grace is open, and on return to the tab.
        const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 30_000);
        window.addEventListener("focus", refresh);
        return () => {
            controller.abort();
            window.clearInterval(timer);
            window.removeEventListener("focus", refresh);
        };
    }, [userId, orgId]);

    // Hide the previous viewer immediately on sign-out or organization switch,
    // including a response that races with a change in the Clerk session.
    return data?.userId === userId && data?.orgId === orgId ? data : null;
}
