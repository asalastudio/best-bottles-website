import { NextRequest, NextResponse } from "next/server";
import {
    getPortalGraceWorkspace,
    saveProductToGraceProjectForViewer,
} from "@/lib/portal/server";

function statusForPortalError(error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Unauthenticated") return 401;
    if (message === "No active organization selected.") return 403;
    if (message === "Portal auth is disabled.") return 503;
    if (message.includes("not found")) return 404;
    return 500;
}

export async function GET() {
    try {
        const workspace = await getPortalGraceWorkspace();
        return NextResponse.json({ projects: workspace.projects });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unable to load Grace projects." },
            { status: statusForPortalError(error) },
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as {
            projectId?: unknown;
            projectName?: unknown;
            bottle?: { description?: unknown; sku?: unknown; notes?: unknown };
        };
        if (!body.bottle || typeof body.bottle.description !== "string" || !body.bottle.description.trim()) {
            return NextResponse.json({ error: "A verified bottle description is required." }, { status: 400 });
        }

        const result = await saveProductToGraceProjectForViewer({
            projectId: typeof body.projectId === "string" ? body.projectId : undefined,
            projectName: typeof body.projectName === "string" ? body.projectName.slice(0, 120) : undefined,
            bottle: {
                description: body.bottle.description.trim().slice(0, 500),
                sku: typeof body.bottle.sku === "string" ? body.bottle.sku.trim().slice(0, 120) : undefined,
                notes: typeof body.bottle.notes === "string" ? body.bottle.notes.trim().slice(0, 1000) : undefined,
            },
        });
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unable to save the Grace project." },
            { status: statusForPortalError(error) },
        );
    }
}
