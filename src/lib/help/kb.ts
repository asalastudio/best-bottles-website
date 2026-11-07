/**
 * Help center knowledge base.
 *
 * Every entry has a stable id, a version, an owner, a status and its sources.
 * Only entries that are `published` AND `public` reach the help pages, the
 * agent API, search and Grace. The workflow is draft → review → approved →
 * published → retired; while entries live in code, a status change is a
 * reviewed pull request and git history is the audit trail.
 *
 * The policy text itself is NOT copied here. Policy entries read their answer
 * from src/lib/faqPolicy.ts, the sole approved FAQ authority (Jordan,
 * 2026-10-02), so the website, Grace and agents can never disagree.
 */
import { FAQ_POLICY_ENTRIES, FAQ_POLICY_GAPS, FAQ_POLICY_SOURCE, type FaqPolicyEntry } from "@/lib/faqPolicy";

export type KbStatus = "draft" | "review" | "approved" | "published" | "retired";
export type KbAudience = "public" | "internal";
export type KbType = "policy" | "article" | "product-fact";
export type KbTopicId = "ordering" | "shipping" | "returns" | "contact" | "products";

export type KbSource = {
    kind: "approved-faq" | "component-register" | "catalog";
    label: string;
    url?: string;
    ref: string;
    checkedOn: string;
};

export type KbEntry = {
    /** Stable, never reused: `policy.<faq id>`. */
    id: string;
    slug: string;
    type: KbType;
    topic: KbTopicId;
    audience: KbAudience;
    status: KbStatus;
    version: number;
    /** Who approves changes. null until Jordan assigns one; shown as "not yet assigned". */
    owner: string | null;
    title: string;
    /** Chosen sentences of the approved answer, verbatim (SHORT_ANSWER_SENTENCES). */
    shortAnswer: string;
    /** The approved answer, verbatim. */
    body: string;
    /** Known disagreements inside the approved source, shown as "being clarified". */
    openQuestions: string[];
    keywords: string[];
    related: string[];
    sources: KbSource[];
    publishedOn: string;
    updatedOn: string;
};

export type KbTopic = { id: KbTopicId; title: string; summary: string };

export const KB_TOPICS: readonly KbTopic[] = [
    { id: "ordering", title: "Orders & samples", summary: "Minimums, samples, payment, tax and changing an order." },
    { id: "shipping", title: "Shipping & delivery", summary: "Processing times, carriers, same-day, pickup and international." },
    { id: "returns", title: "Returns & claims", summary: "Returns, refunds, damaged items and missing items." },
    { id: "products", title: "Bottles & closures", summary: "Which caps, sprayers and roll-ons are listed for each bottle." },
    { id: "contact", title: "Contact", summary: "Phone, email, hours and address." },
];

const TOPIC_BY_FAQ_ID: Record<string, KbTopicId> = {
    "minimum-order": "ordering", samples: "ordering", ordering: "ordering", payments: "ordering",
    "international-payment": "ordering", "sales-tax": "ordering", stock: "ordering", "order-changes": "ordering",
    "lead-times": "shipping", "shipping-options": "shipping", "same-day": "shipping", pickup: "shipping",
    "international-shipping": "shipping", canada: "shipping", "delivery-address": "shipping", signature: "shipping",
    returns: "returns", "refund-timing": "returns", "damaged-defective": "returns", "missing-items": "returns",
    contact: "contact",
};

const SLUG_BY_FAQ_ID: Record<string, string> = {
    "minimum-order": "minimum-order", samples: "samples", ordering: "how-to-order", payments: "payment-methods",
    "international-payment": "international-payment", "sales-tax": "sales-tax", stock: "stock-and-restocks",
    "order-changes": "change-or-cancel-an-order", "lead-times": "processing-and-delivery-times",
    "shipping-options": "shipping-options", "same-day": "same-day-shipping", pickup: "warehouse-pickup",
    "international-shipping": "international-shipping", canada: "shipping-to-canada", "delivery-address": "delivery-address",
    signature: "signature-confirmation", returns: "returns", "refund-timing": "refund-timing",
    "damaged-defective": "damaged-or-defective", "missing-items": "missing-items", contact: "contact",
};

/** Disagreements the approved FAQ itself contains. They stay visible until the owner resolves them. */
const OPEN_QUESTIONS: Record<string, string[]> = {
    "missing-items": ["The FAQ gives two windows for reporting a missing item: 48 hours here, and 7 business days in the general claims answer. Report missing items as soon as you can."],
    "damaged-defective": ["The FAQ's missing-item answer gives 48 hours, while this claims answer gives 7 business days. Report missing items as soon as you can."],
    "lead-times": ["The FAQ also says most orders are processed within 1–3 days. Contact the team to confirm timing for your order."],
    "order-changes": ["Processing times differ between this answer (1–3 days) and the shipping answer (2–3 business days)."],
};

const RELATED: Record<string, string[]> = {
    "minimum-order": ["samples", "ordering"], samples: ["minimum-order", "contact"], ordering: ["minimum-order", "payments"],
    payments: ["international-payment", "sales-tax"], "international-payment": ["payments", "international-shipping"],
    "sales-tax": ["payments", "international-shipping"], stock: ["contact", "ordering"], "order-changes": ["lead-times", "contact"],
    "lead-times": ["shipping-options", "same-day"], "shipping-options": ["lead-times", "signature"], "same-day": ["lead-times", "pickup"],
    pickup: ["same-day", "contact"], "international-shipping": ["canada", "international-payment"], canada: ["international-shipping"],
    "delivery-address": ["signature", "returns"], signature: ["delivery-address", "missing-items"],
    returns: ["refund-timing", "damaged-defective"], "refund-timing": ["returns"], "damaged-defective": ["missing-items", "returns"],
    "missing-items": ["damaged-defective", "contact"], contact: ["ordering", "returns"],
};

const SOURCE: KbSource = {
    kind: "approved-faq",
    label: "Best Bottles FAQ (approved policy)",
    url: FAQ_POLICY_SOURCE.url,
    ref: "src/lib/faqPolicy.ts",
    checkedOn: FAQ_POLICY_SOURCE.verifiedOn,
};

/** Sentences of an approved answer, split where a sentence ends and a capitalised one begins. */
export function sentences(text: string): string[] {
    return text.split(/(?<=[.!?])\s+(?=[A-Z(])/);
}

/**
 * Which approved sentences form each short answer. Quoted verbatim, never
 * rewritten: the short answer is a pointer into the approved text, chosen so
 * it answers the question (the missing-item answer's first sentence is advice
 * to check the boxes; its deadline is the third).
 */
const SHORT_ANSWER_SENTENCES: Record<string, number[]> = {
    "minimum-order": [0], samples: [0], ordering: [0, 1], "lead-times": [0], "shipping-options": [0],
    "same-day": [1, 2], pickup: [0, 1], "international-shipping": [0], canada: [0], payments: [0],
    "international-payment": [0], "sales-tax": [0], "delivery-address": [0], signature: [0], returns: [0, 1],
    "refund-timing": [0], "damaged-defective": [0], "missing-items": [2], "order-changes": [0, 1], stock: [0], contact: [0, 1],
};

export function shortAnswerFor(faqId: string, answer: string): string {
    const parts = sentences(answer);
    const picked = (SHORT_ANSWER_SENTENCES[faqId] ?? [0]).map((i) => parts[i]).filter(Boolean);
    return (picked.length ? picked : parts.slice(0, 1)).join(" ");
}

function fromFaq(entry: FaqPolicyEntry): KbEntry {
    const topic = TOPIC_BY_FAQ_ID[entry.id];
    const slug = SLUG_BY_FAQ_ID[entry.id];
    if (!topic || !slug) throw new Error(`help KB: FAQ entry "${entry.id}" has no topic or slug`);
    return {
        id: `policy.${entry.id}`,
        slug,
        type: "policy",
        topic,
        audience: "public",
        status: "published",
        version: 1,
        owner: null,
        title: entry.q,
        shortAnswer: shortAnswerFor(entry.id, entry.a),
        body: entry.a,
        openQuestions: OPEN_QUESTIONS[entry.id] ?? [],
        keywords: entry.matches,
        related: (RELATED[entry.id] ?? []).map((id) => `policy.${id}`),
        sources: [SOURCE],
        publishedOn: FAQ_POLICY_SOURCE.verifiedOn,
        updatedOn: FAQ_POLICY_SOURCE.verifiedOn,
    };
}

/** Every entry, whatever its status or audience. Server-only callers; never send this to a client. */
export const KB_ENTRIES: readonly KbEntry[] = FAQ_POLICY_ENTRIES.map(fromFaq);

export function isPublic(entry: KbEntry): boolean {
    return entry.status === "published" && entry.audience === "public";
}

export function publicEntries(entries: readonly KbEntry[] = KB_ENTRIES): KbEntry[] {
    return entries.filter(isPublic);
}

export function publicEntryBySlug(slug: string): KbEntry | null {
    return publicEntries().find((entry) => entry.slug === slug) ?? null;
}

export function publicEntryById(id: string): KbEntry | null {
    return publicEntries().find((entry) => entry.id === id) ?? null;
}

export function topicById(id: string): KbTopic | null {
    return KB_TOPICS.find((topic) => topic.id === id) ?? null;
}

export function entriesForTopic(topic: KbTopicId): KbEntry[] {
    return publicEntries().filter((entry) => entry.topic === topic);
}

export function entryHref(entry: Pick<KbEntry, "slug">): string {
    return `/help/a/${entry.slug}`;
}

/** The fields agents and pages may see. Anything added to KbEntry stays private until listed here. */
export function toPublicEntry(entry: KbEntry) {
    return {
        id: entry.id,
        url: entryHref(entry),
        type: entry.type,
        topic: entry.topic,
        status: entry.status,
        version: entry.version,
        title: entry.title,
        shortAnswer: entry.shortAnswer,
        answer: entry.body,
        openQuestions: entry.openQuestions,
        related: entry.related.filter((id) => publicEntryById(id) !== null),
        sources: entry.sources.map(({ kind, label, url, checkedOn }) => ({ kind, label, url: url ?? null, checkedOn })),
        publishedOn: entry.publishedOn,
        updatedOn: entry.updatedOn,
    };
}

export type PublicKbEntry = ReturnType<typeof toPublicEntry>;

/**
 * Questions with no approved answer. They are editorial tasks for the policy
 * owner, never answers: search and Grace say "no approved answer yet".
 */
export const KB_GAPS: readonly string[] = FAQ_POLICY_GAPS;
