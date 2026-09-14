import type { Metadata } from "next";
import WorkspaceModeServer from "./WorkspaceModeServer";

export const metadata: Metadata = {
    title: "Grace Workspace",
    description: "Grace AI — open workspace for browsing families, building kits, and comparing bottles. No account needed.",
    robots: { index: false, follow: false },
};

export default function GraceWorkspacePage() {
    return <WorkspaceModeServer />;
}
