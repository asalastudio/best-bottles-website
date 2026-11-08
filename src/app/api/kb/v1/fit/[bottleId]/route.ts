import { NextRequest } from "next/server";
import { kbJson } from "@/lib/help/apiResponse";
import { apiFit } from "@/lib/help/api";

export async function GET(req: NextRequest, { params }: { params: Promise<{ bottleId: string }> }) {
    const { bottleId } = await params;
    return kbJson(req, () => apiFit(decodeURIComponent(bottleId)), "No bottle with that id. List bottles at /api/kb/v1/fit");
}
