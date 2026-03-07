export const dynamic = "force-dynamic";
import Link from "next/link";
import { PageHeader, PortalButton } from "@/components/portal/ui";
import GraceWorkspaceChat from "@/components/portal/GraceWorkspaceChat";
import { getPortalGraceWorkspace } from "@/lib/portal/server";
import { createGraceProjectAction } from "../actions";

function formatUpdatedAt(value: number) {
    return new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

export default async function PortalGrace({
    searchParams,
}: {
    searchParams?: Promise<{ project?: string }>;
}) {
    const params = searchParams ? await searchParams : undefined;
    const selectedProjectId = params?.project;
    const { projects, activeProject, messages } = await getPortalGraceWorkspace(selectedProjectId);

    return (
        <div className="px-6 py-6 max-w-[1200px]">
            <PageHeader
                eyebrow="Grace AI"
                title="Grace Workspace"
                subtitle="Grace can now keep projects in Convex for your organization."
            />

            <div className="grid grid-cols-[240px_1fr] gap-4 items-start">

                {/* Left column */}
                <div className="flex flex-col gap-3">
                    {/* Projects */}
                    <div className="bg-white rounded-lg border border-neutral-200">
                        <div className="px-4 py-2.5 border-b border-neutral-200">
                            <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide">Projects</p>
                        </div>
                        {projects.length === 0 ? (
                            <div className="px-4 py-5">
                                <p className="font-sans text-[13px] text-neutral-500">
                                    No Grace projects yet.
                                </p>
                            </div>
                        ) : projects.map((project, i) => (
                            <Link
                                key={project._id}
                                href={`/portal/grace?project=${project._id}`}
                                className={`block px-4 py-2.5 transition-colors ${
                                    activeProject?._id === project._id ? "bg-neutral-50 border-l-2 border-l-neutral-900" : "hover:bg-neutral-50"
                                } ${i < projects.length - 1 ? "border-b border-neutral-100" : ""}`}
                            >
                                <p className={`font-sans text-[13px] ${activeProject?._id === project._id ? "text-neutral-900 font-medium" : "text-neutral-500"}`}>
                                    {project.name}
                                </p>
                                <p className="font-sans text-[11px] text-neutral-400">
                                    {project.savedBottleCount} saved bottles · Updated {formatUpdatedAt(project.updatedAt)}
                                </p>
                            </Link>
                        ))}
                        <div className="px-4 py-2.5 border-t border-neutral-100">
                            <form action={createGraceProjectAction}>
                                <PortalButton variant="outline" size="sm" className="w-full" type="submit">
                                    New Project
                                </PortalButton>
                            </form>
                        </div>
                    </div>

                    {/* Saved bottles */}
                    <div className="bg-neutral-900 rounded-lg border border-neutral-800">
                        <div className="px-4 py-2.5 border-b border-neutral-800">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide">Saved Bottles</p>
                            </div>
                        </div>
                        {activeProject?.savedBottles.length ? (
                            activeProject.savedBottles.map((bottle, i) => (
                                <p
                                    key={`${bottle.sku ?? bottle.description}-${i}`}
                                    className={`px-4 py-2.5 font-sans text-[13px] text-neutral-300 ${
                                        i < activeProject.savedBottles.length - 1 ? "border-b border-neutral-800" : ""
                                    }`}
                                >
                                    {bottle.description}
                                </p>
                            ))
                        ) : (
                            <p className="px-4 py-4 font-sans text-[13px] text-neutral-500">
                                Saved bottles from Grace sessions will appear here.
                            </p>
                        )}
                    </div>
                </div>

                {/* Chat panel */}
                <div className="bg-white border border-neutral-200 rounded-lg flex flex-col overflow-hidden" style={{ height: "calc(100vh - 240px)", minHeight: 500 }}>
                    <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between shrink-0">
                        <div>
                            <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-0.5">Active Session</p>
                            <h2 className="font-sans text-[14px] font-semibold text-neutral-900">
                                {activeProject?.name ?? "Create your first project"}
                            </h2>
                        </div>
                        {activeProject && (
                            <div className="flex gap-2">
                                <PortalButton variant="outline" size="sm" type="button">Persisting to Convex</PortalButton>
                            </div>
                        )}
                    </div>
                    <GraceWorkspaceChat
                        projectId={activeProject?._id ?? null}
                        initialMessages={messages.map((entry) => ({
                            role: entry.role === "assistant" ? "grace" : "user",
                            text: entry.content,
                        }))}
                    />
                </div>
            </div>
        </div>
    );
}
