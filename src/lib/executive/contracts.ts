export type ExecutiveSourceStatus = "source-backed" | "directional" | "stale" | "not-connected" | "error";
export type ExecutiveMetricTone = "positive" | "neutral" | "watch" | "risk";
export type ExecutiveDateRange = "today" | "7d" | "mtd" | "qtd" | "ytd";

export type ExecutiveSource = {
    id: string;
    label: string;
    status: ExecutiveSourceStatus;
    asOf: string | null;
    coverage: string;
};

export type ExecutiveMetric = {
    id: string;
    label: string;
    value: string;
    comparison: string;
    sourceId: string;
    status: ExecutiveSourceStatus;
    asOf: string | null;
    coverage: string;
    tone: ExecutiveMetricTone;
    href: string;
};

export type ExecutiveQuestionPanel = {
    id: "performance" | "future-revenue" | "attention";
    eyebrow: string;
    question: string;
    metricIds: string[];
};

export type ExecutiveDecision = {
    id: string;
    severity: "critical" | "watch" | "assign";
    category: string;
    title: string;
    impact: string;
    owner: string;
    dueLabel: string;
    recommendation: string;
    evidence: string;
    sourceId: string;
};

export type ExecutivePanel = {
    id: "commercial-funnel" | "inventory-supply" | "product-families" | "customer-health" | "operations-production";
    title: string;
    subtitle: string;
};

export type ExecutiveDashboardSnapshot = {
    mode: "illustrative" | "live";
    generatedAt: string;
    timezone: "America/Los_Angeles";
    range: ExecutiveDateRange;
    sources: ExecutiveSource[];
    questions: ExecutiveQuestionPanel[];
    metrics: ExecutiveMetric[];
    headlineMetricIds: string[];
    decisions: ExecutiveDecision[];
    panels: ExecutivePanel[];
};

const REQUIRED_QUESTION_ORDER = ["performance", "future-revenue", "attention"];

export function validateExecutiveDashboardSnapshot(snapshot: ExecutiveDashboardSnapshot) {
    const issues: string[] = [];
    const sourceIds = new Set(snapshot.sources.map((source) => source.id));

    if (snapshot.questions.map((question) => question.id).join("|") !== REQUIRED_QUESTION_ORDER.join("|")) {
        issues.push("Executive questions must be performance, future-revenue, and attention in that order.");
    }
    if (snapshot.headlineMetricIds.length > 6) {
        issues.push("Headline metric strip cannot exceed 6 metrics.");
    }
    for (const metric of snapshot.metrics) {
        if (!metric.sourceId) {
            issues.push(`Metric ${metric.id} is missing sourceId.`);
        } else if (!sourceIds.has(metric.sourceId)) {
            issues.push(`Metric ${metric.id} references unknown source ${metric.sourceId}.`);
        }
        if (!metric.coverage) issues.push(`Metric ${metric.id} is missing coverage.`);
        if (!metric.href) issues.push(`Metric ${metric.id} is missing drill-down href.`);
    }
    return issues;
}

export function metricStatusLabel(status: ExecutiveSourceStatus) {
    return ({
        "source-backed": "Source-backed",
        directional: "Directional",
        stale: "Stale",
        "not-connected": "Not connected",
        error: "Error",
    } as const)[status];
}
