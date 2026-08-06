/**
 * Grace policy corpus — audit P0-2 (2026-08-06).
 *
 * Grace had NO policy tool: asked about returns she called zero tools and
 * fabricated a "2 business days" damage window when the published policy says
 * 7 days. Every statement below is copied VERBATIM from the customer-facing
 * policy pages so Grace answers from source rather than from model priors.
 *
 * SOURCE OF TRUTH: the `sourcePath` page of each section. `tests/grace-policy-corpus.test.ts`
 * asserts each `text` still appears in that page's source — if a page changes
 * and this file does not, the test fails rather than Grace drifting silently.
 */

export type GracePolicySection = {
    topic: string;
    /** Keywords that should route a customer question to this section. */
    matches: string[];
    /** Verbatim policy text. Never paraphrase numbers out of this string. */
    text: string;
    sourcePath: string;
    sourceUrl: string;
};

export const GRACE_POLICY_SECTIONS: GracePolicySection[] = [
    {
        topic: "Shipping — origin and dispatch time",
        matches: ["ship", "shipping", "dispatch", "how long", "lead time", "warehouse", "where do you ship from"],
        text: "Orders ship from our Union City, California warehouse. In-stock items typically ship within 1–3 business days.",
        sourcePath: "src/app/shipping-returns/page.tsx",
        sourceUrl: "/shipping-returns",
    },
    {
        topic: "Shipping — carriers, rates, free-shipping thresholds",
        matches: ["carrier", "rate", "cost of shipping", "free shipping", "shipping price", "expedited", "overnight"],
        text: "We ship via major carriers. Available shipping options, rates, and any free-shipping thresholds are shown at checkout based on your order and destination.",
        sourcePath: "src/app/shipping-returns/page.tsx",
        sourceUrl: "/shipping-returns",
    },
    {
        topic: "Shipping — international, duties and taxes",
        matches: ["international", "overseas", "customs", "duties", "taxes", "import"],
        text: "Domestic and international shipping are available; international transit times and any duties or taxes vary by destination and are the recipient's responsibility.",
        sourcePath: "src/app/shipping-returns/page.tsx",
        sourceUrl: "/shipping-returns",
    },
    {
        topic: "Packing — glass fragility",
        matches: ["packing", "packaging", "fragile", "breakage", "protect", "inspect"],
        text: "Because glass is fragile, orders are packed to protect against transit damage. Please inspect your shipment on arrival.",
        sourcePath: "src/app/shipping-returns/page.tsx",
        sourceUrl: "/shipping-returns",
    },
    {
        topic: "Damaged or incorrect items — 7 day window",
        matches: ["damaged", "damage", "broken", "wrong item", "incorrect", "missing", "claim", "replacement", "credit"],
        text: "If your order arrives damaged, or if you receive the wrong item, contact us within 7 days of delivery with your order number and photos of the packaging and product. We will arrange a replacement or credit for verified damage or fulfillment errors.",
        sourcePath: "src/app/shipping-returns/page.tsx",
        sourceUrl: "/shipping-returns",
    },
    {
        topic: "Returns — 30 day window, restocking, exclusions",
        matches: ["return", "returns", "refund", "send back", "rma", "return authorization", "restocking", "exchange"],
        text: "To request a return of unused, undamaged product in its original packaging, contact us within 30 days of delivery for a return authorization. Return shipping and any applicable restocking fee are the customer's responsibility unless the return is due to our error. Custom, decorated, and clearance items are not returnable.",
        sourcePath: "src/app/shipping-returns/page.tsx",
        sourceUrl: "/shipping-returns",
    },
    {
        topic: "Support contact",
        matches: ["contact", "support", "email", "help", "reach", "who do i talk to"],
        text: "For shipping, returns, damage claims, or sample requests, contact sales@nematinternational.com.",
        sourcePath: "src/app/shipping-returns/page.tsx",
        sourceUrl: "/shipping-returns",
    },
];

/** Topics we have NO published policy for — Grace must not invent these. */
export const GRACE_POLICY_GAPS = [
    "warranty or breakage guarantee terms",
    "minimum order value",
    "specific shipping rates or delivery-date guarantees",
    "payment terms, credit accounts, or net terms",
    "price-match or discount policies",
];

export function selectPolicySections(question: string): GracePolicySection[] {
    const q = question.toLowerCase();
    const hits = GRACE_POLICY_SECTIONS.filter((s) => s.matches.some((m) => q.includes(m)));
    return hits.length > 0 ? hits : GRACE_POLICY_SECTIONS;
}

export function buildPolicyToolResult(question: string) {
    const sections = selectPolicySections(question);
    return {
        found: true,
        question,
        sections: sections.map((s) => ({
            topic: s.topic,
            policyText: s.text,
            source: s.sourceUrl,
        })),
        noPublishedPolicyFor: GRACE_POLICY_GAPS,
        guidance:
            "State these terms using the exact numbers in policyText — never round, soften, or infer a different window. If the customer asks about something listed in noPublishedPolicyFor, say we don't publish that term and offer to connect them with the team; do not invent it.",
    };
}
