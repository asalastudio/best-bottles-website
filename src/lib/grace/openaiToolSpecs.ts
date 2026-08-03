type JsonSchemaProperty = Record<string, unknown>;

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

function spec(name: string, description: string, properties: Record<string, JsonSchemaProperty> = {}): GraceOpenAIToolSpec {
    return { name, description, parameters: objectSchema(properties) };
}

const productProposal = {
    type: "object",
    properties: {
        itemName: string("Verified customer-facing product name."),
        graceSku: string("Exact Grace SKU returned by a catalog tool."),
        quantity: { type: "number", description: "Requested quantity greater than zero." },
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

export const GRACE_OPENAI_TOOL_SPECS: GraceOpenAIToolSpec[] = [
    spec("searchCatalog", "Search live Best Bottles product truth before making any product, price, stock, size, color, or SKU claim.", {
        searchTerm: string("Natural-language product request including known size, family, color, or applicator."),
        categoryLimit: nullableString("Exact category constraint, or null."),
        familyLimit: nullableString("Exact family constraint, or null."),
        applicatorFilter: nullableString("Comma-separated catalog applicator values, or null."),
    }),
    spec("getFamilyOverview", "Return verified sizes, colors, applicators, threads, counts, and price range for one bottle family.", {
        family: string("Exact bottle family name."),
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
    spec("proceedToCheckout", "Open the cart review flow only after the customer explicitly asks to check out."),
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
    spec("submitForm", "Submit the reviewed form only after the customer explicitly confirms submission."),
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
        category: nullableString("Requested category, or null."),
        collection: nullableString("Requested collection, or null."),
        applicators: nullableStringArray("Requested Refine applicator values, or null."),
        families: nullableStringArray("Requested exact family values, or null."),
        colors: nullableStringArray("Requested exact color values, or null."),
        capacities: nullableStringArray("Requested exact capacity labels, or null."),
        neckThreadSizes: nullableStringArray("Requested exact GPI neck threads, or null."),
        componentType: nullableString("Requested component type, or null."),
        priceMin: nullableNumber("Requested minimum price, or null."),
        priceMax: nullableNumber("Requested maximum price, or null."),
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
];

export type GraceOpenAIToolName = (typeof GRACE_OPENAI_TOOL_SPECS)[number]["name"];
