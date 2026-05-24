import { NextResponse } from "next/server";
import { searchCatalogServer, type CatalogSearchArgs } from "@/lib/catalogServer";

export async function POST(request: Request) {
    try {
        const args = await request.json() as CatalogSearchArgs;
        const result = await searchCatalogServer(args);
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Catalog search failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
