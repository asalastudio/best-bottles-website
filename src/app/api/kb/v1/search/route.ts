import { NextRequest, NextResponse } from "next/server";
import { kbJson } from "@/lib/help/apiResponse";
import { apiSearch } from "@/lib/help/api";

export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (!q) return NextResponse.json({ error: "Pass a question as ?q=" }, { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
    return kbJson(req, () => apiSearch(q));
}
