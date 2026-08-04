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
    listGraceProjects: read(["customer_project.read.self"], CUSTOMER_SURFACES),
    proposeProjectSave: propose(["customer_project.write.self"], CUSTOMER_SURFACES),
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

function matchesJsonType(value: unknown, type: unknown) {
    if (type === "null") return value === null;
    if (type === "array") return Array.isArray(value);
    if (type === "object") return typeof value === "object" && value !== null && !Array.isArray(value);
    if (type === "integer") return typeof value === "number" && Number.isInteger(value);
    if (type === "number") return typeof value === "number" && Number.isFinite(value);
    return typeof value === type;
}

function validateJsonSchema(schemaValue: unknown, value: unknown, path: string): string | null {
    if (!schemaValue || typeof schemaValue !== "object" || Array.isArray(schemaValue)) {
        return `${path} has an invalid schema`;
    }
    const schema = schemaValue as Record<string, unknown>;
    const acceptedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!acceptedTypes.some((type) => matchesJsonType(value, type))) {
        return `${path} has an invalid type`;
    }
    if (Array.isArray(schema.enum) && !schema.enum.some((entry) => Object.is(entry, value))) {
        return `${path} is not an allowed value`;
    }
    if (typeof value === "number") {
        if (typeof schema.minimum === "number" && value < schema.minimum) return `${path} is below the minimum`;
        if (typeof schema.maximum === "number" && value > schema.maximum) return `${path} is above the maximum`;
    }
    if (typeof value === "string" && value.length > 2_000) {
        return `${path} is too long`;
    }

    if (Array.isArray(value)) {
        if (typeof schema.minItems === "number" && value.length < schema.minItems) return `${path} has too few items`;
        if (typeof schema.maxItems === "number" && value.length > schema.maxItems) return `${path} has too many items`;
        for (let index = 0; index < value.length; index += 1) {
            const error = validateJsonSchema(schema.items, value[index], `${path}[${index}]`);
            if (error) return error;
        }
    }

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        const properties = (schema.properties ?? {}) as Record<string, unknown>;
        const required = Array.isArray(schema.required) ? schema.required : [];
        for (const key of required) {
            if (typeof key === "string" && !Object.prototype.hasOwnProperty.call(record, key)) {
                return `${path}.${key} is required`;
            }
        }
        if (schema.additionalProperties === false) {
            const unexpected = Object.keys(record).find((key) => !Object.prototype.hasOwnProperty.call(properties, key));
            if (unexpected) return `${path}.${unexpected} is not allowed`;
        }
        for (const [key, childValue] of Object.entries(record)) {
            if (!Object.prototype.hasOwnProperty.call(properties, key)) continue;
            const error = validateJsonSchema(properties[key], childValue, `${path}.${key}`);
            if (error) return error;
        }
    }
    return null;
}

export function assertKnowledgeToolParameters(
    name: string,
    parameters: Record<string, unknown>,
) {
    const definition = KNOWLEDGE_TOOL_REGISTRY[name as GraceOpenAIToolName];
    const error = definition ? validateJsonSchema(definition.schema.parameters, parameters, "parameters") : "unknown tool";
    if (error) throw new Error(`Invalid parameters for knowledge tool ${name}: ${error}`);
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

    assertKnowledgeToolParameters(args.name, args.parameters);

    return args.execute(args.name, args.parameters);
}
