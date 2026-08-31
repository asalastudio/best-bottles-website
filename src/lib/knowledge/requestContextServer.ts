import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { CLERK_ENABLED } from "@/lib/clerk";
import type {
    KnowledgeActorRole,
    KnowledgeRequestContext,
} from "@/lib/knowledge/contracts";
import type { GraceRefineState } from "@/lib/grace/refineState";
import { getUserEmailAddresses, hasTeamHubAccess } from "@/lib/teamAccess";

const ROLE_PRIORITY: Array<[KnowledgeActorRole, readonly string[]]> = [
    ["admin", ["admin", "super_admin", "founder"]],
    ["executive", ["executive", "ceo"]],
    ["support", ["support"]],
    ["employee", ["employee", "team"]],
];

function normalizedMetadataRoles(metadata: Record<string, unknown> | null | undefined): string[] {
    const values = [metadata?.role, ...(Array.isArray(metadata?.roles) ? metadata.roles : [])];
    return values.flatMap((value) => (
        typeof value === "string" && value.trim() ? [value.trim().toLowerCase()] : []
    ));
}

function resolveEmployeeRole(metadata: Record<string, unknown> | null | undefined): KnowledgeActorRole {
    const roles = new Set(normalizedMetadataRoles(metadata));
    for (const [role, aliases] of ROLE_PRIORITY) {
        if (aliases.some((alias) => roles.has(alias))) return role;
    }
    return "employee";
}

const safeIdentifier = (value: string | null | undefined): string => {
    const normalized = value?.trim().slice(0, 160);
    return normalized || crypto.randomUUID();
};

export async function deriveEmployeeKnowledgeContext({
    conversationId,
    refineState = null,
}: {
    conversationId?: string | null;
    refineState?: GraceRefineState | null;
} = {}): Promise<KnowledgeRequestContext> {
    if (!CLERK_ENABLED) {
        if (process.env.NODE_ENV === "production") throw new Error("Forbidden");
        return {
            surface: "employee_workspace",
            role: "employee",
            actorId: "dev-preview",
            organizationId: "dev-best-bottles",
            conversationId: safeIdentifier(conversationId),
            projectId: null,
            refineState,
            requestId: crypto.randomUUID(),
        };
    }

    const { userId, orgId } = await auth();
    if (!userId) throw new Error("Forbidden");
    const user = await currentUser();
    const emailAddresses = getUserEmailAddresses(user);
    if (!hasTeamHubAccess(user?.publicMetadata, { emailAddresses })) throw new Error("Forbidden");

    return {
        surface: "employee_workspace",
        role: resolveEmployeeRole(user?.publicMetadata),
        actorId: userId,
        organizationId: orgId ?? "best-bottles",
        conversationId: safeIdentifier(conversationId),
        projectId: null,
        refineState,
        requestId: crypto.randomUUID(),
    };
}
