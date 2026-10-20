import "server-only";

import { z } from "zod";
import { createNativeB2bService, type B2bAccess } from "./shopify-b2b";

type ServiceDependencies = Parameters<typeof createNativeB2bService>[0];
type Viewer = { clerkUserId: string | null; clerkOrgId: string | null };
type Pilot = {
    enabled: boolean;
    origin: string;
    clerkUserId: string;
    clerkOrgId: string;
    companyId: string;
    companyContactId: string;
    companyLocationId: string;
};

const input = z.object({
    action: z.enum(["prices", "checkout"]),
    companyLocationId: z.string().regex(/^gid:\/\/shopify\/CompanyLocation\/\d+$/),
    lines: z.array(z.object({
        variantId: z.string().regex(/^gid:\/\/shopify\/ProductVariant\/\d+$/),
        quantity: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    }).strict()).min(1).max(250),
}).strict();

function response(body: unknown, status = 200) {
    return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie, Origin" } });
}

/**
 * HTTP composition for the isolated pilot, NOT a registered production route.
 * The auth owner must provide a server-owned Customer Account session resolver
 * and real order policy before mounting this handler. An absent dependency is
 * deliberately not replaced with a billing customer, browser token or no-op.
 */
export function createNativeB2bPilotHandler(deps: {
    pilot: Pilot;
    readViewer: () => Promise<Viewer>;
    // Must validate the user's own token and fresh authorized locations through
    // Customer Account API. Selection is only a request, never proof of access.
    loadAccess: (selectedLocationId: string) => Promise<B2bAccess>;
    assertOrderAllowed: ServiceDependencies["assertOrderAllowed"];
    enrollment: ServiceDependencies["enrollment"];
    request?: ServiceDependencies["request"];
}) {
    const pilot = structuredClone(deps.pilot);
    const enrollment = structuredClone(deps.enrollment);
    const enrolled = new Set(enrollment.map(item => item.variantId));
    const viewerMatches = (viewer: Viewer) => viewer.clerkUserId === pilot.clerkUserId && viewer.clerkOrgId === pilot.clerkOrgId;

    return async (req: Request): Promise<Response> => {
        if (!pilot.enabled) return response({ code: "B2B_PILOT_DISABLED" }, 404);
        if (!pilot.clerkUserId || !pilot.clerkOrgId || !pilot.companyId || !pilot.companyContactId || !pilot.companyLocationId
            || !/^https:\/\/[^/]+$/.test(pilot.origin) || !enrollment.length) {
            return response({ code: "B2B_PILOT_NOT_CONFIGURED" }, 503);
        }
        if (req.method !== "POST") return response({ code: "METHOD_NOT_ALLOWED" }, 405);
        if (req.headers.get("origin") !== pilot.origin) return response({ code: "B2B_REQUEST_REJECTED" }, 403);
        if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
            return response({ code: "JSON_REQUIRED" }, 415);
        }
        try {
            const viewer = await deps.readViewer();
            if (!viewer.clerkUserId) return response({ code: "SIGN_IN_REQUIRED" }, 401);
            if (!viewerMatches(viewer)) return response({ code: "B2B_PILOT_ACCESS_DENIED" }, 403);

            const raw = await req.text();
            if (raw.length > 16_384) return response({ code: "INVALID_PILOT_REQUEST" }, 400);
            let json: unknown;
            try { json = JSON.parse(raw); } catch { return response({ code: "INVALID_PILOT_REQUEST" }, 400); }
            const parsed = input.safeParse(json);
            if (!parsed.success) return response({ code: "INVALID_PILOT_REQUEST" }, 400);
            const { action, companyLocationId, lines } = parsed.data;
            if (companyLocationId !== pilot.companyLocationId || lines.some(line => !enrolled.has(line.variantId))) {
                return response({ code: "B2B_PILOT_SCOPE_DENIED" }, 403);
            }

            const service = createNativeB2bService({
                enrollment, request: deps.request, assertOrderAllowed: deps.assertOrderAllowed,
                loadAccess: async () => {
                    // Repeat for the adapter's final pre-cart approval check.
                    const currentViewer = await deps.readViewer();
                    if (!viewerMatches(currentViewer)) return { status: "revoked" };
                    const access = await deps.loadAccess(companyLocationId);
                    if (access.status !== "approved") return access;
                    if (access.clerkUserId !== pilot.clerkUserId || access.clerkOrgId !== pilot.clerkOrgId
                        || access.companyId !== pilot.companyId || access.companyContactId !== pilot.companyContactId
                        || access.companyLocationId !== pilot.companyLocationId) return { status: "revoked" };
                    return access;
                },
            });
            if (action === "prices") return response({ lines: await service.prices(lines) });
            return response(await service.checkout(lines));
        } catch {
            // Never expose upstream/token-bearing errors or fall back to another
            // checkout mode. The UI must keep the entered quantities unchanged.
            return response({ code: "B2B_VERIFICATION_REQUIRED" }, 409);
        }
    };
}
