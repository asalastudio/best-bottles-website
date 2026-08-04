# Best Bottles Executive Hub V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current static Executive Hub shell with the approved B2B packaging-supply Signal Board, using typed source-aware contracts, clearly illustrative preview data, responsive drill-down interactions, and the existing executive authentication boundary.

**Architecture:** Keep `src/app/executive/page.tsx` as the server-only authentication and preview boundary. Move the operating dashboard into focused `src/components/executive/` components driven by a serializable `ExecutiveDashboardSnapshot` contract in `src/lib/executive/`. V1 renders an explicit illustrative fixture while preserving `source`, `asOf`, `status`, and `coverage` on every value so live connectors can replace fixture data without redesigning the interface.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind CSS 4, shadcn/ui, Radix primitives, Clerk, Vitest.

## Global Constraints

- The first viewport answers performance, future revenue, and required attention.
- Profitability, pipeline, inventory, fulfillment, and customer-account risk lead the information hierarchy.
- No more than six supporting KPIs appear in the headline strip.
- Each value exposes source, freshness, coverage, comparison, and drill-down.
- The decision queue exposes impact, owner, deadline, recommendation, and evidence.
- Ecommerce and Grace remain accessible without displacing B2B operating priorities.
- Preview data is visibly illustrative and cannot be confused with production truth.
- Missing systems render honest not-connected states.
- Desktop and mobile preserve the same three-question hierarchy.
- Keyboard, screen-reader, contrast, and reduced-motion requirements pass.
- Use existing shadcn primitives where they provide the correct accessible behavior.
- The page remains understandable without interpreting color alone.
- Do not alter the existing Clerk access rules or expose raw Grace transcripts or customer PII.

---

## File map

### Create

- `src/lib/executive/contracts.ts` — serializable dashboard types, source-state vocabulary, validation, and tone helpers.
- `src/lib/executive/fixture.ts` — approved illustrative B2B packaging snapshot and source registry.
- `src/components/executive/ExecutiveDashboard.tsx` — interactive dashboard composition and date-range state.
- `src/components/executive/ExecutiveNavigation.tsx` — desktop navigation rail and mobile navigation sheet.
- `src/components/executive/ExecutiveMetric.tsx` — question and headline metric rendering with provenance.
- `src/components/executive/ExecutiveDecisionQueue.tsx` — decision rows and evidence drill-down.
- `src/components/executive/ExecutiveOperatingPanels.tsx` — commercial funnel, inventory, product, customer, and operations panels.
- `src/components/executive/ExecutiveDetailSheet.tsx` — keyboard-accessible metric and decision drill-down.
- `tests/executive-hub-contract.test.ts` — contract and fixture invariants.
- `tests/executive-hub-signal-board.test.ts` — approved composition, source honesty, and responsive interaction assertions.

### Modify

- `src/app/executive/page.tsx` — retain metadata, preview, auth, and denied state; render the new dashboard.
- `src/app/globals.css` — add scoped Executive Hub semantic signal tokens only if Tailwind utilities cannot express them cleanly.
- `src/components/ui/` — add shadcn Sheet, Tooltip, Skeleton, and Alert primitives through the CLI.
- `package.json` and `package-lock.json` — accept only dependencies added by the shadcn primitives.
- `tests/executive-hub-dashboard.test.ts` — point visual-shell expectations at the new dashboard component.
- `tests/executive-hub-auth.test.ts` — preserve the server-route access boundary assertions.

---

### Task 1: Define the Executive Hub data contract

**Files:**
- Create: `src/lib/executive/contracts.ts`
- Create: `tests/executive-hub-contract.test.ts`

**Interfaces:**
- Produces: `ExecutiveSourceStatus`, `ExecutiveMetricTone`, `ExecutiveMetric`, `ExecutiveQuestionPanel`, `ExecutiveDecision`, `ExecutiveSource`, `ExecutiveDashboardSnapshot`, `validateExecutiveDashboardSnapshot(snapshot)` and `metricStatusLabel(status)`.
- Consumes: no application code; this is the root interface for every later task.

- [ ] **Step 1: Write the failing contract tests**

```ts
import { describe, expect, it } from "vitest";
import {
    metricStatusLabel,
    validateExecutiveDashboardSnapshot,
    type ExecutiveDashboardSnapshot,
} from "@/lib/executive/contracts";

const validSnapshot: ExecutiveDashboardSnapshot = {
    mode: "illustrative",
    generatedAt: "2026-08-02T15:42:00.000Z",
    timezone: "America/Los_Angeles",
    range: "today",
    sources: [{ id: "fixture", label: "Illustrative fixture", status: "directional", asOf: "2026-08-02T15:42:00.000Z", coverage: "Design preview only" }],
    questions: [
        { id: "performance", eyebrow: "01 · Performance", question: "Are we growing profitably?", metricIds: ["revenue"] },
        { id: "future-revenue", eyebrow: "02 · Future revenue", question: "Is the pipeline healthy?", metricIds: ["pipeline"] },
        { id: "attention", eyebrow: "03 · CEO attention", question: "What needs me today?", metricIds: ["decisions"] },
    ],
    metrics: [
        { id: "revenue", label: "Net revenue MTD", value: "$1.84M", comparison: "+8.4% vs plan", sourceId: "fixture", status: "directional", asOf: "2026-08-02T15:42:00.000Z", coverage: "Illustrative", tone: "positive", href: "#financial" },
        { id: "pipeline", label: "Qualified pipeline", value: "$3.21M", comparison: "2.4× coverage", sourceId: "fixture", status: "directional", asOf: "2026-08-02T15:42:00.000Z", coverage: "Illustrative", tone: "watch", href: "#sales" },
        { id: "decisions", label: "Open CEO decisions", value: "3", comparison: "$218k exposure", sourceId: "fixture", status: "directional", asOf: "2026-08-02T15:42:00.000Z", coverage: "Illustrative", tone: "risk", href: "#decisions" },
    ],
    headlineMetricIds: ["revenue", "pipeline", "decisions"],
    decisions: [],
    panels: [],
};

describe("Executive Hub contract", () => {
    it("accepts the approved three-question hierarchy", () => {
        expect(validateExecutiveDashboardSnapshot(validSnapshot)).toEqual([]);
    });

    it("rejects more than six headline metrics", () => {
        const invalid = { ...validSnapshot, headlineMetricIds: ["1", "2", "3", "4", "5", "6", "7"] };
        expect(validateExecutiveDashboardSnapshot(invalid)).toContain("Headline metric strip cannot exceed 6 metrics.");
    });

    it("rejects metrics without provenance", () => {
        const invalid = { ...validSnapshot, metrics: [{ ...validSnapshot.metrics[0], sourceId: "" }] };
        expect(validateExecutiveDashboardSnapshot(invalid)).toContain("Metric revenue is missing sourceId.");
    });

    it("uses honest source-state labels", () => {
        expect(metricStatusLabel("source-backed")).toBe("Source-backed");
        expect(metricStatusLabel("not-connected")).toBe("Not connected");
    });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run tests/executive-hub-contract.test.ts`

Expected: FAIL because `@/lib/executive/contracts` does not exist.

- [ ] **Step 3: Implement the contract and validator**

```ts
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
    if (snapshot.questions.map((question) => question.id).join("|") !== REQUIRED_QUESTION_ORDER.join("|")) {
        issues.push("Executive questions must be performance, future-revenue, and attention in that order.");
    }
    if (snapshot.headlineMetricIds.length > 6) issues.push("Headline metric strip cannot exceed 6 metrics.");
    for (const metric of snapshot.metrics) {
        if (!metric.sourceId) issues.push(`Metric ${metric.id} is missing sourceId.`);
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
```

- [ ] **Step 4: Run the contract test and typecheck**

Run: `npx vitest run tests/executive-hub-contract.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit the contract**

```bash
git add src/lib/executive/contracts.ts tests/executive-hub-contract.test.ts
git commit -m "feat: define executive hub contracts"
```

---

### Task 2: Add the approved illustrative packaging snapshot

**Files:**
- Create: `src/lib/executive/fixture.ts`
- Modify: `tests/executive-hub-contract.test.ts`

**Interfaces:**
- Consumes: `ExecutiveDashboardSnapshot` and `validateExecutiveDashboardSnapshot` from Task 1.
- Produces: `EXECUTIVE_HUB_FIXTURE` and `getExecutiveMetric(snapshot, id)`.

- [ ] **Step 1: Add failing fixture assertions**

```ts
import { EXECUTIVE_HUB_FIXTURE, getExecutiveMetric } from "@/lib/executive/fixture";

it("marks every concept value as illustrative and directional", () => {
    expect(EXECUTIVE_HUB_FIXTURE.mode).toBe("illustrative");
    expect(EXECUTIVE_HUB_FIXTURE.metrics.every((metric) => metric.status === "directional")).toBe(true);
    expect(EXECUTIVE_HUB_FIXTURE.metrics.every((metric) => metric.coverage === "Illustrative design fixture")).toBe(true);
});

it("leads with B2B packaging metrics", () => {
    expect(getExecutiveMetric(EXECUTIVE_HUB_FIXTURE, "net-revenue").label).toBe("Net revenue MTD");
    expect(getExecutiveMetric(EXECUTIVE_HUB_FIXTURE, "qualified-pipeline").label).toBe("Qualified pipeline");
    expect(EXECUTIVE_HUB_FIXTURE.headlineMetricIds).toEqual([
        "cash-on-hand",
        "orders-received",
        "inventory-value",
        "stockout-risks",
        "on-time-shipments",
        "overdue-ar",
    ]);
});
```

- [ ] **Step 2: Run the fixture test and verify it fails**

Run: `npx vitest run tests/executive-hub-contract.test.ts`

Expected: FAIL because `fixture.ts` does not exist.

- [ ] **Step 3: Implement the complete fixture**

Create one `fixtureSource` with `id: "illustrative-fixture"`, then define the approved values from the visual reference:

```ts
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
    sources: [{ id: provenance.sourceId, label: "Illustrative concept", status: "directional", asOf: provenance.asOf, coverage: provenance.coverage }],
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
    headlineMetricIds: ["cash-on-hand", "orders-received", "inventory-value", "stockout-risks", "on-time-shipments", "overdue-ar"],
    decisions: [
        { id: "inventory-replenishment", severity: "critical", category: "Inventory", title: "Approve expedited Cylinder replenishment", impact: "$92k stockout exposure", owner: "CEO", dueLabel: "Today", recommendation: "Approve expedited replenishment quantity.", evidence: "Cylinder stock cover falls below the approved floor at current velocity.", sourceId: provenance.sourceId },
        { id: "supplier-cost", severity: "watch", category: "Margin", title: "Review supplier cost increase on pumps", impact: "1.8 margin points", owner: "CEO + purchasing", dueLabel: "Today", recommendation: "Review pass-through and alternate supplier scenarios.", evidence: "Supplier proposal increases landed pump cost.", sourceId: provenance.sourceId },
        { id: "customer-terms", severity: "watch", category: "Customer", title: "Authorize terms for $84k opportunity", impact: "$84k qualified opportunity", owner: "CEO + sales", dueLabel: "Monday", recommendation: "Approve or revise requested commercial terms.", evidence: "Opportunity is otherwise ready for purchase order.", sourceId: provenance.sourceId },
    ],
    panels: [
        { id: "commercial-funnel", title: "Commercial funnel", subtitle: "Lead → delivered · current quarter" },
        { id: "inventory-supply", title: "Inventory and supply health", subtitle: "Exceptions first" },
        { id: "product-families", title: "Top product families", subtitle: "Revenue · gross margin" },
        { id: "customer-health", title: "Customer account health", subtitle: "Concentration · reorder risk" },
        { id: "operations-production", title: "Operations and production", subtitle: "Warehouse + decoration" },
    ],
};

export function getExecutiveMetric(snapshot: ExecutiveDashboardSnapshot, id: string) {
    const metric = snapshot.metrics.find((candidate) => candidate.id === id);
    if (!metric) throw new Error(`Unknown Executive Hub metric: ${id}`);
    return metric;
}
```

- [ ] **Step 4: Validate the fixture at module load and run tests**

Add:

```ts
const fixtureIssues = validateExecutiveDashboardSnapshot(EXECUTIVE_HUB_FIXTURE);
if (fixtureIssues.length) throw new Error(`Invalid Executive Hub fixture: ${fixtureIssues.join(" ")}`);
```

Run: `npx vitest run tests/executive-hub-contract.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit the fixture**

```bash
git add src/lib/executive/fixture.ts tests/executive-hub-contract.test.ts
git commit -m "feat: add executive hub preview fixture"
```

---

### Task 3: Add the shadcn interaction primitives and dashboard components

**Files:**
- Create through shadcn CLI: `src/components/ui/sheet.tsx`
- Create through shadcn CLI: `src/components/ui/tooltip.tsx`
- Create through shadcn CLI: `src/components/ui/skeleton.tsx`
- Create through shadcn CLI: `src/components/ui/alert.tsx`
- Create: `src/components/executive/ExecutiveMetric.tsx`
- Create: `src/components/executive/ExecutiveDecisionQueue.tsx`
- Create: `src/components/executive/ExecutiveOperatingPanels.tsx`
- Create: `tests/executive-hub-signal-board.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `ExecutiveDashboardSnapshot`, `ExecutiveMetric`, `ExecutiveQuestionPanel`, `ExecutiveDecision`, and `getExecutiveMetric`.
- Produces: `ExecutiveQuestionCard`, `ExecutiveHeadlineMetric`, `ExecutiveDecisionQueue`, and `ExecutiveOperatingPanels`.

- [ ] **Step 1: Preview the shadcn changes**

Run: `npx shadcn@latest add sheet tooltip skeleton alert --dry-run`

Expected: only the four named primitives and their required Radix dependencies are proposed; no existing Best Bottles component is overwritten.

- [ ] **Step 2: Add the shadcn primitives non-interactively**

Run: `npx shadcn@latest add sheet tooltip skeleton alert`

Expected: source-owned primitives appear in `src/components/ui/` and dependency changes are limited to their requirements.

- [ ] **Step 3: Write failing source-level composition tests**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const metricSource = readFileSync(resolve(process.cwd(), "src/components/executive/ExecutiveMetric.tsx"), "utf8");
const decisionSource = readFileSync(resolve(process.cwd(), "src/components/executive/ExecutiveDecisionQueue.tsx"), "utf8");
const panelsSource = readFileSync(resolve(process.cwd(), "src/components/executive/ExecutiveOperatingPanels.tsx"), "utf8");

describe("Executive Signal Board components", () => {
    it("renders provenance and does not communicate status through color alone", () => {
        expect(metricSource).toContain("metricStatusLabel");
        expect(metricSource).toContain("metric.sourceId");
        expect(metricSource).toContain("metric.coverage");
    });

    it("renders the complete CEO decision contract", () => {
        for (const field of ["impact", "owner", "dueLabel", "recommendation", "evidence"]) {
            expect(decisionSource).toContain(`decision.${field}`);
        }
    });

    it("keeps packaging operations ahead of ecommerce detail", () => {
        expect(panelsSource).toContain("Commercial funnel");
        expect(panelsSource).toContain("Inventory and supply health");
        expect(panelsSource).toContain("Customer account health");
        expect(panelsSource).toContain("Operations and production");
    });
});
```

- [ ] **Step 4: Run the component test and verify it fails**

Run: `npx vitest run tests/executive-hub-signal-board.test.ts`

Expected: FAIL because the executive components do not exist.

- [ ] **Step 5: Implement `ExecutiveMetric.tsx`**

Use shadcn `Card`, `Badge`, and `Tooltip`. `ExecutiveQuestionCard` accepts `{ question, snapshot, onOpenMetric }`; `ExecutiveHeadlineMetric` accepts `{ metric, onOpen }`. Both render a real button or link for drill-down, visible status text from `metricStatusLabel`, source label resolved from `snapshot.sources`, `asOf`, comparison, and coverage. Tone changes only the top rule and status icon; the same state is written as text.

- [ ] **Step 6: Implement `ExecutiveDecisionQueue.tsx`**

Render a semantic ordered list. Each item is a button with severity text, category, title, impact, owner, and due label. Selecting an item calls `onOpenDecision(decision)`. The expanded detail includes recommendation, evidence, and source.

- [ ] **Step 7: Implement `ExecutiveOperatingPanels.tsx`**

Use shadcn `Card`, `Progress`, and `Table` for the exact approved panels. Keep illustrative panel rows in focused exported constants so a later connector can replace them without changing layout. The commercial funnel uses six labeled stages; inventory uses text plus progress values; product, customer, and operations panels use compact semantic tables.

- [ ] **Step 8: Run component tests and typecheck**

Run: `npx vitest run tests/executive-hub-signal-board.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 9: Commit the component foundation**

```bash
git add package.json package-lock.json src/components/ui src/components/executive tests/executive-hub-signal-board.test.ts
git commit -m "feat: add executive signal board components"
```

---

### Task 4: Build the responsive dashboard shell and drill-down behavior

**Files:**
- Create: `src/components/executive/ExecutiveNavigation.tsx`
- Create: `src/components/executive/ExecutiveDetailSheet.tsx`
- Create: `src/components/executive/ExecutiveDashboard.tsx`
- Modify: `tests/executive-hub-signal-board.test.ts`

**Interfaces:**
- Consumes: all Task 3 components and `ExecutiveDashboardSnapshot`.
- Produces: `ExecutiveDashboard({ snapshot, previewMode })`.

- [ ] **Step 1: Add failing shell and interaction assertions**

```ts
const dashboardSource = readFileSync(resolve(process.cwd(), "src/components/executive/ExecutiveDashboard.tsx"), "utf8");
const navigationSource = readFileSync(resolve(process.cwd(), "src/components/executive/ExecutiveNavigation.tsx"), "utf8");
const detailSource = readFileSync(resolve(process.cwd(), "src/components/executive/ExecutiveDetailSheet.tsx"), "utf8");

it("preserves the three approved CEO questions", () => {
    expect(dashboardSource).toContain("snapshot.questions.map");
    expect(dashboardSource).toContain("Are we growing profitably?");
    expect(dashboardSource).toContain("Is the pipeline healthy?");
    expect(dashboardSource).toContain("What needs me today?");
});

it("supports desktop and mobile navigation through shadcn Sheet", () => {
    expect(navigationSource).toContain("Executive Hub sections");
    expect(navigationSource).toContain("<Sheet");
    expect(navigationSource).toContain("lg:hidden");
});

it("provides accessible metric and decision details", () => {
    expect(detailSource).toContain("SheetTitle");
    expect(detailSource).toContain("SheetDescription");
    expect(detailSource).toContain("Source");
    expect(detailSource).toContain("Coverage");
});
```

- [ ] **Step 2: Run the shell tests and verify they fail**

Run: `npx vitest run tests/executive-hub-signal-board.test.ts`

Expected: FAIL because the shell files do not exist.

- [ ] **Step 3: Implement `ExecutiveNavigation.tsx`**

Define the ordered lanes `Overview`, `Sales`, `Products`, `Inventory`, `Operations`, `Manufacturing`, `Customers`, `Suppliers`, `Financial`, `Ecommerce`, `Grace`, and `Platform`. Desktop renders a labeled rail at `lg` and above. Mobile renders a shadcn `Sheet` triggered by a button named `Open Executive Hub navigation`. Use anchors for V1 lanes that exist on the overview and honest disabled labels for future live lanes; do not create dead clickable controls.

- [ ] **Step 4: Implement `ExecutiveDetailSheet.tsx`**

Use one discriminated selection type:

```ts
export type ExecutiveDetailSelection =
    | { kind: "metric"; metric: ExecutiveMetric }
    | { kind: "decision"; decision: ExecutiveDecision }
    | null;
```

Render metric definition copy, value, comparison, source, status, `asOf`, coverage, and drill-down link. Render decision impact, owner, due date, recommendation, evidence, and source. Closing the Sheet sets selection to `null` and returns focus to the trigger through Radix behavior.

- [ ] **Step 5: Implement `ExecutiveDashboard.tsx`**

Make it a client component. Accept the immutable snapshot and maintain only:

```ts
const [range, setRange] = useState<ExecutiveDateRange>(snapshot.range);
const [selection, setSelection] = useState<ExecutiveDetailSelection>(null);
```

Render an explicit `Illustrative concept — not live business data` Alert when `snapshot.mode === "illustrative"`. Render date controls as buttons with `aria-pressed`; only `today` has fixture values, while other ranges retain layout and label values as not connected instead of inventing trends. Compose navigation, three questions, six headline metrics, commercial/inventory/decision row, product/customer/operations row, and detail Sheet.

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run tests/executive-hub-signal-board.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit the interactive shell**

```bash
git add src/components/executive tests/executive-hub-signal-board.test.ts
git commit -m "feat: build responsive executive dashboard"
```

---

### Task 5: Refactor the authenticated route onto the Signal Board

**Files:**
- Modify: `src/app/executive/page.tsx`
- Modify: `tests/executive-hub-dashboard.test.ts`
- Modify: `tests/executive-hub-auth.test.ts`

**Interfaces:**
- Consumes: `ExecutiveDashboard` and `EXECUTIVE_HUB_FIXTURE`.
- Produces: authenticated `/executive` route with local `?preview=1` support.

- [ ] **Step 1: Update route tests before changing the page**

Update `tests/executive-hub-dashboard.test.ts` to read both the route and dashboard component and assert:

```ts
expect(pageSource).toContain("<ExecutiveDashboard");
expect(pageSource).toContain("EXECUTIVE_HUB_FIXTURE");
expect(dashboardSource).toContain("Executive signal board");
expect(dashboardSource).toContain("Illustrative concept — not live business data");
expect(dashboardSource).toContain("Commercial funnel");
expect(dashboardSource).toContain("Inventory and supply health");
expect(dashboardSource).toContain("CEO decision queue");
```

Keep auth assertions for `hasExecutiveHubAccess`, `Executive Hub access pending`, `SwitchAccountButton`, and the absence of `redirect("/")`.

- [ ] **Step 2: Run route tests and verify they fail**

Run: `npx vitest run tests/executive-hub-dashboard.test.ts tests/executive-hub-auth.test.ts`

Expected: FAIL because the old route does not render the new dashboard.

- [ ] **Step 3: Reduce `page.tsx` to the server boundary**

Retain:

- metadata and `dynamic = "force-dynamic"`
- `isLocalPreview`
- Clerk `auth()` and `currentUser()`
- `getUserEmailAddresses` and `hasExecutiveHubAccess`
- `ExecutiveAccessPending`

Replace the old dashboard constants and 600+ lines of static UI with:

```tsx
return (
    <ExecutiveDashboard
        snapshot={EXECUTIVE_HUB_FIXTURE}
        previewMode={previewMode}
    />
);
```

- [ ] **Step 4: Run route, auth, and team-access tests**

Run: `npx vitest run tests/executive-hub-dashboard.test.ts tests/executive-hub-auth.test.ts tests/team-access.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the route refactor**

```bash
git add src/app/executive/page.tsx tests/executive-hub-dashboard.test.ts tests/executive-hub-auth.test.ts
git commit -m "refactor: route executive hub to signal board"
```

---

### Task 6: Harden visual quality, accessibility, and release behavior

**Files:**
- Modify as findings require: `src/components/executive/*.tsx`
- Modify only if required: `src/app/globals.css`
- Modify: `tests/executive-hub-signal-board.test.ts`
- Create: `docs/executive-hub/executive-hub-v1-implementation-notes.md`

**Interfaces:**
- Consumes: completed V1 dashboard.
- Produces: verified implementation, desktop/mobile evidence, and connector handoff notes.

- [ ] **Step 1: Add final source-honesty assertions**

```ts
it("does not present checkout behavior as completed sales", () => {
    expect(dashboardSource).not.toContain("Checkout redirected revenue");
    expect(dashboardSource).not.toContain("Checkout completed revenue");
});

it("keeps illustrative state visible and machine-readable", () => {
    expect(dashboardSource).toContain("data-dashboard-mode={snapshot.mode}");
    expect(dashboardSource).toContain("not live business data");
});
```

- [ ] **Step 2: Run the targeted Executive Hub suite**

Run: `npx vitest run tests/executive-hub-contract.test.ts tests/executive-hub-signal-board.test.ts tests/executive-hub-dashboard.test.ts tests/executive-hub-auth.test.ts tests/team-access.test.ts`

Expected: PASS.

- [ ] **Step 3: Run the Impeccable context and craft-floor checks before final UI edits**

Run:

```bash
node /Users/jordanrichter/.agents/skills/impeccable/scripts/context.mjs --target src/app/executive/page.tsx
```

Then read `/Users/jordanrichter/.agents/skills/impeccable/reference/craft-floor.md` and apply only findings relevant to this surface.

- [ ] **Step 4: Run the mechanical design detector once**

Run:

```bash
node /Users/jordanrichter/.agents/skills/impeccable/scripts/detect.mjs --json \
  src/app/executive/page.tsx \
  src/components/executive/ExecutiveDashboard.tsx \
  src/components/executive/ExecutiveNavigation.tsx \
  src/components/executive/ExecutiveMetric.tsx \
  src/components/executive/ExecutiveDecisionQueue.tsx \
  src/components/executive/ExecutiveOperatingPanels.tsx \
  src/components/executive/ExecutiveDetailSheet.tsx
```

Expected: no unresolved mechanical design violations.

- [ ] **Step 5: Verify desktop and mobile in the browser**

Run the application with the configured local environment and inspect:

- desktop: `http://localhost:3000/executive?preview=1` at 1600×1000
- mobile: `http://localhost:3000/executive?preview=1` at 390×844

Capture both screenshots under `.superpowers/verification/`. Verify no horizontal overflow, the three questions remain first, mobile navigation opens and closes, metric details preserve focus, and the illustrative Alert is visible.

- [ ] **Step 6: Run full verification**

Run:

```bash
npx vitest run
npm run lint
npx tsc --noEmit
npm run build
```

Expected: all tests pass, lint has no new errors, TypeScript passes, and the production build completes with the configured Sanity environment.

- [ ] **Step 7: Write the implementation handoff**

Document:

- implemented components and interactions
- fixture-only values and how they are labeled
- canonical source needed for each live lane
- which existing connectors can be wired next
- unresolved accounting, CRM, ERP, WMS, manufacturing, and logistics source owners
- screenshot paths and verification results

- [ ] **Step 8: Commit the verified V1 shell**

```bash
git add src/app/executive src/components/executive src/components/ui src/lib/executive tests docs/executive-hub package.json package-lock.json
git commit -m "chore: complete executive hub v1 release gate"
```

---

## Deferred source-wiring plans

The following are independent subsystems and require separate implementation plans after this shell ships:

1. Shopify completed-order, revenue, refund, and inventory connector.
2. Accounting or ERP connector for EBITDA, cash, A/R, A/P, and operating expenses.
3. CRM or ERP connector for leads, quotes, samples, pipeline, backlog, and account ownership.
4. WMS, production, and logistics connectors for fulfillment, decoration, suppliers, containers, and purchase orders.
5. Grace usage ledger, controlled-learning entities, Mixpanel quality reports, and OpenAI cost reconciliation.

Until each source is connected and validated, its interface state remains `not-connected` or `directional`; fixture values never become live by changing a label alone.
