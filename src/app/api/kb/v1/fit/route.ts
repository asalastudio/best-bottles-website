import { NextRequest } from "next/server";
import { kbJson } from "@/lib/help/apiResponse";
import { apiBottles } from "@/lib/help/api";

export async function GET(req: NextRequest) {
    return kbJson(req, apiBottles);
}
