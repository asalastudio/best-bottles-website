export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader, PortalButton } from "@/components/portal/ui";
import { getPortalGraceWorkspace } from "@/lib/portal/server";
import { createGraceProjectAction, renameGraceProjectAction } from "../actions";

function formatUpdatedAt(value: number) {
    return new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

export default async function PortalGraceProjects({
    searchParams,
}: {
    searchParams?: Promise<{ project?: string }>;
}) {
    const params = searchParams ? await searchParams : undefined;
    const { projects, activeProject } = await getPortalGraceWorkspace(params?.project);

    return (
        <div className="mx-auto max-w-[1100px] px-4 py-4 lg:px-6 lg:py-6">
            <PageHeader
                eyebrow="Grace AI"
                title="Projects"
                subtitle="Bottles you asked Grace to save, grouped by project. Start a new conversation in the workspace to add more."
            >
                <Link
                    href="/grace-workspace"
                    className="inline-flex items-center justify-center h-8 px-3 text-[13px] font-sans font-medium rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
                >
                    Open Grace Workspace ↗
                </Link>
            </PageHeader>

            {projects.length === 0 ? (
                <div className="bg-white rounded-lg border border-neutral-200 px-6 py-10">
                    <p className="font-sans text-[14px] font-medium text-neutral-900">No projects yet</p>
                    <p className="font-sans text-[13px] text-neutral-500 mt-1.5 leading-relaxed max-w-[540px]">
                        Ask Grace to save a bottle while you browse and it lands here, in a project
                        your whole organization can see.
                    </p>
                    <div className="flex items-center gap-2 mt-4">
                        <Link
                            href="/grace-workspace"
                            className="inline-flex items-center justify-center h-8 px-3 text-[13px] font-sans font-medium rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
                        >
                            Talk with Grace
                        </Link>
                        <form action={createGraceProjectAction}>
                            <PortalButton variant="outline" size="sm" type="submit">
                                Create an empty project
                            </PortalButton>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[260px_1fr]">

                    {/* Project list */}
                    <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-neutral-200">
                            <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide">
                                All projects
                            </p>
                        </div>
                        {projects.map((project, i) => (
                            <Link
                                key={project._id}
                                href={`/portal/grace?project=${project._id}`}
                                className={`block px-4 py-2.5 transition-colors ${
                                    activeProject?._id === project._id
                                        ? "bg-neutral-50 border-l-2 border-l-neutral-900"
                                        : "hover:bg-neutral-50"
                                } ${i < projects.length - 1 ? "border-b border-neutral-100" : ""}`}
                            >
                                <p
                                    className={`font-sans text-[13px] ${
                                        activeProject?._id === project._id
                                            ? "text-neutral-900 font-medium"
                                            : "text-neutral-500"
                                    }`}
                                >
                                    {project.name}
                                </p>
                                <p className="font-sans text-[11px] text-neutral-400">
                                    {project.savedBottleCount} saved · Updated {formatUpdatedAt(project.updatedAt)}
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

                    {/* Active project */}
                    <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-neutral-200">
                            <form action={renameGraceProjectAction} className="flex items-center gap-2">
                                <input type="hidden" name="projectId" value={activeProject?._id ?? ""} />
                                <input
                                    name="name"
                                    defaultValue={activeProject?.name ?? ""}
                                    aria-label="Project name"
                                    className="flex-1 min-w-0 font-sans text-[14px] font-semibold text-neutral-900 bg-transparent border border-transparent rounded-md px-2 py-1 -ml-2 hover:border-neutral-200 focus:border-neutral-300 focus:bg-white focus:outline-none transition-colors"
                                />
                                <PortalButton variant="outline" size="sm" type="submit">
                                    Rename
                                </PortalButton>
                            </form>
                            <p className="font-sans text-[12px] text-neutral-400 mt-1 px-0.5">
                                {activeProject?.savedBottleCount ?? 0} saved bottles · Updated{" "}
                                {activeProject ? formatUpdatedAt(activeProject.updatedAt) : "—"}
                            </p>
                        </div>

                        {activeProject?.savedBottles.length ? (
                            activeProject.savedBottles.map((bottle, i) => (
                                <div
                                    key={`${bottle.sku ?? bottle.description}-${i}`}
                                    className={`px-5 py-3 ${
                                        i < activeProject.savedBottles.length - 1 ? "border-b border-neutral-100" : ""
                                    }`}
                                >
                                    {bottle.sku && (
                                        <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-0.5">
                                            {bottle.sku}
                                        </p>
                                    )}
                                    <p className="font-sans text-[13px] text-neutral-900">{bottle.description}</p>
                                    {bottle.notes && (
                                        <p className="font-sans text-[12px] text-neutral-500 mt-0.5 leading-relaxed">
                                            {bottle.notes}
                                        </p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="px-5 py-8">
                                <p className="font-sans text-[13px] text-neutral-500 leading-relaxed max-w-[460px]">
                                    Nothing saved to this project yet. Ask Grace to save a bottle in the
                                    workspace and it will appear here.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
