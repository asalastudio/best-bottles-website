export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, PortalTag } from "@/components/portal/ui";
import { getPortalGraceSession } from "@/lib/portal/server";

function formatWhen(value: number) {
    return new Date(value).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export default async function PortalGraceSessionDetail({
    params,
}: {
    params: Promise<{ sessionId: string }>;
}) {
    const { sessionId } = await params;
    const session = await getPortalGraceSession(sessionId);
    if (!session) notFound();

    return (
        <div className="px-6 py-6 max-w-[900px]">
            <Link
                href="/portal/sessions"
                className="inline-block font-sans text-[12px] font-medium text-neutral-400 hover:text-neutral-600 transition-colors mb-4"
            >
                ← All sessions
            </Link>
            <PageHeader
                eyebrow="Grace session"
                title={session.title}
                subtitle={`${formatWhen(session.startedAt)} · ${session.messageCount} messages`}
            >
                <PortalTag variant={session.surface === "workspace" ? "gold" : "muted"}>
                    {session.surface === "workspace" ? "Workspace" : "Chat drawer"}
                </PortalTag>
            </PageHeader>

            <div className="bg-white rounded-lg border border-neutral-200 px-6 py-6 flex flex-col gap-4">
                {session.messages.map((message, i) => (
                    <div
                        key={i}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`max-w-[78%] rounded-lg px-4 py-2.5 font-sans text-[13px] leading-relaxed whitespace-pre-wrap ${
                                message.role === "user"
                                    ? "bg-neutral-900 text-white"
                                    : "bg-neutral-50 border border-neutral-200 text-neutral-800"
                            }`}
                        >
                            {message.text}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
