import { NextResponse } from "next/server";
import { z } from "zod";
import { freshConfiguration } from "@/lib/bottle-builder/server";
import { builderCartItem, MAX_QUANTITY } from "@/lib/bottle-builder/model";

const input = z.object({
    family: z.string().min(1).max(100), sku: z.string().min(1).max(120),
    selection: z.object({ bodyId: z.string(), color: z.string(), fitment: z.string(), closure: z.string(), quantity: z.number().int().min(1).max(MAX_QUANTITY) }),
});

/** Read-only preflight. It does not create a Shopify cart or mutate the catalog. */
export async function POST(request: Request) {
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Complete your bottle and enter a valid quantity." }, { status: 400 });
    try {
        const { family, sku, selection } = parsed.data;
        const configuration = await freshConfiguration(family, sku);
        if (!configuration || configuration.bodyId !== selection.bodyId || configuration.color !== selection.color
            || configuration.fitment !== selection.fitment || configuration.closure !== selection.closure) {
            return NextResponse.json({ error: "This combination is no longer available. Refresh the builder to see current options." }, { status: 409 });
        }
        builderCartItem(configuration, selection.quantity);
        return NextResponse.json({ configuration }, { headers: { "Cache-Control": "no-store" } });
    } catch {
        return NextResponse.json({ error: "We couldn’t check availability. Please try again." }, { status: 503 });
    }
}
