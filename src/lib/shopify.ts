/**
 * Shopify Commerce Adapter
 *
 * Single module for all Shopify Admin API access. Nothing else in the
 * codebase should call Shopify directly — everything goes through here.
 *
 * Capabilities:
 * - SKU → variant resolution (checkout flow)
 * - Product + variant reads by handle, GID, or SKU
 * - Metafield reads for packaging attributes
 * - Inventory level reads
 * - Checkout URL generation
 */

const API_VERSION = "2025-01";

// ─── Domain helper ────────────────────────────────────────────────────────────

export function getShopifyDomain(): string {
    const raw = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "";
    return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// ─── Checkout URL builder (no token required) ────────────────────────────────

export interface CheckoutLineItem {
    /** Numeric Shopify variant ID (not the GID) */
    variantId: string;
    quantity: number;
}

export function buildCheckoutUrl(items: CheckoutLineItem[]): string {
    const domain = getShopifyDomain();
    const lineItems = items.map((i) => `${i.variantId}:${i.quantity}`).join(",");
    return `https://${domain}/cart/${lineItems}`;
}

// ─── Admin API GraphQL client ────────────────────────────────────────────────

interface AdminGqlResult<T> {
    data: T;
    errors?: Array<{ message: string }>;
}

export async function adminGraphQL<T>(
    query: string,
    variables?: Record<string, unknown>,
): Promise<T> {
    const domain = getShopifyDomain();
    const token = process.env.SHOPIFY_ADMIN_TOKEN;

    if (!token) throw new Error("SHOPIFY_ADMIN_TOKEN not set");

    const res = await fetch(
        `https://${domain}/admin/api/${API_VERSION}/graphql.json`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": token,
            },
            body: JSON.stringify({ query, variables }),
        },
    );

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Shopify Admin API ${res.status}: ${text}`);
    }

    const json = (await res.json()) as AdminGqlResult<T>;
    if (json.errors?.length) {
        throw new Error(
            `Shopify GQL: ${json.errors.map((e) => e.message).join(", ")}`,
        );
    }
    return json.data;
}

// ─── GID helpers ─────────────────────────────────────────────────────────────

export function numericId(gid: string): string {
    return gid.split("/").pop() ?? gid;
}

// ─── Variant resolver (SKU → Shopify variant) ───────────────────────────────

export interface ResolvedVariant {
    sku: string;
    variantId: string;
    variantGid: string;
    productGid: string;
    productTitle: string;
    available: boolean;
    price: string;
}

export async function resolveVariantsBySkus(
    skus: string[],
): Promise<ResolvedVariant[]> {
    const resolved: ResolvedVariant[] = [];

    for (const sku of skus) {
        try {
            const data = await adminGraphQL<{
                productVariants: {
                    edges: Array<{
                        node: {
                            id: string;
                            sku: string;
                            availableForSale: boolean;
                            price: string;
                            product: { id: string; title: string };
                        };
                    }>;
                };
            }>(
                `query VariantBySku($query: String!) {
                    productVariants(first: 1, query: $query) {
                        edges {
                            node {
                                id
                                sku
                                availableForSale
                                price
                                product { id title }
                            }
                        }
                    }
                }`,
                { query: `sku:${sku}` },
            );

            const node = data.productVariants.edges[0]?.node;
            if (node) {
                resolved.push({
                    sku,
                    variantId: numericId(node.id),
                    variantGid: node.id,
                    productGid: node.product.id,
                    productTitle: node.product.title,
                    available: node.availableForSale,
                    price: node.price,
                });
            }
        } catch (err) {
            console.error(`[Shopify] Failed to resolve SKU "${sku}":`, err);
        }
    }

    return resolved;
}

// ─── Product reads ───────────────────────────────────────────────────────────

export interface ShopifyProduct {
    id: string;
    title: string;
    handle: string;
    productType: string;
    status: string;
    descriptionHtml: string;
    images: Array<{ url: string; altText: string | null }>;
    options: Array<{ name: string; values: string[] }>;
    variants: Array<ShopifyVariant>;
    metafields: Array<{ namespace: string; key: string; value: string; type: string }>;
}

export interface ShopifyVariant {
    id: string;
    sku: string;
    title: string;
    price: string;
    availableForSale: boolean;
    selectedOptions: Array<{ name: string; value: string }>;
    inventoryQuantity: number | null;
}

const PRODUCT_FIELDS = `
    id title handle productType status descriptionHtml
    images(first: 10) { edges { node { url altText } } }
    options { name values }
    variants(first: 100) {
        edges {
            node {
                id sku title price availableForSale
                selectedOptions { name value }
                inventoryQuantity
            }
        }
    }
    metafields(first: 20, namespace: "custom") {
        edges { node { namespace key value type } }
    }
`;

function parseProduct(raw: Record<string, unknown>): ShopifyProduct {
    const r = raw as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    return {
        id: r.id,
        title: r.title,
        handle: r.handle,
        productType: r.productType ?? "",
        status: r.status ?? "",
        descriptionHtml: r.descriptionHtml ?? "",
        images: (r.images?.edges ?? []).map((e: any) => e.node), // eslint-disable-line @typescript-eslint/no-explicit-any
        options: r.options ?? [],
        variants: (r.variants?.edges ?? []).map((e: any) => e.node), // eslint-disable-line @typescript-eslint/no-explicit-any
        metafields: (r.metafields?.edges ?? []).map((e: any) => e.node), // eslint-disable-line @typescript-eslint/no-explicit-any
    };
}

export async function getProductByHandle(
    handle: string,
): Promise<ShopifyProduct | null> {
    const data = await adminGraphQL<{
        productByHandle: Record<string, unknown> | null;
    }>(
        `query ProductByHandle($handle: String!) {
            productByHandle(handle: $handle) { ${PRODUCT_FIELDS} }
        }`,
        { handle },
    );
    return data.productByHandle ? parseProduct(data.productByHandle) : null;
}

export async function getProductByGid(
    gid: string,
): Promise<ShopifyProduct | null> {
    const data = await adminGraphQL<{
        product: Record<string, unknown> | null;
    }>(
        `query ProductByGid($id: ID!) {
            product(id: $id) { ${PRODUCT_FIELDS} }
        }`,
        { id: gid },
    );
    return data.product ? parseProduct(data.product) : null;
}

// ─── Paginated product list (for sync/audit) ────────────────────────────────

export async function getAllProducts(
    onPage?: (products: ShopifyProduct[]) => void,
): Promise<ShopifyProduct[]> {
    const all: ShopifyProduct[] = [];
    let cursor: string | null = null;
    let hasNext = true;

    type ProductsPage = {
        products: {
            edges: Array<{ node: Record<string, unknown>; cursor: string }>;
            pageInfo: { hasNextPage: boolean };
        };
    };

    while (hasNext) {
        const afterPart: string = cursor ? `, after: "${cursor}"` : "";
        const query = `{ products(first: 50${afterPart}) {
                edges { cursor node { ${PRODUCT_FIELDS} } }
                pageInfo { hasNextPage }
            } }`;
        const data = await adminGraphQL<ProductsPage>(query);

        const page = data.products.edges.map((edge: { node: Record<string, unknown> }) =>
            parseProduct(edge.node),
        );
        all.push(...page);
        onPage?.(page);

        cursor = data.products.edges.at(-1)?.cursor ?? null;
        hasNext = data.products.pageInfo.hasNextPage;
    }

    return all;
}

// ─── Inventory reads ─────────────────────────────────────────────────────────

export interface InventoryLevel {
    inventoryItemId: string;
    locationId: string;
    available: number;
}

export async function getInventoryLevels(
    inventoryItemIds: string[],
): Promise<InventoryLevel[]> {
    if (inventoryItemIds.length === 0) return [];

    const levels: InventoryLevel[] = [];

    for (const itemId of inventoryItemIds) {
        try {
            const data = await adminGraphQL<{
                inventoryItem: {
                    id: string;
                    inventoryLevels: {
                        edges: Array<{
                            node: {
                                location: { id: string };
                                quantities: Array<{ name: string; quantity: number }>;
                            };
                        }>;
                    };
                } | null;
            }>(
                `query InventoryLevel($id: ID!) {
                    inventoryItem(id: $id) {
                        id
                        inventoryLevels(first: 10) {
                            edges {
                                node {
                                    location { id }
                                    quantities(names: ["available"]) {
                                        name quantity
                                    }
                                }
                            }
                        }
                    }
                }`,
                { id: itemId },
            );

            if (data.inventoryItem) {
                for (const edge of data.inventoryItem.inventoryLevels.edges) {
                    const avail = edge.node.quantities.find(
                        (q) => q.name === "available",
                    );
                    levels.push({
                        inventoryItemId: data.inventoryItem.id,
                        locationId: edge.node.location.id,
                        available: avail?.quantity ?? 0,
                    });
                }
            }
        } catch (err) {
            console.error(
                `[Shopify] Failed to get inventory for ${itemId}:`,
                err,
            );
        }
    }

    return levels;
}

// ─── Metafield definitions (for setup scripts) ──────────────────────────────

export interface MetafieldDefinitionInput {
    name: string;
    namespace: string;
    key: string;
    type: string;
    ownerType: string;
    description?: string;
}

export async function createMetafieldDefinition(
    input: MetafieldDefinitionInput,
): Promise<{ id: string } | null> {
    const data = await adminGraphQL<{
        metafieldDefinitionCreate: {
            createdDefinition: { id: string } | null;
            userErrors: Array<{ message: string }>;
        };
    }>(
        `mutation CreateMetafieldDef($definition: MetafieldDefinitionInput!) {
            metafieldDefinitionCreate(definition: $definition) {
                createdDefinition { id }
                userErrors { message }
            }
        }`,
        {
            definition: {
                name: input.name,
                namespace: input.namespace,
                key: input.key,
                type: input.type,
                ownerType: input.ownerType,
                description: input.description,
            },
        },
    );

    const result = data.metafieldDefinitionCreate;
    if (result.userErrors.length > 0) {
        const msgs = result.userErrors.map((e) => e.message).join(", ");
        if (msgs.includes("already exists")) {
            console.log(
                `[Shopify] Metafield ${input.namespace}.${input.key} already exists, skipping`,
            );
            return null;
        }
        throw new Error(`Metafield creation failed: ${msgs}`);
    }

    return result.createdDefinition;
}
