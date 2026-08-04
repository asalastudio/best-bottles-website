import type {
    KnowledgeActorRole,
    KnowledgeRequestContext,
    KnowledgeScope,
    KnowledgeSurface,
} from "@/lib/knowledge/contracts";

const PUBLIC_SCOPES = [
    "catalog.read",
    "compatibility.read",
    "public_knowledge.read",
    "cart.propose",
    "navigation.propose",
] as const satisfies readonly KnowledgeScope[];

const CUSTOMER_SCOPES = [
    ...PUBLIC_SCOPES,
    "customer_project.read.self",
    "customer_project.write.self",
] as const satisfies readonly KnowledgeScope[];

const EMPLOYEE_SCOPES = [
    ...PUBLIC_SCOPES,
    "internal_knowledge.read",
    "correction.submit",
] as const satisfies readonly KnowledgeScope[];

const EXECUTIVE_SCOPES = [
    ...EMPLOYEE_SCOPES,
    "executive_metrics.read",
    "trace.read",
] as const satisfies readonly KnowledgeScope[];

const ALL_SCOPES = [
    ...CUSTOMER_SCOPES,
    "internal_knowledge.read",
    "executive_metrics.read",
    "correction.submit",
    "trace.read",
] as const satisfies readonly KnowledgeScope[];

const ROLE_SCOPES: Record<KnowledgeActorRole, readonly KnowledgeScope[]> = {
    public: PUBLIC_SCOPES,
    customer: CUSTOMER_SCOPES,
    support: EMPLOYEE_SCOPES,
    employee: EMPLOYEE_SCOPES,
    executive: EXECUTIVE_SCOPES,
    admin: ALL_SCOPES,
};

export type KnowledgeAuthorizationResult =
    | { allowed: true }
    | { allowed: false; reason: `surface_not_allowed:${KnowledgeSurface}` | `missing_scope:${KnowledgeScope}` };

export function resolveKnowledgeScopes(role: KnowledgeActorRole): ReadonlySet<KnowledgeScope> {
    return new Set(ROLE_SCOPES[role]);
}

export function authorizeKnowledgeTool(
    context: KnowledgeRequestContext,
    requiredScopes: readonly KnowledgeScope[],
    surfaces: readonly KnowledgeSurface[],
): KnowledgeAuthorizationResult {
    if (!surfaces.includes(context.surface)) {
        return { allowed: false, reason: `surface_not_allowed:${context.surface}` };
    }

    const availableScopes = resolveKnowledgeScopes(context.role);
    for (const scope of requiredScopes) {
        if (!availableScopes.has(scope)) {
            return { allowed: false, reason: `missing_scope:${scope}` };
        }
    }

    return { allowed: true };
}
