import type { ReconciliationCase, ReconciliationResponse } from "./jev-reconciliation";

export type ReviewResult = {
    [key: string]: unknown;
    id: string;
    kind: string;
    inputSha256: string;
    status: "not_evaluated" | "review_required" | "evidence_aligned";
    issues: string[];
    response: ReconciliationResponse | null;
};

const issueNames: Record<string, string> = {
    source_family_mismatch: "Catalog family differs from the exact source description",
    source_capacity_mismatch: "Catalog capacity differs from the exact source description",
    source_glass_mismatch: "Catalog glass material differs from the exact source description",
    missing_assembly_evidence: "Bottle source evidence is missing",
    assembly_source_sku_mismatch: "Source page identifies a different bottle SKU",
    missing_neck: "Neck specification is missing",
    neck_mismatch: "Bottle and component neck specifications differ",
    assembly_source_neck_unconfirmed: "Bottle neck is not confirmed by its source",
    assembled_product_used_as_component: "A complete bottle was proposed as a loose component",
    missing_component_evidence: "Component source evidence is missing",
    component_source_sku_mismatch: "Source page identifies a different component SKU",
    component_source_neck_unconfirmed: "Component neck is not confirmed by its source",
    complete_assembly_sku_mismatch: "Complete assembly SKU differs from the bottle SKU",
    jev_unavailable: "Jev has not evaluated this evidence",
};
export function describeReconciliationIssue(issue: string): string {
    if (issueNames[issue]) return issueNames[issue];
    const fields: Record<string, string> = { identity: "Bottle family, capacity or glass", mechanism: "Hardware type", finish: "Hardware finish or shape" };
    const [field, finding] = issue.split("_");
    const findings: Record<string, string> = { contradicted: "conflicts with source evidence", insufficient: "has insufficient source evidence", uncertain: "needs clarification: model confidence is below the review threshold" };
    return fields[field] && findings[finding] ? `${fields[field]} ${findings[finding]}` : issue;
}

/** Quoted RFC4180 cells, with spreadsheet formula execution disabled. */
export function csvCell(value: string | number | null | undefined): string {
    let text = String(value ?? "");
    if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
}

export function reconciliationCsv(cases: ReconciliationCase[], results: ReviewResult[], checkedAt: string, onlyFindings = false): string {
    const byId = new Map(cases.filter(row => row.kind === "catalog").map(row => [row.id, row]));
    const headers = ["Review ID", "Evidence version", "Audit date", "Family", "Capacity mL", "Glass", "Bottle SKU", "Bottle description",
        "Fitment", "Selected finish", "Bottle neck", "Proposed component SKU", "Component description", "Component neck", "Association type",
        "Audit result", "Issue to clarify", "Issue codes", "Jev identity", "Jev mechanism", "Jev finish",
        "Bottle source", "Bottle source description", "Component source", "Component source description", "Source captured at",
        "Stakeholder decision", "Correct component SKU", "Correction notes", "Supporting source URL", "Reviewer", "Reviewed at"];
    const lines = [headers.map(csvCell).join(",")];
    for (const result of results) {
        const row = byId.get(result.id);
        // Deliberately bad benchmark controls must never become stakeholder work.
        if (!row || result.kind !== "catalog" || (onlyFindings && result.status === "evidence_aligned")) continue;
        const judgment = (field: "identity" | "mechanism" | "finish") => {
            const answer = result.response?.answers[field];
            return answer ? `${answer.choice} (confidence ${answer.confidence.toFixed(3)})` : "Not evaluated";
        };
        lines.push([result.id, result.inputSha256, checkedAt, row.bottle.family, row.bottle.capacityMl, row.bottle.glass,
            row.bottle.sku, row.bottle.name, row.bottle.applicator, row.bottle.finish, row.bottle.neck,
            row.proposed.sku, row.proposed.name, row.proposed.neck, row.mode, result.status,
            result.issues.map(describeReconciliationIssue).join("; "), result.issues.join("; "),
            judgment("identity"), judgment("mechanism"), judgment("finish"),
            row.assemblySource?.url, row.assemblySource?.description, row.componentSource?.url, row.componentSource?.description,
            [row.assemblySource?.capturedAt, row.componentSource?.capturedAt].filter(Boolean).join("; "),
            "Pending review", "", "", "", "", ""].map(csvCell).join(","));
    }
    return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
