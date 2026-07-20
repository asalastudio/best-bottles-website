/**
 * Clean-slate wipe of Shopify product media for one product family.
 *
 * Jordan 2026-07-20: the store is pre-launch, so Cylinder PDPs may sit naked
 * while the approved Madison masters are generated and pushed. This removes
 * ALL media from every Shopify product in the family so subsequent
 * push-shopify-pdp-media runs land on clean products.
 *
 * Safety model:
 *   - DRY-RUN BY DEFAULT: prints per-product media counts, deletes nothing.
 *   - Always writes a recovery manifest (product id/handle/title + every media
 *     id/url + variant->image assignments) BEFORE any deletion, to
 *     pipeline/aios-shopify-pdp-images/<family>-media-wipe-manifest-<ts>.json
 *   - --apply performs productDeleteMedia per product (batched, best-effort,
 *     per-product error reporting, summary at the end).
 *
 * Usage:
 *   node scripts/aios-shopify-images/wipe-family-shopify-media.mjs --family Cylinder
 *   node scripts/aios-shopify-images/wipe-family-shopify-media.mjs --family Cylinder --apply
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

function loadEnv() {
    try {
        const raw = readFileSync(path.join(ROOT, ".env.local"), "utf8");
        for (const line of raw.split("\n")) {
            const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
            if (!match) continue;
            const key = match[1].trim();
            if (process.env[key] == null) {
                process.env[key] = match[2].trim().replace(/^["']|["']$/g, "");
            }
        }
    } catch {
        // Optional in CI.
    }
}

function argValue(name) {
    const index = process.argv.indexOf(name);
    if (index < 0) return undefined;
    const value = process.argv[index + 1];
    return value && !value.startsWith("--") ? value : undefined;
}

loadEnv();

const FAMILY = argValue("--family");
const APPLY = process.argv.includes("--apply");
const SHOPIFY_DOMAIN = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = "2025-01";

if (!FAMILY) {
    console.error("--family is required (e.g. --family Cylinder)");
    process.exit(1);
}
if (!SHOPIFY_DOMAIN || !SHOPIFY_TOKEN) {
    console.error("Missing NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN env.");
    process.exit(1);
}

async function shopifyGraphQL(query, variables) {
    const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": SHOPIFY_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Shopify HTTP ${res.status}: ${text.slice(0, 500)}`);
    const json = JSON.parse(text);
    if (json.errors?.length) {
        throw new Error(`Shopify GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
    }
    return json.data;
}

async function fetchFamilyProductsWithMedia() {
    const products = [];
    let cursor = null;
    const query = `
      query FamilyProducts($first: Int!, $after: String, $query: String) {
        products(first: $first, after: $after, query: $query) {
          edges {
            cursor
            node {
              id
              handle
              title
              media(first: 250) {
                nodes {
                  __typename
                  ... on MediaImage { id alt image { url } }
                }
              }
              variants(first: 100) {
                nodes { id sku image { id url } }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    while (true) {
        const data = await shopifyGraphQL(query, {
            first: 50,
            after: cursor,
            query: `product_type:${FAMILY}`,
        });
        for (const edge of data.products.edges) products.push(edge.node);
        if (!data.products.pageInfo.hasNextPage) return products;
        cursor = data.products.pageInfo.endCursor;
    }
}

async function main() {
    console.log(`=== ${FAMILY} Shopify media wipe — ${APPLY ? "APPLY" : "DRY RUN"} ===`);
    console.log(`store: ${SHOPIFY_DOMAIN}`);
    const products = await fetchFamilyProductsWithMedia();
    const withMedia = products.filter((p) => p.media.nodes.length > 0);
    const totalMedia = products.reduce((sum, p) => sum + p.media.nodes.length, 0);

    // Recovery manifest FIRST, always.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const manifestDir = path.join(ROOT, "pipeline/aios-shopify-pdp-images");
    mkdirSync(manifestDir, { recursive: true });
    const manifestPath = path.join(
        manifestDir,
        `${FAMILY.toLowerCase()}-media-wipe-manifest-${stamp}.json`,
    );
    writeFileSync(
        manifestPath,
        JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                store: SHOPIFY_DOMAIN,
                family: FAMILY,
                mode: APPLY ? "apply" : "dry-run",
                totals: { products: products.length, productsWithMedia: withMedia.length, media: totalMedia },
                products: products.map((p) => ({
                    id: p.id,
                    handle: p.handle,
                    title: p.title,
                    media: p.media.nodes.map((m) => ({ id: m.id, alt: m.alt ?? null, url: m.image?.url ?? null })),
                    variants: p.variants.nodes.map((v) => ({ id: v.id, sku: v.sku, imageId: v.image?.id ?? null, imageUrl: v.image?.url ?? null })),
                })),
            },
            null,
            1,
        ),
    );
    console.log(`manifest: ${path.relative(ROOT, manifestPath)}`);
    console.log(`products: ${products.length}  with media: ${withMedia.length}  media items: ${totalMedia}`);

    if (!APPLY) {
        for (const p of withMedia.slice(0, 10)) {
            console.log(`  ${p.handle}: ${p.media.nodes.length} media`);
        }
        if (withMedia.length > 10) console.log(`  … and ${withMedia.length - 10} more products`);
        console.log("\nDRY RUN — nothing deleted. Re-run with --apply to delete.");
        return;
    }

    const mutation = `
      mutation WipeProductMedia($productId: ID!, $mediaIds: [ID!]!) {
        productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
          deletedMediaIds
          mediaUserErrors { field message }
        }
      }
    `;
    let deleted = 0;
    const failures = [];
    for (const [index, p] of withMedia.entries()) {
        const mediaIds = p.media.nodes.map((m) => m.id);
        try {
            const data = await shopifyGraphQL(mutation, { productId: p.id, mediaIds });
            const result = data.productDeleteMedia;
            deleted += result.deletedMediaIds?.length ?? 0;
            if (result.mediaUserErrors?.length) {
                failures.push({ handle: p.handle, errors: result.mediaUserErrors });
            }
            console.log(`[${index + 1}/${withMedia.length}] ${p.handle}: deleted ${result.deletedMediaIds?.length ?? 0}/${mediaIds.length}`);
        } catch (error) {
            failures.push({ handle: p.handle, errors: [{ message: String(error) }] });
            console.error(`[${index + 1}/${withMedia.length}] ${p.handle}: FAILED — ${error}`);
        }
        // Gentle pacing for the Admin API cost budget.
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    console.log(`\nDONE. media deleted: ${deleted}/${totalMedia}  product failures: ${failures.length}`);
    for (const f of failures.slice(0, 10)) console.log("  FAIL", f.handle, JSON.stringify(f.errors).slice(0, 150));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
