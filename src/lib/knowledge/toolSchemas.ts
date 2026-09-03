import {
    APPLICATOR_BUCKET_VALUES,
    CANONICAL_GLASS_COLORS,
    CATALOG_CATEGORY_VALUES as CANONICAL_CATALOG_CATEGORY_VALUES,
    CATALOG_FAMILIES,
    PRODUCT_APPLICATOR_VALUES,
} from "../catalogFilters";

type JsonSchemaProperty = Record<string, unknown>;

const quoteList = (values: readonly string[]) => values.map((value) => `'${value}'`).join(", ");

export type GraceOpenAIToolSpec = {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: Record<string, JsonSchemaProperty>;
        required: string[];
        additionalProperties: false;
    };
};

const string = (description: string): JsonSchemaProperty => ({ type: "string", description });
const nullableString = (description: string): JsonSchemaProperty => ({ type: ["string", "null"], description });
const nullableNumber = (description: string): JsonSchemaProperty => ({ type: ["number", "null"], description });
const nullableBoolean = (description: string): JsonSchemaProperty => ({ type: ["boolean", "null"], description });
const nullableStringArray = (description: string): JsonSchemaProperty => ({
    type: ["array", "null"],
    items: { type: "string" },
    maxItems: 30,
    description,
});

/**
 * Catalog `category` values as stored on productGroups. The catalog filter does
 * an exact string match (`convex/products.ts` — `group.category === filters.category`),
 * so an invented value like "bottles" silently matches NOTHING and shows the
 * customer an empty catalog. The 2026-08-06 audit caught exactly that, so the
 * vocabulary is pinned here rather than left free-form.
 *
 * The catalog also contains an "Internal" category; it is intentionally omitted
 * so Grace can never surface internal-only rows to a customer.
 *
 * The list itself lives in src/lib/catalogFilters.ts so the sidebar, Convex and
 * this schema cannot disagree (tests/catalog-vocabulary-alignment.test.ts).
 */
export const CATALOG_CATEGORY_VALUES = CANONICAL_CATALOG_CATEGORY_VALUES;

const nullableCategory = (description: string): JsonSchemaProperty => ({
    type: ["string", "null"],
    enum: [...CATALOG_CATEGORY_VALUES, null],
    description,
});

const nullableApplicatorArray = (description: string): JsonSchemaProperty => ({
    type: ["array", "null"],
    items: {
        type: "string",
        enum: [...APPLICATOR_BUCKET_VALUES],
    },
    maxItems: APPLICATOR_BUCKET_VALUES.length,
    description,
});

function objectSchema(properties: Record<string, JsonSchemaProperty> = {}) {
    return {
        type: "object" as const,
        properties,
        required: Object.keys(properties),
        additionalProperties: false as const,
    };
}

function spec<const Name extends string>(
    name: Name,
    description: string,
    properties: Record<string, JsonSchemaProperty> = {},
): GraceOpenAIToolSpec & { name: Name } {
    return { name, description, parameters: objectSchema(properties) };
}

const productProposal = {
    type: "object",
    properties: {
        itemName: string("Verified customer-facing product name."),
        graceSku: string("Exact Grace SKU returned by a catalog tool."),
        quantity: { type: "integer", minimum: 1, description: "Requested whole-unit quantity greater than zero." },
        webPrice1pc: nullableNumber("Verified one-piece price, or null when unavailable."),
        websiteSku: nullableString("Website SKU returned by the catalog, or null."),
        shopifyVariantId: nullableString("Shopify variant ID returned by the catalog, or null."),
        checkoutEligible: nullableBoolean("Whether the returned product is checkout eligible."),
        webPrice10pc: nullableNumber("Verified ten-piece price, or null."),
        webPrice12pc: nullableNumber("Verified twelve-piece price, or null."),
    },
    required: [
        "itemName", "graceSku", "quantity", "webPrice1pc", "websiteSku",
        "shopifyVariantId", "checkoutEligible", "webPrice10pc", "webPrice12pc",
    ],
    additionalProperties: false,
};

export const GRACE_OPENAI_TOOL_SPECS = [
    spec("searchCatalog", "Search live Best Bottles product truth before making any product, price, stock, size, color, or SKU claim.", {
        searchTerm: string("Natural-language product request including known size, family, color, or applicator."),
        categoryLimit: nullableCategory("Exact category constraint — must be one of the listed exact values, or null."),
        familyLimit: nullableString(`Exact family constraint, or null. Valid values: ${quoteList(CATALOG_FAMILIES)}. Any other spelling matches nothing.`),
        applicatorFilter: nullableString(`Comma-separated EXACT catalog applicator values, or null. Valid values: ${quoteList(PRODUCT_APPLICATOR_VALUES)}. Do NOT pass the canonical Refine bucket slugs here (${APPLICATOR_BUCKET_VALUES.join(", ")}) — those belong to setCatalogRefinements.applicators and match NOTHING in this tool, silently filtering out the products you are looking for. When unsure, pass null and read the applicator field on the returned rows.`),
    }),
    spec("getProductBySku", "Look up ONE exact product by its SKU code. REQUIRED whenever the customer names or types a SKU (e.g. GB-CYL-CLR-9ML-T-08, CMP-CAP-SBLK-13-415) — searchCatalog is a name search and does NOT reliably match SKU codes. Accepts Grace or website SKUs. Also REQUIRED for any quantity/volume price quote: the result's priceTiers array is the full published quantity-break ladder (minQty/unitPrice/totalPrice, typically 5 breaks up to 1000+ pcs) — quote tiers from it verbatim and never extrapolate a bulk price. A null/found:false result means the code was not found as written; it does NOT mean the product is unavailable.", {
        sku: string("The exact SKU code the customer supplied, e.g. 'GB-CYL-CLR-9ML-T-08'."),
    }),
    spec("getPolicy", "Return verbatim published policy text for shipping, delivery times, international duties, damaged or incorrect items, returns, restocking, and support contact. REQUIRED before stating any policy term, window, or timeframe — never answer a policy question from memory.", {
        question: string("The customer's policy question, in their own words."),
    }),
    spec("getFamilyOverview", "Return verified sizes, colors, applicators, threads, counts, and price range for one bottle family.", {
        family: string("Exact bottle family name."),
    }),
    spec("getPriceStats", "Return authoritative price aggregation — exact min/max/median and the actual cheapest and most expensive items. REQUIRED for any cheapest, most expensive, budget, or price-range question; never infer price extremes from search results.", {
        family: nullableString("Exact bottle family to scope stats to, or null for catalog-wide."),
    }),
    spec("getBottleComponents", "Return fitment-verified components for a specific bottle SKU using its neck thread.", {
        bottleSku: string("Exact Grace or website SKU returned by a catalog tool."),
    }),
    spec("checkCompatibility", "Return bottles and components compatible with an exact neck-thread specification.", {
        threadSize: string("GPI neck thread such as 17-415 or 18-415."),
    }),
    spec("getCatalogStats", "Return current catalog counts from Convex; never use a memorized catalog total."),
    spec("getCurrentPageContext", "Read the customer's current page, product, active Refine state, and cart context."),
    spec("getCartContents", "Read current cart items and totals before proposing additions or moving to checkout."),
    spec("getBrowsingHistory", "Read recent in-session pages and searches to resolve references without asking the customer to repeat them."),
    spec("showProducts", "Search and move the customer to a verified filtered catalog or a single matching product page.", {
        query: string("Natural-language product query."),
        family: nullableString("Exact family constraint, or null."),
    }),
    spec("compareProducts", "Search and prepare a concise comparison of verified products without inventing specifications.", {
        query: string("Natural-language comparison query."),
        family: nullableString("Exact family constraint, or null."),
    }),
    spec("proposeCartAdd", "Show a cart confirmation proposal for verified purchasable products; never mutate the cart directly.", {
        products: { type: "array", items: productProposal, minItems: 1, maxItems: 12 },
    }),
    spec("proceedToCheckout", "Open the cart review flow after explicit customer intent; never place an order directly and require the customer to confirm checkout in the visible cart."),
    spec("navigateToPage", "Navigate to a verified Best Bottles path after explicit customer movement intent.", {
        path: string("Verified site-relative path."),
        title: string("Customer-facing destination title."),
        description: nullableString("Optional destination description, or null."),
        autoNavigate: nullableBoolean("True for explicit movement intent; false or null to show a link."),
        prefillFields: nullableString("Optional JSON object string for destination form fields, or null."),
    }),
    spec("showProductPresentation", "Render up to six verified product choices as cards without leaving the Grace conversation.", {
        searchTerm: string("Natural-language product search."),
        headline: nullableString("Optional presentation headline, or null."),
        familyLimit: nullableString("Exact family constraint, or null."),
    }),
    spec("prefillForm", "Populate a visible sample, quote, contact, or newsletter form for customer review.", {
        formType: string("One of sample, quote, contact, or newsletter."),
        fields: string("JSON object string containing already-collected form fields."),
    }),
    spec("updateFormField", "Update one visible form field with a value the customer supplied.", {
        formType: string("One of sample, quote, contact, or newsletter."),
        fieldName: string("Supported field name."),
        value: string("Exact customer-supplied value."),
    }),
    spec("submitForm", "Open the completed draft in a visible review form; never submit the form directly and require the customer to press Submit."),
    spec("displayProductCard", "Render one verified product inline without navigating away from Grace.", {
        graceSku: string("Exact Grace SKU returned by a catalog tool."),
    }),
    spec("displayFamilyCard", "Render a verified bottle-family card with selectable variants.", {
        family: string("Exact bottle family name."),
        capacityMl: nullableNumber("Requested capacity in milliliters, or null."),
    }),
    spec("displayCompatibility", "Render fitment-verified components for one exact bottle SKU.", {
        bottleSku: string("Exact bottle Grace SKU."),
    }),
    spec("displayBuildKit", "Render a fitment-verified bottle, closure, and applicator workspace.", {
        bottleSku: string("Exact bottle Grace SKU."),
        closureSku: nullableString("Compatible closure SKU from getBottleComponents, or null."),
        applicatorSku: nullableString("Compatible applicator SKU from getBottleComponents, or null."),
    }),
    spec("displayComparison", "Render a side-by-side specification comparison for two to four verified products.", {
        graceSkus: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
        dimensions: {
            type: ["array", "null"],
            items: { type: "string", enum: ["spec", "trueScale"] },
            description: "Optional rendering modes, or null.",
        },
    }),
    spec("displayCatalogStrip", "Render the available bottle families as a browseable catalog strip.", {
        category: nullableString("Optional category focus, or null."),
    }),
    spec("displayShortlist", "Create a shortlist from verified conversation products and optionally provide a share link.", {
        includeShareLink: nullableBoolean("Whether to mint a share link."),
    }),
    spec("displayAnatomy", "Render technical callouts for one verified product.", {
        graceSku: string("Exact Grace SKU returned by a catalog tool."),
    }),
    spec("setCatalogRefinements", "Update the visible catalog while inheriting every active Refine constraint unless the customer's exact words explicitly broaden one dimension.", {
        customerRequest: string("The customer's exact current request; used to authorize any broadening."),
        search: nullableString("New search phrase, or null to preserve the active search."),
        category: nullableCategory("Requested category — must be one of the listed exact values, or null. There is NO stock/availability filter: never claim results were limited to in-stock items."),
        collection: nullableString("Requested collection, or null."),
        applicators: nullableApplicatorArray("Requested canonical Refine applicator buckets, or null."),
        families: nullableStringArray(`Requested exact family values, or null. Valid values: ${quoteList(CATALOG_FAMILIES)}.`),
        colors: nullableStringArray(`Requested exact GLASS color values, or null. Canonical values: ${quoteList(CANONICAL_GLASS_COLORS)} ('Blue' and 'Cobalt' fold into 'Cobalt Blue'). This facet filters the BOTTLE GLASS only — cap, closure, plug, applicator, and trim colors are NOT refinable and a closure color placed here matches nothing (e.g. colors:['Black'] for a 'black plug' request returns zero groups because the glass is amber or clear). When the customer's color word describes the cap/plug/applicator, pass null here and use searchCatalog instead, answering from the rows' cap/closure colors.`),
        capacities: nullableStringArray("Requested exact capacity labels, or null. This is an EXACT SET, not a range: to honour 'under 15ml' or '15ml and smaller' you must enumerate every qualifying capacity (e.g. ['1 ml','3 ml','5 ml','9 ml','15 ml']). If you do not enumerate them, the size constraint is NOT applied — do not tell the customer the results are limited by size."),
        neckThreadSizes: nullableStringArray("Requested exact GPI neck threads, or null."),
        componentType: nullableString("Requested component type, or null."),
        priceMin: nullableNumber("Requested minimum price, or null."),
        priceMax: nullableNumber("Requested maximum price, or null. Price IS a true range filter."),
    }),
    spec("setPaperDollSelection", "Open and control the visible 9 mL 17-415 Cylinder Paper Doll using only an exact compatible configuration.", {
        glass: nullableString("Exact available glass label, or null to preserve it."),
        deliverySystem: {
            type: ["string", "null"],
            enum: ["rollon", "spray", "lotion", null],
            description: "Exact delivery system, or null to preserve it.",
        },
        rollerMaterial: {
            type: ["string", "null"],
            enum: ["Metal", "Plastic", null],
            description: "Roller material for roll-on configurations, or null.",
        },
        finish: nullableString("Exact compatible finish label, or null to preserve it."),
        configurationSku: nullableString("Exact verified 9 mL 17-415 configuration SKU, or null."),
        view: {
            type: "string",
            enum: ["beauty", "build"],
            description: "The media view to show after applying the selection.",
        },
    }),
    spec("prepareQuoteRequest", "Verify line items, prepare a structured RFQ, and move the customer to a reviewable quote form without submitting it.", {
        products: { type: "array", items: productProposal, minItems: 1, maxItems: 12 },
        name: nullableString("Customer name already supplied, or null."),
        email: nullableString("Customer email already supplied, or null."),
        company: nullableString("Customer company already supplied, or null."),
        phone: nullableString("Customer phone already supplied, or null."),
        message: nullableString("Customer quote notes already supplied, or null."),
    }),
    spec("listGraceProjects", "List the authenticated customer's existing Grace packaging projects; guests must be invited to sign in."),
    spec("proposeProjectSave", "Prepare a confirmation-gated save of one verified bottle to an authenticated Grace project; this tool must never write directly.", {
        graceSku: string("Exact verified Grace SKU to save."),
        projectId: nullableString("Existing Grace project ID, or null to create a new project after confirmation."),
        projectName: nullableString("New project name, or null for a dated default."),
        notes: nullableString("Customer-supplied notes for the saved bottle, or null."),
    }),
] satisfies GraceOpenAIToolSpec[];

export type GraceOpenAIToolName = (typeof GRACE_OPENAI_TOOL_SPECS)[number]["name"];
