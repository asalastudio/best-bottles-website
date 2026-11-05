import { NextResponse } from "next/server";
import { readLocalComponentKits } from "@/lib/paper-doll/local-component-kits";
import { cylinderMasterSource } from "@/lib/products/cylinder-master";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const sku = url.searchParams.get("sku") ?? "";
    const source = cylinderMasterSource(sku);
    const version = url.searchParams.get("v");
    if (process.env.VERCEL || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        || source?.family !== "tall-sleek" || (version && version !== source.version)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const kit = readLocalComponentKits()?.[sku];
    if (kit?.register?.bodyId !== "tall-rectangle-10ml-13-415") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ kit, version: source.version }, { headers: { "Cache-Control": "private, no-store" } });
}
