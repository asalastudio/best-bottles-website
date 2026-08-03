import { NextRequest, NextResponse } from "next/server";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";
import {
    executeGraceServerTool,
    type GraceServerToolName,
} from "@/lib/grace/toolGatewayServer";
import {
    KNOWLEDGE_TOOL_REGISTRY,
    assertKnowledgeToolParameters,
    executeKnowledgeTool,
} from "@/lib/knowledge/toolRegistry";
import type { GraceOpenAIToolName } from "@/lib/knowledge/toolSchemas";
import type { GraceRefineState } from "@/lib/grace/refineState";

type PublicGraceToolCall = {
    authorizationName: GraceOpenAIToolName;
    authorizationParameters: Record<string, unknown>;
    gatewayName: GraceServerToolName;
    gatewayParameters: Record<string, unknown>;
    refineState: GraceRefineState | null;
};

const COMPATIBILITY_ALIASES = new Set<GraceServerToolName>([
    "getProductGroup",
    "getProductBySku",
    "getFamilyForCard",
    "getCatalogStrip",
    "getProductsForComparison",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fillNullableArguments(
    name: GraceOpenAIToolName,
    parameters: Record<string, unknown>,
) {
    const normalized = { ...parameters };
    const properties = KNOWLEDGE_TOOL_REGISTRY[name].schema.parameters.properties;
    for (const [key, property] of Object.entries(properties)) {
        const type = property.type;
        if (!(key in normalized) && Array.isArray(type) && type.includes("null")) {
            normalized[key] = null;
        }
    }
    return normalized;
}

function assertSafeRefineState(value: unknown): asserts value is GraceRefineState {
    if (!isRecord(value) || !isRecord(value.filters)) {
        throw new Error("Invalid parameters for public Grace tool: refineState has an invalid type");
    }
    const allowedStateKeys = new Set(["filters", "sort", "view"]);
    const allowedFilterKeys = new Set([
        "category", "collection", "applicators", "families", "colors", "capacities",
        "neckThreadSizes", "componentType", "priceMin", "priceMax", "search",
    ]);
    if (Object.keys(value).some((key) => !allowedStateKeys.has(key))
        || Object.keys(value.filters).some((key) => !allowedFilterKeys.has(key))) {
        throw new Error("Invalid parameters for public Grace tool: refineState contains undeclared fields");
    }
    const validSorts = new Set([
        "featured", "best-match", "price-asc", "price-desc", "name-asc", "name-desc",
        "capacity-asc", "capacity-desc", "variants-desc",
    ]);
    if (!validSorts.has(String(value.sort)) || !new Set(["visual", "line"]).has(String(value.view))) {
        throw new Error("Invalid parameters for public Grace tool: refineState has an invalid view or sort");
    }
    const filters = value.filters;
    const arrayKeys = ["applicators", "families", "colors", "capacities", "neckThreadSizes"];
    for (const key of arrayKeys) {
        const entries = filters[key];
        if (!Array.isArray(entries) || entries.length > 20
            || entries.some((entry) => typeof entry !== "string" || entry.length > 200)) {
            throw new Error(`Invalid parameters for public Grace tool: refineState.filters.${key} is invalid`);
        }
    }
    for (const key of ["category", "collection", "componentType"]) {
        const entry = filters[key];
        if (entry !== null && (typeof entry !== "string" || entry.length > 200)) {
            throw new Error(`Invalid parameters for public Grace tool: refineState.filters.${key} is invalid`);
        }
    }
    if (typeof filters.search !== "string" || filters.search.length > 500) {
        throw new Error("Invalid parameters for public Grace tool: refineState.filters.search is invalid");
    }
    for (const key of ["priceMin", "priceMax"]) {
        const entry = filters[key];
        if (entry !== null && (typeof entry !== "number" || !Number.isFinite(entry) || entry < 0)) {
            throw new Error(`Invalid parameters for public Grace tool: refineState.filters.${key} is invalid`);
        }
    }
}

function parseAlias(
    name: GraceServerToolName,
    parameters: Record<string, unknown>,
): PublicGraceToolCall {
    let authorizationName: GraceOpenAIToolName;
    let authorizationParameters: Record<string, unknown>;
    switch (name) {
        case "getProductBySku":
            authorizationName = "displayProductCard";
            authorizationParameters = parameters;
            break;
        case "getFamilyForCard":
            authorizationName = "displayFamilyCard";
            authorizationParameters = fillNullableArguments(authorizationName, parameters);
            break;
        case "getCatalogStrip":
            authorizationName = "displayCatalogStrip";
            authorizationParameters = fillNullableArguments(authorizationName, parameters);
            break;
        case "getProductsForComparison":
            authorizationName = "displayComparison";
            authorizationParameters = { ...parameters, dimensions: null };
            break;
        case "getProductGroup": {
            const keys = Object.keys(parameters);
            if (keys.length !== 1 || keys[0] !== "slug"
                || typeof parameters.slug !== "string"
                || parameters.slug.length < 1
                || parameters.slug.length > 200) {
                throw new Error("Invalid parameters for public Grace tool getProductGroup: parameters.slug is invalid");
            }
            authorizationName = "getCurrentPageContext";
            authorizationParameters = {};
            break;
        }
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
    assertKnowledgeToolParameters(authorizationName, authorizationParameters);
    return {
        authorizationName,
        authorizationParameters,
        gatewayName: name,
        gatewayParameters: parameters,
        refineState: null,
    };
}

export function parsePublicGraceToolCall(body: unknown): PublicGraceToolCall {
    if (!isRecord(body) || typeof body.tool_name !== "string" || !body.tool_name) {
        throw new Error("Missing tool_name");
    }
    const parameters = body.parameters === undefined ? {} : body.parameters;
    if (!isRecord(parameters)) {
        throw new Error("Invalid parameters for public Grace tool: parameters must be an object");
    }
    const name = body.tool_name as GraceServerToolName;
    if (COMPATIBILITY_ALIASES.has(name)) return parseAlias(name, parameters);
    if (!Object.prototype.hasOwnProperty.call(KNOWLEDGE_TOOL_REGISTRY, name)) {
        throw new Error(`Unknown tool: ${name}`);
    }

    const authorizationName = name as GraceOpenAIToolName;
    let authorizationParameters = parameters;
    let gatewayParameters = parameters;
    let refineState: GraceRefineState | null = null;
    if (authorizationName === "searchCatalog") {
        const { returnRaw, refineState: rawRefineState, ...declared } = parameters;
        if (returnRaw !== undefined && typeof returnRaw !== "boolean") {
            throw new Error("Invalid parameters for public Grace tool searchCatalog: returnRaw must be boolean");
        }
        if (rawRefineState !== undefined && rawRefineState !== null) {
            assertSafeRefineState(rawRefineState);
            refineState = rawRefineState;
        }
        authorizationParameters = fillNullableArguments(authorizationName, declared);
        gatewayParameters = {
            ...authorizationParameters,
            ...(returnRaw === undefined ? {} : { returnRaw }),
            ...(refineState ? { refineState } : {}),
        };
    } else {
        authorizationParameters = fillNullableArguments(authorizationName, parameters);
        gatewayParameters = authorizationParameters;
    }
    assertKnowledgeToolParameters(authorizationName, authorizationParameters);
    return { authorizationName, authorizationParameters, gatewayName: name, gatewayParameters, refineState };
}

export async function executePublicGraceToolCall(
    body: unknown,
    requestId: string,
    execute: typeof executeGraceServerTool = executeGraceServerTool,
) {
    const call = parsePublicGraceToolCall(body);
    return executeKnowledgeTool({
        context: {
            surface: "storefront",
            role: "public",
            actorId: null,
            organizationId: null,
            conversationId: "grace-browser",
            projectId: null,
            refineState: call.refineState,
            requestId,
        },
        name: call.authorizationName,
        parameters: call.authorizationParameters,
        execute: async () => execute({
            toolName: call.gatewayName,
            parameters: call.gatewayParameters,
        }),
    });
}

/**
 * Same-origin HTTP adapter retained for Grace's browser-based tool calls.
 * Authorization for internal Responses calls happens in the shared registry;
 * this adapter preserves the existing browser secret and rate-limit boundary.
 */
export async function POST(req: NextRequest) {
    try {
        const expectedSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
        if (expectedSecret) {
            const originHeader = req.headers.get("origin");
            const hostHeader = req.headers.get("host");
            let isSameOrigin = false;
            if (originHeader && hostHeader) {
                try {
                    isSameOrigin = new URL(originHeader).host === hostHeader;
                } catch { /* malformed origin */ }
            }
            if (!isSameOrigin && req.headers.get("x-webhook-secret") !== expectedSecret) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const rateLimited = await enforceGraceRateLimit(req, {
            route: "grace-server-tools",
            limit: 120,
            windowMs: 60_000,
        });
        if (rateLimited) return rateLimited;

        const body = await req.json();
        const result = await executePublicGraceToolCall(body, crypto.randomUUID());
        return NextResponse.json({ result });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.startsWith("Knowledge tool blocked:")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (message.startsWith("Unknown tool:")
            || message.startsWith("Missing tool_name")
            || message.startsWith("Invalid parameters")) {
            return NextResponse.json({ error: message }, { status: 400 });
        }
        console.error("[Grace server-tool] Error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
