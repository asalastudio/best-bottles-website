import type { Metadata } from "next";
import WorkspaceModeServer from "./WorkspaceModeServer";

export const metadata: Metadata = {
    title: "Grace Workspace",
    description: "Grace AI — full workspace for browsing families, building kits, and comparing bottles.",
    robots: { index: false, follow: false },
};

export default function GraceWorkspacePage() {
    return <WorkspaceModeServer />;
}
