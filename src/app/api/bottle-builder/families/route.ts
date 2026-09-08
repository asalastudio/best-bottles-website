import { NextResponse } from "next/server";
import { loadBuilderFamilies } from "@/lib/bottle-builder/server";

export async function GET() {
    try {
        return NextResponse.json({ families: await loadBuilderFamilies() });
    } catch {
        return NextResponse.json({ error: "We couldn’t load the other bottle families. Please try again." }, { status: 503 });
    }
}
