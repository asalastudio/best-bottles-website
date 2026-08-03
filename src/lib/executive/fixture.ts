import {
    validateExecutiveDashboardSnapshot,
    type ExecutiveDashboardSnapshot,
} from "./contracts";

const provenance = {
    sourceId: "illustrative-fixture",
    status: "directional" as const,
    asOf: "2026-08-02T15:42:00.000Z",
    coverage: "Illustrative design fixture",
};

export const EXECUTIVE_HUB_FIXTURE: ExecutiveDashboardSnapshot = {
    mode: "illustrative",
    generatedAt: provenance.asOf,
    timezone: "America/Los_Angeles",
    range: "today",
    sources: [{
        id: provenance.sourceId,
        label: "Illustrative concept",
        status: "directional",
        asOf: provenance.asOf,
        coverage: provenance.coverage,
    }],
    questions: [
        { id: "performance", eyebrow: "01 · Performance", question: "Are we growing profitably?", metricIds: ["net-revenue", "gross-profit", "gross-margin", "ebitda"] },
        { id: "future-revenue", eyebrow: "02 · Future revenue", question: "Is the pipeline healthy?", metricIds: ["qualified-pipeline", "open-quotes", "backlog", "win-rate"] },
        { id: "attention", eyebrow: "03 · CEO attention", question: "What needs me today?", metricIds: ["open-decisions", "decision-exposure", "oldest-decision"] },
    ],
    metrics: [
        { id: "net-revenue", label: "Net revenue MTD", value: "$1.84M", comparison: "+8.4% vs plan", tone: "positive", href: "#financial", ...provenance },
        { id: "gross-profit", label: "Gross profit", value: "$612k", comparison: "Current month", tone: "positive", href: "#financial", ...provenance },
        { id: "gross-margin", label: "Gross margin", value: "33.3%", comparison: "Current month", tone: "positive", href: "#financial", ...provenance },
        { id: "ebitda", label: "EBITDA", value: "$184k", comparison: "Current month", tone: "positive", href: "#financial", ...provenance },
        { id: "qualified-pipeline", label: "Qualified pipeline", value: "$3.21M", comparison: "2.4× coverage", tone: "watch", href: "#sales", ...provenance },
        { id: "open-quotes", label: "Open quotes", value: "48", comparison: "Current pipeline", tone: "watch", href: "#sales", ...provenance },
        { id: "backlog", label: "Backlog", value: "$947k", comparison: "Confirmed future revenue", tone: "watch", href: "#sales", ...provenance },
        { id: "win-rate", label: "Win rate", value: "31%", comparison: "Qualified opportunities", tone: "watch", href: "#sales", ...provenance },
        { id: "open-decisions", label: "Open CEO decisions", value: "3", comparison: "Current queue", tone: "risk", href: "#decisions", ...provenance },
        { id: "decision-exposure", label: "Decision exposure", value: "$218k", comparison: "Across open decisions", tone: "risk", href: "#decisions", ...provenance },
        { id: "oldest-decision", label: "Oldest open", value: "19 hours", comparison: "Current queue", tone: "risk", href: "#decisions", ...provenance },
        { id: "cash-on-hand", label: "Cash on hand", value: "$1.12M", comparison: "3.8 months operating cover", tone: "positive", href: "#financial", ...provenance },
        { id: "orders-received", label: "Orders received", value: "214", comparison: "$8,598 average order", tone: "positive", href: "#sales", ...provenance },
        { id: "inventory-value", label: "Inventory value", value: "$2.76M", comparison: "4.7 turns annualized", tone: "watch", href: "#inventory", ...provenance },
        { id: "stockout-risks", label: "Stockout risks", value: "7", comparison: "2 affect top-selling SKUs", tone: "risk", href: "#inventory", ...provenance },
        { id: "on-time-shipments", label: "On-time shipments", value: "94.6%", comparison: "+1.4 pts vs last month", tone: "positive", href: "#operations", ...provenance },
        { id: "overdue-ar", label: "Overdue A/R", value: "$126k", comparison: "4 accounts over 60 days", tone: "watch", href: "#financial", ...provenance },
    ],
    headlineMetricIds: [
        "cash-on-hand",
        "orders-received",
        "inventory-value",
        "stockout-risks",
        "on-time-shipments",
        "overdue-ar",
    ],
    decisions: [
        {
            id: "inventory-replenishment",
            severity: "critical",
            category: "Inventory",
            title: "Approve expedited Cylinder replenishment",
            impact: "$92k stockout exposure",
            owner: "CEO",
            dueLabel: "Today",
            recommendation: "Approve expedited replenishment quantity.",
            evidence: "Cylinder stock cover falls below the approved floor at current velocity.",
            sourceId: provenance.sourceId,
        },
        {
            id: "supplier-cost",
            severity: "watch",
            category: "Margin",
            title: "Review supplier cost increase on pumps",
            impact: "1.8 margin points",
            owner: "CEO + purchasing",
            dueLabel: "Today",
            recommendation: "Review pass-through and alternate supplier scenarios.",
            evidence: "Supplier proposal increases landed pump cost.",
            sourceId: provenance.sourceId,
        },
        {
            id: "customer-terms",
            severity: "watch",
            category: "Customer",
            title: "Authorize terms for $84k opportunity",
            impact: "$84k qualified opportunity",
            owner: "CEO + sales",
            dueLabel: "Monday",
            recommendation: "Approve or revise requested commercial terms.",
            evidence: "Opportunity is otherwise ready for purchase order.",
            sourceId: provenance.sourceId,
        },
    ],
    panels: [
        { id: "commercial-funnel", title: "Commercial funnel", subtitle: "Lead → delivered · current quarter" },
        { id: "inventory-supply", title: "Inventory and supply health", subtitle: "Exceptions first" },
        { id: "product-families", title: "Top product families", subtitle: "Revenue · gross margin" },
        { id: "customer-health", title: "Customer account health", subtitle: "Concentration · reorder risk" },
        { id: "operations-production", title: "Operations and production", subtitle: "Warehouse + decoration" },
    ],
};

const fixtureIssues = validateExecutiveDashboardSnapshot(EXECUTIVE_HUB_FIXTURE);
if (fixtureIssues.length) {
    throw new Error(`Invalid Executive Hub fixture: ${fixtureIssues.join(" ")}`);
}

export function getExecutiveMetric(snapshot: ExecutiveDashboardSnapshot, id: string) {
    const metric = snapshot.metrics.find((candidate) => candidate.id === id);
    if (!metric) throw new Error(`Unknown Executive Hub metric: ${id}`);
    return metric;
}
