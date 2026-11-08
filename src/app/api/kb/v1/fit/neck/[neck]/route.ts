import { NextRequest } from "next/server";
import { kbJson } from "@/lib/help/apiResponse";
import { apiNeck } from "@/lib/help/api";

export async function GET(req: NextRequest, { params }: { params: Promise<{ neck: string }> }) {
    const { neck } = await params;
    return kbJson(req, () => apiNeck(decodeURIComponent(neck)), "No builder for that neck finish yet. 13-415 is available.");
}
