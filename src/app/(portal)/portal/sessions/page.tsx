export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader, PortalTag } from "@/components/portal/ui";
import { getPortalGraceSessions } from "@/lib/portal/server";

function formatWhen(value: number) {
    return new Date(value).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function surfaceLabel(surface: string) {
    return surface === "workspace" ? "Workspace" : "Chat drawer";
}

export default async function PortalGraceSessions() {
    const { sessions } = await getPortalGraceSessions();

    return (
        <div className="mx-auto max-w-[1000px] px-4 py-4 lg:px-6 lg:py-6">
            <PageHeader
                eyebrow="Grace AI"
                title="Grace sessions"
                subtitle="Conversations Grace recorded while you were signed in. Open the workspace to start a new one."
            >
                <Link
                    href="/grace-workspace"
                    className="inline-flex items-center justify-center h-8 px-3 text-[13px] font-sans font-medium rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
                >
                    Open Grace Workspace ↗
                </Link>
            </PageHeader>

            {sessions.length === 0 ? (
                <div className="bg-white rounded-lg border border-neutral-200 px-6 py-10">
                    <p className="font-sans text-[14px] font-medium text-neutral-900">No sessions yet</p>
                    <p className="font-sans text-[13px] text-neutral-500 mt-1.5 leading-relaxed max-w-[520px]">
                        Talk with Grace anywhere on the site while signed in and the conversation
                        will be saved here for your organization to revisit.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                    {sessions.map((session, i) => (
                        <Link
                            key={session._id}
                            href={`/portal/sessions/${session._id}`}
                            data-portal-table-row
                            className={`grid grid-cols-[1fr_110px_140px_80px] gap-4 items-center px-5 py-3.5 hover:bg-neutral-50 transition-colors ${
                                i < sessions.length - 1 ? "border-b border-neutral-100" : ""
                            }`}
                        >
                            <div data-label="Session" className="min-w-0">
                                <p className="font-sans text-[13px] font-medium text-neutral-900 truncate">
                                    {session.title}
                                </p>
                                {session.preview && (
                                    <p className="font-sans text-[12px] text-neutral-400 truncate mt-0.5">
                                        {session.preview}
                                    </p>
                                )}
                            </div>
                            <div data-label="Surface">
                                <PortalTag variant={session.surface === "workspace" ? "gold" : "muted"}>
                                    {surfaceLabel(session.surface)}
                                </PortalTag>
                            </div>
                            <p data-label="Updated" className="font-sans text-[12px] text-neutral-500 tabular-nums">
                                {formatWhen(session.lastMessageAt)}
                            </p>
                            <p data-label="Messages" className="font-sans text-[12px] text-neutral-400 text-right tabular-nums">
                                {session.messageCount} msgs
                            </p>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
