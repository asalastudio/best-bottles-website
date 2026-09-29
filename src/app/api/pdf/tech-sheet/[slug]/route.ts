import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import type { ProductGroupPayload, ProductVariant } from "@/app/products/[slug]/ProductDetailClient";
import { filterVariantsForProductGroup } from "@/lib/productVariantIntegrity";
import { filterVariantsForGroupIntent } from "@/lib/products/group-variant-intent";
import { selectPrimaryProductVariant } from "@/lib/products/pdp-relations";
import { capacityEyebrow, fitmentLabel, glassLabel, pageTitle, techSheetRows } from "@/lib/products/pdp-redesign/model";
import { drawingBodyId } from "@/lib/products/pdp-redesign/drawings";
import { technicalDrawingFor } from "@/lib/products/pdp-redesign/tech-drawing";
import { resolveItemDescriptions } from "@/lib/products/item-description/resolve";
import { renderCatalogPdf } from "@/lib/pdf/catalog/puppeteer";
import { renderTechSheetHtml } from "@/lib/pdf/tech-sheet/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/pdf/tech-sheet/<group slug>?sku=<grace or website SKU>
 * The product page's "Download PDF": one branded US Letter page for the SKU
 * on screen (the group's primary SKU when none is given). ?format=html
 * returns the page before printing, for checking the layout.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const url = new URL(req.url);
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) return Response.json({ error: "Convex is not configured." }, { status: 500 });

    const convex = new ConvexHttpClient(convexUrl);
    const payload = await convex.query(api.products.getProductGroup, { slug }) as ProductGroupPayload | null;
    if (!payload) return Response.json({ error: `No product group "${slug}".` }, { status: 404 });

    const variants = filterVariantsForGroupIntent(slug, filterVariantsForProductGroup(payload.group, payload.variants));
    const sku = url.searchParams.get("sku");
    const variant: ProductVariant | null = (sku ? variants.find((entry) => entry.graceSku === sku || entry.websiteSku === sku) : null)
        ?? selectPrimaryProductVariant(payload.group, variants);
    if (!variant) return Response.json({ error: `No sellable SKU in "${slug}".` }, { status: 404 });

    const fitment = fitmentLabel(variant);
    const cap = variant.capColor?.trim() || null;
    const description = resolveItemDescriptions([variant]);
    const origin = url.origin;
    const html = await renderTechSheetHtml({
        title: pageTitle(payload.group, fitment),
        eyebrow: capacityEyebrow(payload.group),
        selection: [`${glassLabel(variant.color ?? payload.group.color)} glass`, fitment, cap ? `${cap} ${fitment ? "finish" : "cap"}` : null].filter(Boolean).join(" · "),
        websiteSku: variant.websiteSku ?? null,
        graceSku: variant.graceSku ?? null,
        rows: techSheetRows(variant, payload.group),
        description: description[variant.websiteSku ?? variant.graceSku]?.description ?? null,
        technical: technicalDrawingFor(drawingBodyId(slug)),
        wordmarkUrl: `${origin}/brand/best-bottles-wordmark-supplied.png`,
        generatedAt: new Date(),
    });

    if (url.searchParams.get("format") === "html") {
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
    }

    try {
        const pdf = await renderCatalogPdf(html);
        const name = `best-bottles-${(variant.websiteSku ?? slug).replace(/[^A-Za-z0-9._-]+/g, "-")}-tech-sheet.pdf`;
        return new Response(new Uint8Array(pdf), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${name}"`,
                "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
            },
        });
    } catch (error) {
        console.error("[tech-sheet] PDF render failed", error);
        return Response.json({ error: "The tech sheet could not be rendered." }, { status: 500 });
    }
}
