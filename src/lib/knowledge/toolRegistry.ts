import { authorizeKnowledgeTool } from "@/lib/knowledge/authorization";
import type {
    KnowledgeRequestContext,
    KnowledgeScope,
    KnowledgeSurface,
} from "@/lib/knowledge/contracts";
import {
    GRACE_OPENAI_TOOL_SPECS,
    type GraceOpenAIToolName,
    type GraceOpenAIToolSpec,
} from "@/lib/knowledge/toolSchemas";

export type KnowledgeToolPolicy = {
    schema: GraceOpenAIToolSpec;
    requiredScopes: readonly KnowledgeScope[];
    risk: "read" | "propose" | "write";
    surfaces: readonly KnowledgeSurface[];
};

type PolicyWithoutSchema = Omit<KnowledgeToolPolicy, "schema">;

const ALL_SURFACES = [
    "storefront",
    "customer_portal",
    "employee_workspace",
    "executive_hub",
    "chatgpt_app",
] as const satisfies readonly KnowledgeSurface[];

const CUSTOMER_SURFACES = ["storefront", "customer_portal"] as const satisfies readonly KnowledgeSurface[];
const CATALOG_READ = ["catalog.read"] as const satisfies readonly KnowledgeScope[];
const COMPATIBILITY_READ = ["compatibility.read"] as const satisfies readonly KnowledgeScope[];
const NAVIGATION_PROPOSAL = ["navigation.propose"] as const satisfies readonly KnowledgeScope[];
const CART_PROPOSAL = ["cart.propose"] as const satisfies readonly KnowledgeScope[];

const read = (
    requiredScopes: readonly KnowledgeScope[],
    surfaces: readonly KnowledgeSurface[] = ALL_SURFACES,
): PolicyWithoutSchema => ({
    requiredScopes,
    surfaces,
    risk: "read",
});

const propose = (
    requiredScopes: readonly KnowledgeScope[],
    surfaces: readonly KnowledgeSurface[] = CUSTOMER_SURFACES,
): PolicyWithoutSchema => ({ requiredScopes, surfaces, risk: "propose" });

const TOOL_POLICIES = {
    searchCatalog: read(CATALOG_READ),
    getFamilyOverview: read(CATALOG_READ),
    getBottleComponents: read(COMPATIBILITY_READ),
    checkCompatibility: read(COMPATIBILITY_READ),
    getCatalogStats: read(CATALOG_READ),
    getCurrentPageContext: read(CATALOG_READ, CUSTOMER_SURFACES),
    getCartContents: read(CATALOG_READ, CUSTOMER_SURFACES),
    getBrowsingHistory: read(CATALOG_READ, CUSTOMER_SURFACES),
    showProducts: propose(NAVIGATION_PROPOSAL),
    compareProducts: read(CATALOG_READ),
    proposeCartAdd: propose(CART_PROPOSAL),
    proceedToCheckout: propose(CART_PROPOSAL),
    navigateToPage: propose(NAVIGATION_PROPOSAL),
    showProductPresentation: read(CATALOG_READ),
    prefillForm: propose(CART_PROPOSAL),
    updateFormField: propose(CART_PROPOSAL),
    submitForm: propose(CART_PROPOSAL),
    displayProductCard: read(CATALOG_READ),
    displayFamilyCard: read(CATALOG_READ),
    displayCompatibility: read(COMPATIBILITY_READ),
    displayBuildKit: read(COMPATIBILITY_READ),
    displayComparison: read(CATALOG_READ),
    displayCatalogStrip: read(CATALOG_READ),
    displayShortlist: read(CATALOG_READ, CUSTOMER_SURFACES),
    displayAnatomy: read(CATALOG_READ),
    setCatalogRefinements: propose(NAVIGATION_PROPOSAL),
    setPaperDollSelection: propose(["catalog.read", "compatibility.read"]),
    prepareQuoteRequest: propose(CART_PROPOSAL),
    listGraceProjects: read(["customer_project.read.self"], ["customer_portal"]),
    proposeProjectSave: propose(["customer_project.write.self"], ["customer_portal"]),
} satisfies Record<GraceOpenAIToolName, PolicyWithoutSchema>;

export const KNOWLEDGE_TOOL_REGISTRY = Object.fromEntries(
    GRACE_OPENAI_TOOL_SPECS.map((schema) => [
        schema.name,
        { schema, ...TOOL_POLICIES[schema.name] },
    ]),
) as Record<GraceOpenAIToolName, KnowledgeToolPolicy>;

export function getAuthorizedKnowledgeTools(context: KnowledgeRequestContext): GraceOpenAIToolSpec[] {
    return GRACE_OPENAI_TOOL_SPECS.filter((schema) => {
        const definition = KNOWLEDGE_TOOL_REGISTRY[schema.name];
        return authorizeKnowledgeTool(context, definition.requiredScopes, definition.surfaces).allowed;
    });
}

export async function executeKnowledgeTool(args: {
    context: KnowledgeRequestContext;
    name: GraceOpenAIToolName;
    parameters: Record<string, unknown>;
    execute: (name: GraceOpenAIToolName, parameters: Record<string, unknown>) => Promise<unknown>;
}): Promise<unknown> {
    const definition = KNOWLEDGE_TOOL_REGISTRY[args.name];
    if (!definition) {
        throw new Error(`Knowledge tool blocked: unknown_tool:${args.name}`);
    }

    const authorization = authorizeKnowledgeTool(
        args.context,
        definition.requiredScopes,
        definition.surfaces,
    );
    if (!authorization.allowed) {
        throw new Error(`Knowledge tool blocked: ${authorization.reason}`);
    }

    return args.execute(args.name, args.parameters);
}
