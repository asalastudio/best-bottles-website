import { NextRequest } from "next/server";
import { kbJson } from "@/lib/help/apiResponse";
import { buildKbOpenApi } from "@/lib/help/openapi";

export async function GET(req: NextRequest) {
    return kbJson(req, buildKbOpenApi);
}
