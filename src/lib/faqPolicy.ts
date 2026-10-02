/**
 * Sole approved FAQ authority, designated by Jordan on 2026-10-02.
 * Shared by site pages, Realtime getPolicy, and the Convex fallback prompt.
 * This is published FAQ copy, NOT checkout configuration or legal/tax advice.
 * Evidence and unresolved source/configuration issues: docs/audits/faq-policy-2026-10-02/.
 */
export const FAQ_POLICY_SOURCE = {
    url: "https://www.bestbottles.com/faq.php",
    verifiedOn: "2026-10-02",
    snapshotPath: "docs/audits/faq-policy-2026-10-02/legacy-faq.html.gz",
    authority: "Sole approved current FAQ until the remaining policies are reviewed",
} as const;

export type FaqPolicyEntry = {
    id: string;
    q: string;
    a: string;
    sourceQuestion: string;
    matches: string[];
};

export const FAQ_POLICY_ENTRIES: FaqPolicyEntry[] = [
    {
        id: "minimum-order", q: "What is the minimum order?",
        a: "The minimum order is $50.00, excluding shipping charges. Verified businesses can purchase samples below this minimum through the emailed sample-order process.",
        sourceQuestion: "Is there a minimum dollar amount or quantity amount to place orders?",
        matches: ["minimum", "small order", "sample", "quantity", "50", "moq"],
    },
    {
        id: "samples", q: "How can I purchase samples below the minimum?",
        a: "Customers with verified businesses can email a list of samples with item codes to sales@nematinternational.com. The team will email an invoice. Payment can be made through PayPal to that email address or by calling 1-800-936-3628 with credit card information. Office hours are Monday–Friday, 9:30am–5:30pm PST.",
        sourceQuestion: "I want to try some samples before placing a larger quantity order.",
        matches: ["minimum", "small order", "sample", "quantity", "50", "moq"],
    },
    {
        id: "ordering", q: "How can I place an order?",
        a: "Please place orders online. For help before ordering or navigating the website, call 1-800-936-3628 or email sales@nematinternational.com. The FAQ separately describes phone arrangements for samples, same-day shipping, and warehouse pickup.",
        sourceQuestion: "How can I place an order?",
        matches: ["place an order", "order online", "phone order"],
    },
    {
        id: "lead-times", q: "How long does a domestic order take?",
        a: "Domestic processing takes 2–3 business days, followed by an estimated 1–5 business days in transit depending on location. Business days exclude weekends and holidays. September–December processing may take up to 4–5 business days before shipping. The FAQ's separate order-change answer says most orders are processed within 1–3 days of receipt; these statements differ, so contact the team to confirm timing for your order.",
        sourceQuestion: "If I place my order today, how long does it take to receive my order?",
        matches: ["ship", "delivery", "transit", "process", "lead time", "how long", "change", "cancel", "add to my order"],
    },
    {
        id: "shipping-options", q: "What are the shipping options and charges?",
        a: "Most packages ship through UPS, with Ground, 3-Day, 2-Day, and Overnight options; USPS may also be used. Charges depend on destination ZIP code, approximate product weight, and service selected. UPS does not deliver to P.O. Boxes or APO/AFO addresses according to the FAQ. Larger orders may use multiple boxes; in general, boxes do not exceed 40 lbs. Shipment emails provide tracking numbers, potentially in multiple emails for separate shipments.",
        sourceQuestion: "What are my shipping options?",
        matches: ["ship", "carrier", "rate", "delivery", "tracking", "box", "boxes", "carton", "po box", "p.o."],
    },
    {
        id: "same-day", q: "Do you offer same-day shipping?",
        a: "Call 800-936-3628 to request same-day shipping; requests are not accepted by email. Orders must be placed before 11:00am PST, and orders after that time are not guaranteed to ship that day. A mandatory $15 fee applies without exception. Availability must be confirmed because certain products are excluded: international orders, personalized products, Saturday/Sunday/holiday orders, and some large, oversize, or special-order items. PST is the FAQ's published label; confirm the local cutoff with the team rather than assuming a daylight-saving conversion.",
        sourceQuestion: "Do you offer same day shipping?",
        matches: ["ship", "same day", "same-day", "rush", "cutoff", "11", "pst"],
    },
    {
        id: "pickup", q: "Can I pick up my order?",
        a: "Call at least 1 day ahead of your visit and place your order for warehouse pickup. Pickup hours are 10:30am–3:00pm. The contact address is Nemat International, Inc., 34135 7th Street, Union City, CA 94587, USA. The pickup answer does not specify a timezone or say 'business day'; confirm arrangements with the team.",
        sourceQuestion: "Can I pick up my order from your warehouse?",
        matches: ["pickup", "pick up", "warehouse", "address", "collect"],
    },
    {
        id: "international-shipping", q: "Do you ship internationally?",
        a: "Yes, the FAQ says worldwide shipping is available and international orders should be placed online. Most international packages use UPS International economy or priority service; Russia and some other destinations use US priority mail. Most UPS International economy orders arrive within 1–2 weeks of full payment; US priority mail may take longer. Charges depend on country, postal code, approximate weight, and oversize items. Customers are responsible for duties, taxes, brokerage fees, and checking country-specific import rules.",
        sourceQuestion: "Do you ship internationally?",
        matches: ["international", "overseas", "worldwide", "customs", "duties", "tax", "import", "canada"],
    },
    {
        id: "canada", q: "What should I know about shipping to Canada?",
        a: "The FAQ prefers UPS international economy or priority service. UPS Ground may have a lower shipping quote but adds brokerage charges payable to UPS before receipt. Brokerage is included in the online quote for UPS International economy or priority service. Canadian duties and taxes are additional and payable by the customer before receipt.",
        sourceQuestion: "Shipping to Canada",
        matches: ["canada", "brokerage", "international", "duties"],
    },
    {
        id: "payments", q: "What payment methods are described in the FAQ?",
        a: "The FAQ accepts PayPal, Visa, Mastercard, American Express, Discover, and business checks. Check orders ship only after payment is received and the check clears. Prepaid or gift cards require a registered billing address. Large orders and some international orders may require bank wire payment. The FAQ describes card or PayPal payment during online checkout. Prices are in US dollars; contact the team if a published method is unavailable for your order.",
        sourceQuestion: "What are my payment options?",
        matches: ["pay", "card", "check", "wire", "currency", "dollar", "billing"],
    },
    {
        id: "international-payment", q: "When is my international order charged?",
        a: "In its international-payment answer, the FAQ says credit cards are charged when the order is ready for shipping, rather than when placed. PayPal payments transfer from your account to the company's account. Large orders may require a wire transfer. This timing statement is specific to the international-payment answer; contact the team to confirm your order's payment arrangements.",
        sourceQuestion: "How do I pay for my international order?",
        matches: ["pay", "card", "charg", "international", "billing"],
    },
    {
        id: "sales-tax", q: "What does the FAQ say about sales tax?",
        a: "The FAQ states that California destinations are charged current California sales tax, that California resellers should send a current valid resale license number by email or fax, and that destinations outside California are not charged sales tax. This is the published FAQ statement; contact the team about applicability or a difference in your checkout. It is not a determination of tax obligations for your order.",
        sourceQuestion: "Payments for sales Tax , customs duties and fees",
        matches: ["tax", "resale", "reseller", "california"],
    },
    {
        id: "delivery-address", q: "Where is my order shipped?",
        a: "The FAQ says orders go to the shipping address provided at checkout, but credit-card orders go to the card billing address. Refused deliveries or incorrect addresses incur a 15% restocking fee, with shipping and handling non-refundable. Contact the team to confirm any address mismatch before ordering.",
        sourceQuestion: "Where will my order be shipped?",
        matches: ["address", "refused", "refuse", "billing", "restock"],
    },
    {
        id: "signature", q: "What does the FAQ say about signature confirmation?",
        a: "The FAQ describes optional signature confirmation for $3.00 at checkout. Without it, customers assume responsibility for lost, stolen, or missing packages tracking as delivered, and packages may be left at the driver's discretion. Confirm availability with the team if this option is not shown in your checkout.",
        sourceQuestion: "When should I use signature confirmation?",
        matches: ["signature", "stolen", "lost", "delivered", "missing package"],
    },
    {
        id: "returns", q: "What is the return policy?",
        a: "Eligible products must be received back within 15 days of the customer receiving them, unused and in the condition received. A 15% restocking fee applies. The customer pays return freight; outbound shipping, handling, and rush charges are non-refundable. Include the packing list, use tracking, and pack securely: Nemat is not responsible for returns that fail to arrive or arrive damaged. Personalized products are excluded, and this returns policy does not apply to international orders. Refunds cannot be issued for ineligible goods, goods in a different condition, or returns after 15 days.",
        sourceQuestion: "What is your return policy?",
        matches: ["return", "refund", "exchange", "restock", "send back", "rma"],
    },
    {
        id: "refund-timing", q: "How long does a return refund take?",
        a: "After a return is received and inspected (usually within 3 business days), the refund is processed within 7 business days to the original payment method. Posting to the account may take an additional 2–10 business days after the credit is applied.",
        sourceQuestion: "What is your return policy?",
        matches: ["return", "refund", "credit", "posting"],
    },
    {
        id: "damaged-defective", q: "What should I do with damaged or defective products?",
        a: "File damage or defect claims within 7 business days of receiving the order. Email pictures and a description to sales@nematinternational.com, or call 800-936-3628 (international: 1-510-445-0300) to initiate a claim. Keep all products in their original packaging until the claim is settled. The FAQ says Nemat is not responsible for carrier errors but will assist with carrier claims. This general claims paragraph also mentions missing products, while the separate missing-item answer requires notification within 48 hours; report missing items promptly and ask the team to clarify the differing windows.",
        sourceQuestion: "What do I do with damaged or defective products?",
        matches: ["damag", "defect", "broken", "claim", "missing", "replacement", "wrong item", "incorrect"],
    },
    {
        id: "missing-items", q: "What happens if I am missing an item?",
        a: "Check every carton and all packaging first. Bottles, roll-on plugs, and caps are commonly packed separately, and an order may span several boxes. If an item still appears missing, notify the team within 48 hours of receiving the order. Investigation typically takes 6–8 business days; a confirmed missing item is refunded or replaced at no cost. The general damage/defect claims paragraph also includes missing products within 7 business days; the specific missing-item answer gives the shorter 48-hour window, so contact the team promptly for clarification.",
        sourceQuestion: "What happens if I am missing an item?",
        matches: ["missing", "shortage", "short shipment", "not in", "absent", "incomplete", "replacement"],
    },
    {
        id: "order-changes", q: "How do I change, cancel, or add to my order?",
        a: "Email sales@nematinternational.com with the order name, order number, and, if possible, a copy of the confirmation. If the order has not shipped, the team will do its best to accommodate changes or cancellation. This answer says most orders are processed within 1–3 days of receipt, while the shipping answer specifies 2–3 business days and September–December processing up to 4–5 business days. Confirm your order's status; changes are not guaranteed.",
        sourceQuestion: "How do I change ,cancel, or add to my order?",
        matches: ["change", "cancel", "add to my order", "amend", "process", "lead time"],
    },
    {
        id: "stock", q: "Will an item remain in stock or return to stock?",
        a: "Out-of-stock product pages show estimated arrival dates when available; contact Customer Service for details. Some items may temporarily sell out or be discontinued by the manufacturer, so continued availability is not guaranteed.",
        sourceQuestion: "If an item is out of stock, when will it be back in stock?",
        matches: ["stock", "eta", "discontinued"],
    },
    {
        id: "contact", q: "How can I contact the team?",
        a: "Email sales@nematinternational.com. Call 1-800-936-3628 within the USA or 1-510-445-0300 for domestic or international calls. Fax: 1-510-751-4980. Office hours are Monday–Friday, 9:30am–5:30pm PST, as labeled in the FAQ. Address: Nemat International, Inc., 34135 7th Street, Union City, CA 94587, USA.",
        sourceQuestion: "Hours of operation",
        matches: ["contact", "support", "email", "phone", "hours", "address", "help", "pst"],
    },
];

export const FAQ_POLICY_GAPS = [
    "warranty or breakage guarantee terms",
    "free-shipping thresholds, exact shipping quotes, or guaranteed delivery dates",
    "credit accounts, net terms, or domestic card-capture timing",
    "price-match or discount policies",
    "a universal per-item quantity minimum or no-unit-minimum promise",
    "a separate wrong-item claim deadline or guaranteed damage-claim remedy",
];

export const FAQ_POLICY_GUIDANCE =
    "Use only the approved FAQ contract for policy answers. State its exact numbers; never round, soften, or infer another window. Keep damage/defect claims separate from missing-item reports, and preserve both source ambiguities (missing claims and processing times). PST is the published label, not a DST conversion. Describe published payment, tax, address, and signature terms as FAQ statements, not proof that checkout supports or enforces them. Never request card details in chat. For a topic absent from this contract, say the approved FAQ does not establish that term and refer to the team or the source FAQ; do not invent it.";

/** Embedded for fallback, which has catalog tools only and cannot call getPolicy. */
export function buildFaqPolicyPrompt(): string {
    return [
        "## APPROVED FAQ POLICY CONTRACT",
        `Source: ${FAQ_POLICY_SOURCE.url} (verified ${FAQ_POLICY_SOURCE.verifiedOn}).`,
        FAQ_POLICY_GUIDANCE,
        ...FAQ_POLICY_ENTRIES.map((entry) => `${entry.q}\n${entry.a}`),
        `Not established by this FAQ contract: ${FAQ_POLICY_GAPS.join("; ")}.`,
    ].join("\n\n");
}
