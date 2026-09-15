import type { Metadata } from "next";
import GraceWorkspaceClient from "./GraceWorkspaceClient";
import { getWorkspaceRailData } from "@/lib/grace/workspaceRail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Grace Workspace",
    description: "Grace AI — open workspace for browsing families, building kits, and comparing bottles. No account needed.",
    robots: { index: false, follow: false },
};

/**
 * One surface for everyone. Staff used to get a separate internal knowledge
 * console here; it drifted from the customer workspace and lost the
 * microphone, so it was retired. Signing in adds account-linked history, it
 * does not change the shape of the page.
 */
export default async function GraceWorkspacePage() {
    const rail = await getWorkspaceRailData();
    return <GraceWorkspaceClient families={rail.families} sessions={rail.sessions} />;
}
