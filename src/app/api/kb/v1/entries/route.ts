import { NextRequest } from "next/server";
import { kbJson } from "@/lib/help/apiResponse";
import { apiEntries } from "@/lib/help/api";

export async function GET(req: NextRequest) {
    return kbJson(req, () => apiEntries(req.nextUrl.searchParams.get("topic")));
}
