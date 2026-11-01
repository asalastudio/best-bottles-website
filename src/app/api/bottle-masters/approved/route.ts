import { NextResponse } from "next/server";
import { approvedComponentKit, APPROVED_KIT_VERSION } from "@/lib/paper-doll/approved-component-kits";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const version = url.searchParams.get("v");
    if (version && version !== APPROVED_KIT_VERSION) return NextResponse.json({ error: "Unknown master version" }, { status: 404 });
    const kit = approvedComponentKit(url.searchParams.get("sku"));
    if (!kit) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ kit, version: APPROVED_KIT_VERSION }, {
        headers: { "Cache-Control": version ? "public, max-age=31536000, immutable" : "public, max-age=0, s-maxage=300" },
    });
}
