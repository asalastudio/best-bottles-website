import { NextResponse } from "next/server";
import { approvedComponentKit, originalApprovedComponentKit, APPROVED_KIT_VERSION } from "@/lib/paper-doll/approved-component-kits";
import { CYLINDER9_COLOR_VERSION, updatedCylinderKitVersion } from "@/lib/paper-doll/approved-kit-index";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const version = url.searchParams.get("v");
    const sku = url.searchParams.get("sku");
    const colorVersion = /^(?:GBCyl|LBCyl)(?:Amb|Blu)9/.test(sku ?? "") && version === CYLINDER9_COLOR_VERSION;
    const updatedVersion = updatedCylinderKitVersion(sku);
    if (version && version !== APPROVED_KIT_VERSION && !colorVersion && version !== updatedVersion) return NextResponse.json({ error: "Unknown master version" }, { status: 404 });
    const kit = version === APPROVED_KIT_VERSION ? originalApprovedComponentKit(sku) : approvedComponentKit(sku);
    if (!kit) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ kit, version: colorVersion ? CYLINDER9_COLOR_VERSION : version && version === updatedVersion ? updatedVersion : APPROVED_KIT_VERSION }, {
        headers: { "Cache-Control": version ? "public, max-age=31536000, immutable" : "public, max-age=0, s-maxage=300" },
    });
}
